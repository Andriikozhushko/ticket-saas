import { prisma } from "@/lib/prisma";

const ORDER_TTL_MINUTES = 15;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TicketTypeRow = { id: string; priceCents: number };

export function normalizeOrderEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveBuyerEmail(sessionEmail?: string | null, rawEmail?: string | null): string {
  if (sessionEmail) return normalizeOrderEmail(sessionEmail);
  if (!rawEmail) return "";
  const normalized = normalizeOrderEmail(rawEmail);
  return emailRegex.test(normalized) ? normalized : "";
}

export async function getEventTicketTypes(eventId: string): Promise<TicketTypeRow[]> {
  return (prisma as unknown as {
    ticketType: {
      findMany: (args: {
        where: { eventId: string };
        orderBy: { sortOrder: "asc" };
      }) => Promise<TicketTypeRow[]>;
    };
  }).ticketType.findMany({
    where: { eventId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function resolveOrderPrice(
  eventId: string,
  eventPriceCents: number,
  ticketTypeId: string | null
): Promise<number> {
  const ticketTypes = await getEventTicketTypes(eventId);
  if (ticketTypeId) {
    const ticketType = ticketTypes.find((row) => row.id === ticketTypeId);
    if (!ticketType) {
      throw new Error("TICKET_TYPE_NOT_FOUND");
    }
    return ticketType.priceCents;
  }
  return ticketTypes[0]?.priceCents ?? eventPriceCents;
}

function shuffledOffsets(): number[] {
  const values = Array.from({ length: 99 }, (_, i) => i + 1);
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export async function createAwaitingPaymentOrder(input: {
  eventId: string;
  buyerEmail: string;
  quantity: number;
  ticketTypeId: string | null;
  priceCents: number;
}) {
  const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000);
  const baseAmountCents = input.priceCents * input.quantity;
  const offsets = shuffledOffsets();

  for (const offset of offsets) {
    try {
      const order = await prisma.order.create({
        data: {
          eventId: input.eventId,
          buyerEmail: input.buyerEmail,
          quantity: input.quantity,
          amountExpectedCents: baseAmountCents + offset,
          status: "awaiting_payment",
          expiresAt,
          ...(input.ticketTypeId ? { ticketTypeId: input.ticketTypeId } : {}),
        } as Parameters<typeof prisma.order.create>[0]["data"],
      });

      return {
        orderId: order.id,
        amountExpectedCents: order.amountExpectedCents,
        amountHuman: (order.amountExpectedCents / 100).toFixed(2),
        expiresAt: expiresAt.toISOString(),
      };
    } catch {
      continue;
    }
  }

  throw new Error("NO_FREE_AMOUNTS");
}

export async function issuePaidOrderWithTickets(input: {
  eventId: string;
  buyerEmail: string;
  quantity: number;
}) {
  const minAmount = await prisma.order
    .findFirst({
      where: { eventId: input.eventId },
      select: { amountExpectedCents: true },
      orderBy: { amountExpectedCents: "asc" },
    })
    .then((order) => order?.amountExpectedCents ?? 0);

  const amountExpectedCents = minAmount >= 0 ? -1 : minAmount - 1;
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const order = await prisma.order.create({
    data: {
      eventId: input.eventId,
      buyerEmail: input.buyerEmail,
      quantity: input.quantity,
      amountExpectedCents,
      status: "paid",
      expiresAt,
    },
  });

  await prisma.ticket.createMany({
    data: Array.from({ length: input.quantity }, () => ({ orderId: order.id })),
  });

  return order.id;
}
