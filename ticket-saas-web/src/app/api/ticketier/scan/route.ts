import { NextResponse } from "next/server";
import { getTicketierSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeTicket } from "@/lib/tickets";

export async function POST(req: Request) {
  const session = await getTicketierSessionFromCookie();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", state: "error" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const ticketId = typeof body?.ticketId === "string" ? body.ticketId.trim() : "";
    if (!ticketId) {
      return NextResponse.json({ error: "ticketId required", state: "error" }, { status: 400 });
    }

    const ticketierEventIds = await (prisma as unknown as {
      ticketierEvent: {
        findMany: (p: {
          where: { ticketierId: string };
          select: { eventId: true };
        }) => Promise<{ eventId: string }[]>;
      };
    }).ticketierEvent.findMany({
      where: { ticketierId: session.ticketierId },
      select: { eventId: true },
    });
    const allowedEventIds = ticketierEventIds.map((row) => row.eventId);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: {
          select: {
            eventId: true,
            buyerEmail: true,
            ticketType: { select: { name: true } },
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "РљРІРёС‚РѕРє РЅРµ Р·РЅР°Р№РґРµРЅРѕ", valid: false, state: "error" }, { status: 404 });
    }

    if (!allowedEventIds.includes(ticket.order.eventId)) {
      return NextResponse.json({ error: "РќРµРјР°С” РґРѕСЃС‚упу РґРѕ С†С–С”С— РїРѕРґС–С—", valid: false, state: "error" }, { status: 403 });
    }

    const consumed = await consumeTicket(ticketId, session.login);
    if (!consumed.ok && consumed.reason === "already_used") {
      return NextResponse.json(
        {
          error: "РљРІРёС‚РѕРє СѓР¶Рµ РІРёРєРѕСЂРёСЃС‚Р°РЅРѕ",
          usedAt: consumed.ticket?.usedAt,
          usedBy: consumed.ticket?.usedBy,
          buyerEmail: ticket.order.buyerEmail,
          ticketTypeName: ticket.order.ticketType?.name ?? null,
          valid: false,
          state: "already_used",
        },
        { status: 400 }
      );
    }

    if (!consumed.ok) {
      return NextResponse.json({ error: "РљРІРёС‚РѕРє РЅРµ Р·РЅР°Р№РґРµРЅРѕ", valid: false, state: "error" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      valid: true,
      message: "РљРІРёС‚РѕРє РїС–РґС‚РІРµСЂРґР¶РµРЅРѕ",
      usedAt: consumed.ticket?.usedAt,
      usedBy: consumed.ticket?.usedBy,
      buyerEmail: ticket.order.buyerEmail,
      ticketTypeName: ticket.order.ticketType?.name ?? null,
      state: "success",
    });
  } catch {
    return NextResponse.json({ error: "РџРѕРјРёР»РєР° СЃРєР°РЅСѓРІР°ння", state: "error" }, { status: 500 });
  }
}

