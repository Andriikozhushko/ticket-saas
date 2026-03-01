import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSharedPoll, sourceKey } from "@/lib/monobank-shared-poll";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        payment: true,
        tickets: true,
        event: { include: { org: { include: { mono: true } } } },
      },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const event = order.event as {
      orgId?: string;
      monoJarId?: string | null;
      monoAccountId?: string | null;
      org?: { mono?: { token: string } | null };
    };
    // Якщо очікує оплати і є Monobank — один раз підтягуємо виписку (користувач побачить оплату навіть після повернення на сторінку)
    const nowDate = new Date();
    if (
      order.status === "awaiting_payment" &&
      order.expiresAt > nowDate &&
      event?.orgId &&
      event?.monoAccountId &&
      event?.org?.mono?.token
    ) {
      const key = sourceKey(event.orgId, event.monoAccountId);
      await runSharedPoll(key, event.org.mono.token, event.monoAccountId);
    }
    const orderFresh = await prisma.order.findUnique({
      where: { id },
      include: { payment: true, tickets: true, event: true },
    });
    if (!orderFresh) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const ev = orderFresh.event as { monoJarId?: string | null; monoAccountId?: string | null };
    const jarId = ev?.monoJarId ?? ev?.monoAccountId ?? null;
    const amountUah = (orderFresh.amountExpectedCents / 100).toFixed(2);
    const jarPaymentUrl = jarId ? `https://send.monobank.ua/jar/${jarId}?amount=${amountUah}` : null;
    const tickets = orderFresh.tickets.map((t) => ({ id: t.id, usedAt: t.usedAt, usedBy: t.usedBy }));
    return NextResponse.json({
      id: orderFresh.id,
      status: orderFresh.status,
      amountExpectedCents: orderFresh.amountExpectedCents,
      amountHuman: (orderFresh.amountExpectedCents / 100).toFixed(2),
      expiresAt: orderFresh.expiresAt.toISOString(),
      isExpired: orderFresh.expiresAt < new Date(),
      hasPayment: !!orderFresh.payment,
      hasTicket: tickets.length > 0,
      jarPaymentUrl,
      tickets,
    });
  } catch (e) {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 500 });
  }
}
