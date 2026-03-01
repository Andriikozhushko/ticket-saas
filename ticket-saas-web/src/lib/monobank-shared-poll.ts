/**
 * Shared Monobank polling per source (org + jar/account).
 * One statement fetch per source per cooldown; match all pending orders for that source.
 * Designed so a future webhook can mark orders paid and this stays as fallback.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/brevo";

// Cooldown: do not call Monobank more than once per this many ms per source.
const COOLDOWN_MS = 30_000;
// Закриваємо платіж тільки якщо зіставили з замовленням за останні 20 хв.
const RECENT_ORDER_MINUTES = 20;
// Виписка Monobank: останні N днів (до 31).
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

/** Source key: same org + same jar/account = one shared poll. */
export function sourceKey(orgId: string, accountId: string): string {
  return `${orgId}:${accountId}`;
}

/** Незакриті замовлення за останні 20 хв по цьому Monobank-джерелу. */
export async function getPendingOrdersForSource(orgId: string, monoAccountId: string) {
  const now = new Date();
  const since = new Date(now.getTime() - RECENT_ORDER_MINUTES * 60 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      status: "awaiting_payment",
      expiresAt: { gt: now },
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
  return orders.filter((o) => !o.payment && o.tickets.length === 0);
}

export type SharedPollResult =
  | { ok: true; matchedOrderIds: string[] }
  | { ok: false; stillChecking: true }
  | { ok: false; error: string };

/**
 * Run one shared poll for the given source. Uses cache if cooldown not expired.
 * On 429, returns stillChecking (no long backoff). One fetch can confirm many orders.
 */
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
    const matched = await matchAndApply(key, cached.list, cached.usedDefaultAccount, token);
    console.log("[monobank-shared-poll] source=%s pending=%d reused cache matched=%d orderIds=%s", key, pending.length, matched.length, matched.join(","));
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
    console.error("[monobank-shared-poll] 429 Too Many Requests source=%s pending=%d %s", key, pending.length, body);
    return { ok: false, stillChecking: true };
  }
  if (!res.ok) {
    const body = await res.text();
    console.error("[monobank-shared-poll] API error source=%s status=%s %s", key, res.status, body);
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
  console.log("[monobank-shared-poll] source=%s pending=%d fetched transactionCount=%d usedDefaultAccount=%s", key, pending.length, list.length, usedDefaultAccount);

  const matchedOrderIds = await matchAndApply(key, list, usedDefaultAccount, token);
  console.log("[monobank-shared-poll] source=%s matched=%d orderIds=%s", key, matchedOrderIds.length, matchedOrderIds.join(","));
  return { ok: true, matchedOrderIds };
}

/** Already-used mono operation ids (one tx -> one order). */
async function usedMonoOperationIds(txIds: string[]): Promise<Set<string>> {
  if (txIds.length === 0) return new Set();
  const existing = await prisma.payment.findMany({
    where: { monoOperationId: { in: txIds } },
    select: { monoOperationId: true },
  });
  return new Set(existing.map((p) => p.monoOperationId));
}

/**
 * Match transactions to pending orders by amount; one tx -> one order.
 * Then create Payment + Tickets and send email for each matched order.
 */
async function matchAndApply(
  _key: string,
  list: StatementItem[],
  usedDefaultAccount: boolean,
  _token: string
): Promise<string[]> {
  const [orgId, accountId] = _key.split(":");
  const pending = await getPendingOrdersForSource(orgId, accountId);
  if (pending.length === 0) return [];

  const txIds = list.map((t) => t.id);
  const used = await usedMonoOperationIds(txIds);
  const usedInBatch = new Set<string>();

  const matchedOrderIds: string[] = [];

  for (const order of pending) {
    const expectedCents = order.amountExpectedCents;
    const match = list.find((item) => {
      const isUah = item.currencyCode === 980 || item.currencyCode === undefined;
      if (!isUah) return false;
      const amount = item.operationAmount ?? item.amount;
      const absAmount = Math.abs(amount);
      if (absAmount !== expectedCents) return false;
      if (used.has(item.id) || usedInBatch.has(item.id)) return false;
      const desc = String((item.description ?? "") + (item.comment ?? ""));
      if (desc.includes(order.id)) return true;
      if (usedDefaultAccount) return amount < 0;
      return amount > 0;
    });
    if (!match) continue;

    usedInBatch.add(match.id);
    const quantity = Math.max(1, order.quantity ?? 1);
    try {
      await prisma.$transaction([
        prisma.payment.create({
          data: {
            monoOperationId: match.id,
            amountCents: Math.abs(match.operationAmount ?? match.amount),
            occurredAt: new Date(match.time * 1000),
            rawJson: match as unknown as object,
            orderId: order.id,
          },
        }),
        prisma.order.update({
          where: { id: order.id },
          data: { status: "paid" },
        }),
        ...Array.from({ length: quantity }, () =>
          prisma.ticket.create({ data: { orderId: order.id } })
        ),
      ]);
      matchedOrderIds.push(order.id);
      await sendTicketEmail(order.id);
    } catch (e) {
      console.error("[monobank-shared-poll] failed to apply match orderId=%s monoOpId=%s", order.id, match.id, e);
    }
  }

  return matchedOrderIds;
}

async function sendTicketEmail(orderId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? "https://lizard.red";
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { event: { select: { title: true } }, tickets: true },
  });
  if (!order?.tickets.length) return;
  const eventTitle = (order.event as { title: string }).title ?? "Подія";
  const myTicketsUrl = `${baseUrl.replace(/\/$/, "")}/my-tickets`;
  const qrSize = 200;
  const qrImages = order.tickets
    .map(
      (t) =>
        `<div style="margin:12px 0;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(`${baseUrl.replace(/\/$/, "")}/api/public/tickets/verify/${t.id}`)}&bgcolor=FFFFFF&color=000000" alt="QR" width="${qrSize}" height="${qrSize}" style="display:block;border-radius:8px;" /></div>`
    )
    .join("");
  const htmlContent = `<p>Оплату отримано. Ваш квиток на подію <strong>${eventTitle}</strong> готовий.</p><p>QR-коди для входу:</p>${qrImages}<p><a href="${myTicketsUrl}">Переглянути мої квитки</a> (увійдіть з email ${order.buyerEmail}).</p>`;
  const textContent = `Оплату отримано. Квиток(и) на подію «${eventTitle}» готові. Переглянути: ${myTicketsUrl}`;
  await sendEmail({
    to: order.buyerEmail,
    subject: `Ваш квиток — ${eventTitle}`,
    textContent,
    htmlContent,
  });
}
