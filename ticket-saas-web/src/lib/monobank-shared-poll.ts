/**
 * Shared Monobank polling per source (org + jar/account).
 * One statement fetch per source per cooldown; match all pending orders for that source.
 * Designed so a future webhook can mark orders paid and this stays as fallback.
 */

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { matchTransactionsToOrders } from "@/lib/monobank-matching";
import { sendTicketsEmail } from "@/lib/ticket-email";

const COOLDOWN_MS = 30_000;
const RECENT_ORDER_MINUTES = 6 * 60;
const RECENT_DAYS = 3;
const TO_SEC_BUFFER = 3600;

export type StatementItem = {
  id: string;
  time: number;
  amount: number;
  operationAmount?: number;
  currencyCode?: number;
  description?: string;
  comment?: string;
  [key: string]: unknown;
};

type CacheEntry = {
  fetchedAt: number;
  list: StatementItem[];
  usedDefaultAccount: boolean;
};

const statementCache = new Map<string, CacheEntry>();

export function sourceKey(orgId: string, accountId: string): string {
  return `${orgId}:${accountId}`;
}

export async function getPendingOrdersForSource(orgId: string, monoAccountId: string) {
  const now = new Date();
  const since = new Date(now.getTime() - RECENT_ORDER_MINUTES * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["awaiting_payment", "expired"] },
      createdAt: { gte: since },
      event: {
        orgId,
        monoAccountId,
      },
    },
    include: {
      payment: true,
      tickets: true,
      event: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return orders.filter((order) => !order.payment && order.tickets.length === 0);
}

export type SharedPollResult =
  | { ok: true; matchedOrderIds: string[] }
  | { ok: false; stillChecking: true }
  | { ok: false; error: string };

export async function runSharedPoll(
  key: string,
  token: string,
  accountId: string
): Promise<SharedPollResult> {
  const nowMs = Date.now();
  const pending = await getPendingOrdersForSource(key.split(":")[0], accountId);
  if (pending.length === 0) {
    return { ok: true, matchedOrderIds: [] };
  }

  const cached = statementCache.get(key);
  if (cached && nowMs - cached.fetchedAt < COOLDOWN_MS) {
    const matched = await matchAndApply(key, cached.list, cached.usedDefaultAccount);
    console.log(
      "[monobank-shared-poll] source=%s pending=%d reused cache matched=%d orderIds=%s",
      key,
      pending.length,
      matched.length,
      matched.join(",")
    );
    return { ok: true, matchedOrderIds: matched };
  }

  const nowSec = Math.floor(nowMs / 1000);
  const fromSec = nowSec - RECENT_DAYS * 86400;
  const toSec = nowSec + TO_SEC_BUFFER;
  const url = `https://api.monobank.ua/personal/statement/${accountId}/${fromSec}/${toSec}`;

  let list: StatementItem[];
  let usedDefaultAccount = false;

  const res = await fetch(url, { headers: { "X-Token": token } });
  if (res.status === 429) {
    const body = await res.text();
    console.error(
      "[monobank-shared-poll] 429 Too Many Requests source=%s pending=%d %s",
      key,
      pending.length,
      body
    );
    return { ok: false, stillChecking: true };
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(
      "[monobank-shared-poll] API error source=%s status=%s %s",
      key,
      res.status,
      body
    );
    return { ok: false, stillChecking: true };
  }

  list = (await res.json()) as StatementItem[];
  if (list.length === 0) {
    const defaultRes = await fetch(
      `https://api.monobank.ua/personal/statement/0/${fromSec}/${toSec}`,
      { headers: { "X-Token": token } }
    );

    if (defaultRes.status === 429) {
      console.error("[monobank-shared-poll] 429 on default account source=%s", key);
      return { ok: false, stillChecking: true };
    }

    if (defaultRes.ok) {
      list = (await defaultRes.json()) as StatementItem[];
      usedDefaultAccount = true;
    }
  }

  statementCache.set(key, { fetchedAt: nowMs, list, usedDefaultAccount });
  console.log(
    "[monobank-shared-poll] source=%s pending=%d fetched transactionCount=%d usedDefaultAccount=%s",
    key,
    pending.length,
    list.length,
    usedDefaultAccount
  );

  const matchedOrderIds = await matchAndApply(key, list, usedDefaultAccount);
  console.log(
    "[monobank-shared-poll] source=%s matched=%d orderIds=%s",
    key,
    matchedOrderIds.length,
    matchedOrderIds.join(",")
  );
  return { ok: true, matchedOrderIds };
}

