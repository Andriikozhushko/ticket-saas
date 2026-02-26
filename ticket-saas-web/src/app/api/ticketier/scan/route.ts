import { NextResponse } from "next/server";
import { getTicketierSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getTicketierSessionFromCookie();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId.trim() : "";
    if (!ticketId) return NextResponse.json({ error: "ticketId required" }, { status: 400 });

    const ticketierEventIds = await (prisma as unknown as {
      ticketierEvent: { findMany: (p: { where: { ticketierId: string }; select: { eventId: true } }) => Promise<{ eventId: string }[]> };
    }).ticketierEvent.findMany({
      where: { ticketierId: session.ticketierId },
      select: { eventId: true },
    });
    const allowedEventIds = ticketierEventIds.map((e) => e.eventId);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { order: { select: { eventId: true } } },
    });
    if (!ticket) return NextResponse.json({ error: "Квиток не знайдено", valid: false }, { status: 404 });
    if (!allowedEventIds.includes(ticket.order.eventId)) {
      return NextResponse.json({ error: "Немає доступу до цієї події", valid: false }, { status: 403 });
    }
    if (ticket.usedAt) {
      return NextResponse.json({
        error: "Квиток вже використано",
        usedAt: ticket.usedAt,
        usedBy: ticket.usedBy,
        valid: false,
      }, { status: 400 });
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { usedAt: new Date(), usedBy: session.login },
    });
    return NextResponse.json({ ok: true, valid: true, message: "Квиток підтверджено" });
  } catch {
    return NextResponse.json({ error: "Помилка сканування" }, { status: 500 });
  }
}
