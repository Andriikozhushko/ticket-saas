import { prisma } from "@/lib/prisma";

export async function consumeTicket(ticketId: string, usedBy: string) {
  const updated = await prisma.ticket.updateMany({
    where: { id: ticketId, usedAt: null },
    data: { usedAt: new Date(), usedBy },
  });

  if (updated.count === 1) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, usedAt: true, usedBy: true },
    });
    return { ok: true as const, ticket };
  }

  const existing = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, usedAt: true, usedBy: true },
  });
  if (!existing) return { ok: false as const, reason: "not_found" as const };
  return { ok: false as const, reason: "already_used" as const, ticket: existing };
}
