import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { payment: true, tickets: true, event: true },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const event = order.event as { monoJarId?: string | null; monoAccountId?: string | null };
    const jarId = event?.monoJarId ?? event?.monoAccountId ?? null;
    const amountUah = (order.amountExpectedCents / 100).toFixed(2);
    const jarPaymentUrl = jarId ? `https://send.monobank.ua/jar/${jarId}?amount=${amountUah}` : null;
    const tickets = order.tickets.map((t) => ({ id: t.id, usedAt: t.usedAt, usedBy: t.usedBy }));
    return NextResponse.json({
      id: order.id,
      status: order.status,
      amountExpectedCents: order.amountExpectedCents,
      amountHuman: (order.amountExpectedCents / 100).toFixed(2),
      expiresAt: order.expiresAt.toISOString(),
      isExpired: order.expiresAt < new Date(),
      hasPayment: !!order.payment,
      hasTicket: tickets.length > 0,
      jarPaymentUrl,
      tickets,
    });
  } catch (e) {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 500 });
  }
}
