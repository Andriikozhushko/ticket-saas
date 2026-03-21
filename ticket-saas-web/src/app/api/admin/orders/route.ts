import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Список СѓСЃС–С… Р·Р°РјРѕРІР»Рµнь (С‚С–Р»ьки РїРѕРІРЅРёР№ Р°РґРјС–РЅ). */
export async function GET() {
  const session = await getSessionFromCookie();
  if (!session?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true, org: { select: { name: true } } } },
      payment: { select: { id: true, amountCents: true, occurredAt: true } },
      tickets: { select: { id: true } },
    },
  });
  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      buyerEmail: o.buyerEmail,
      amountExpectedCents: o.amountExpectedCents,
      quantity: o.quantity,
      status: o.status,
      expiresAt: o.expiresAt.toISOString(),
      createdAt: o.createdAt.toISOString(),
      eventId: o.event.id,
      eventTitle: o.event.title,
      orgName: o.event.org.name,
      payment: o.payment
        ? { id: o.payment.id, amountCents: o.payment.amountCents, occurredAt: o.payment.occurredAt.toISOString() }
        : null,
      ticketsCount: o.tickets.length,
    }))
  );
}

