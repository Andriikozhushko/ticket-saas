import { prisma } from "@/lib/prisma";
import { runSharedPoll, sourceKey } from "@/lib/monobank-shared-poll";

type OrderWithPaymentState = {
  id: string;
  status: string;
  amountExpectedCents: number;
  expiresAt: Date;
  payment?: object | null;
  tickets: Array<{ id: string; usedAt: Date | null; usedBy: string | null }>;
  event?: {
    orgId?: string;
    monoJarId?: string | null;
    monoAccountId?: string | null;
    org?: { mono?: { token: string } | null } | null;
  } | null;
};

export type OrderPublicSnapshot = {
  id: string;
  status: string;
  amountExpectedCents: number;
  amountHuman: string;
  expiresAt: string;
  isExpired: boolean;
  hasPayment: boolean;
  hasTicket: boolean;
  jarPaymentUrl: string | null;
  tickets: Array<{ id: string; usedAt: Date | null; usedBy: string | null }>;
};

export type PendingMonobankSource = {
  key: string;
  token: string;
  accountId: string;
};

export function isOrderPaid(order: Pick<OrderWithPaymentState, "status" | "payment" | "tickets">): boolean {
  return Boolean(order.payment) || order.tickets.length > 0 || order.status === "paid";
}

export function isOrderExpired(order: Pick<OrderWithPaymentState, "expiresAt">, now = new Date()): boolean {
  return order.expiresAt < now;
}

export function buildJarPaymentUrl(jarId: string | null | undefined, amountExpectedCents: number): string | null {
  if (!jarId) {
    return null;
  }

  return `https://send.monobank.ua/jar/${jarId}?amount=${(amountExpectedCents / 100).toFixed(2)}`;
}

export function toOrderPublicSnapshot(order: OrderWithPaymentState, now = new Date()): OrderPublicSnapshot {
  const jarId = order.event?.monoJarId ?? order.event?.monoAccountId ?? null;
  return {
    id: order.id,
    status: order.status,
    amountExpectedCents: order.amountExpectedCents,
    amountHuman: (order.amountExpectedCents / 100).toFixed(2),
    expiresAt: order.expiresAt.toISOString(),
    isExpired: isOrderExpired(order, now),
    hasPayment: Boolean(order.payment),
    hasTicket: order.tickets.length > 0,
    jarPaymentUrl: buildJarPaymentUrl(jarId, order.amountExpectedCents),
    tickets: order.tickets.map((ticket) => ({
      id: ticket.id,
      usedAt: ticket.usedAt,
      usedBy: ticket.usedBy,
    })),
  };
}

export async function expireAwaitingPaymentOrders(now = new Date()): Promise<number> {
  const result = await prisma.order.updateMany({
    where: { status: "awaiting_payment", expiresAt: { lt: now } },
    data: { status: "expired" },
  });
  return result.count;
}

export async function getPendingMonobankSources(now = new Date()): Promise<PendingMonobankSource[]> {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["awaiting_payment", "expired"] },
      createdAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
      event: {
        monoAccountId: { not: null },
        org: { mono: { isNot: null } },
      },
    },
    select: {
      event: {
        select: {
          orgId: true,
          monoAccountId: true,
          org: { select: { mono: { select: { token: true } } } },
        },
      },
    },
  });

  const sources = new Map<string, PendingMonobankSource>();
  for (const item of orders) {
    const event = item.event as {
      orgId: string;
      monoAccountId: string | null;
      org?: { mono?: { token: string } | null };
    };
    if (!event.orgId || !event.monoAccountId || !event.org?.mono?.token) {
      continue;
    }

    const key = sourceKey(event.orgId, event.monoAccountId);
    if (!sources.has(key)) {
      sources.set(key, {
        key,
        token: event.org.mono.token,
        accountId: event.monoAccountId,
      });
    }
  }

  return [...sources.values()];
}

export async function getOrderForPaymentSnapshot(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      tickets: true,
      event: { include: { org: { include: { mono: true } } } },
    },
  });
}

export async function refreshOrderPaymentSnapshot(orderId: string, triggerPoll = true) {
  const order = await getOrderForPaymentSnapshot(orderId);
  if (!order) {
    return null;
  }

  if (
    triggerPoll &&
    !isOrderPaid(order) &&
    order.event?.orgId &&
    order.event?.monoAccountId &&
    order.event?.org?.mono?.token
  ) {
    const key = sourceKey(order.event.orgId, order.event.monoAccountId);
    await runSharedPoll(key, order.event.org.mono.token, order.event.monoAccountId);
  }

  const freshOrder = await getOrderForPaymentSnapshot(orderId);
  if (!freshOrder) {
    return null;
  }

  return {
    order: freshOrder,
    snapshot: toOrderPublicSnapshot(freshOrder),
  };
}