async function usedMonoOperationIds(txIds: string[]): Promise<Set<string>> {
  if (txIds.length === 0) {
    return new Set();
  }

  const [existingPayments, existingParts] = await Promise.all([
    prisma.payment.findMany({
      where: { monoOperationId: { in: txIds } },
      select: { monoOperationId: true },
    }),
    (prisma as unknown as {
      orderPaymentPart: {
        findMany: (args: {
          where: { monoOperationId: { in: string[] } };
          select: { monoOperationId: true };
        }) => Promise<Array<{ monoOperationId: string }>>;
      };
    }).orderPaymentPart.findMany({
      where: { monoOperationId: { in: txIds } },
      select: { monoOperationId: true },
    }),
  ]);

  return new Set([
    ...existingPayments.map((payment) => payment.monoOperationId),
    ...existingParts.map((part) => part.monoOperationId),
  ]);
}

function buildSettlementOperationId(transactions: StatementItem[]): string {
  if (transactions.length === 1) {
    return transactions[0].id;
  }

  const hash = crypto
    .createHash("sha256")
    .update(transactions.map((transaction) => transaction.id).sort().join("|"))
    .digest("hex");

  return `split:${hash}`;
}

function settlementOccurredAt(transactions: StatementItem[]): Date {
  const latestUnix = Math.max(...transactions.map((transaction) => transaction.time));
  return new Date(latestUnix * 1000);
}

function settlementAmountCents(transactions: StatementItem[]): number {
  return transactions.reduce(
    (sum, transaction) => sum + Math.abs(transaction.operationAmount ?? transaction.amount),
    0
  );
}

function settlementRawJson(transactions: StatementItem[]): object {
  return transactions.length === 1
    ? (transactions[0] as unknown as object)
    : ({ splitTransactions: transactions } as object);
}

async function matchAndApply(
  key: string,
  list: StatementItem[],
  usedDefaultAccount: boolean
): Promise<string[]> {
  const [orgId, accountId] = key.split(":");
  const pending = await getPendingOrdersForSource(orgId, accountId);
  if (pending.length === 0) {
    return [];
  }

  const txIds = list.map((item) => item.id);
  const used = await usedMonoOperationIds(txIds);
  const matchedOrderIds: string[] = [];

  const matches = matchTransactionsToOrders({
    pendingOrders: pending.map((order) => ({
      id: order.id,
      amountExpectedCents: order.amountExpectedCents,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
    })),
    statement: list,
    usedOperationIds: used,
    usedDefaultAccount,
  });

  for (const match of matches) {
    const order = pending.find((candidate) => candidate.id === match.orderId);
    if (!order) {
      continue;
    }

    const quantity = Math.max(1, order.quantity ?? 1);
    const transactions = match.transactions;
    const settlementId = buildSettlementOperationId(transactions);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            monoOperationId: settlementId,
            amountCents: settlementAmountCents(transactions),
            occurredAt: settlementOccurredAt(transactions),
            rawJson: settlementRawJson(transactions),
            orderId: order.id,
          },
        });

        for (const transaction of transactions) {
          await (tx as unknown as {
            orderPaymentPart: {
              create: (args: {
                data: {
                  orderId: string;
                  monoOperationId: string;
                  amountCents: number;
                  occurredAt: Date;
                  rawJson: object;
                };
              }) => Promise<unknown>;
            };
          }).orderPaymentPart.create({
            data: {
              orderId: order.id,
              monoOperationId: transaction.id,
              amountCents: Math.abs(transaction.operationAmount ?? transaction.amount),
              occurredAt: new Date(transaction.time * 1000),
              rawJson: transaction as unknown as object,
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: "paid" },
        });

        for (let index = 0; index < quantity; index += 1) {
          await tx.ticket.create({ data: { orderId: order.id } });
        }
      });

      matchedOrderIds.push(order.id);
      await sendTicketsEmail(order.id, "payment_confirmed");
    } catch (error) {
      console.error(
        "[monobank-shared-poll] failed to apply match orderId=%s settlementId=%s txCount=%d",
        order.id,
        settlementId,
        transactions.length,
        error
      );
    }
  }

  return matchedOrderIds;
}
