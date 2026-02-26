import { NextResponse } from "next/server";
import { getTicketierSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getTicketierSessionFromCookie();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const allowed = await (prisma as unknown as {
    ticketierEvent: { findFirst: (p: { where: { ticketierId: string; eventId: string } }) => Promise<unknown> };
  }).ticketierEvent.findFirst({
    where: { ticketierId: session.ticketierId, eventId },
  });
  if (!allowed) return NextResponse.json({ error: "No access to this event" }, { status: 403 });

  const orders = await prisma.order.findMany({
    where: { eventId, status: "paid" },
    include: {
      tickets: true,
      ticketType: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const tickets = orders.flatMap((o) =>
    o.tickets.map((t) => ({
      id: t.id,
      orderId: o.id,
      buyerEmail: o.buyerEmail,
      ticketTypeName: o.ticketType?.name ?? null,
      usedAt: t.usedAt,
      usedBy: t.usedBy,
    }))
  );
  return NextResponse.json({ eventId, tickets });
}
