import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/brevo";

type StatementItem = {
  id: string;
  time: number;
  amount: number;
  operationAmount?: number;
  currencyCode?: number;
  [key: string]: unknown;
};

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payment: true,
        tickets: true,
        event: { include: { org: { include: { mono: true } } } },
      },
    });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const hasTickets = order.tickets.length > 0;
    if (order.payment || hasTickets || order.status === "paid") {
      return NextResponse.json({ ok: true, paid: true });
    }
    const now = new Date();
    if (order.expiresAt < now) {
      return NextResponse.json({ ok: true, paid: false, expired: true });
    }
    const event = order.event as { monoAccountId?: string | null; org?: { mono?: { token: string } | null } };
    const mono = event.org?.mono;
    if (!mono?.token || !event?.monoAccountId) {
      return NextResponse.json({ ok: true, paid: false });
    }
    const fromSec = Math.floor(order.createdAt.getTime() / 1000) - 120;
    const toSec = Math.floor(Date.now() / 1000);
    const url = `https://api.monobank.ua/personal/statement/${event.monoAccountId}/${fromSec}/${toSec}`;
    let res: Response;
    try {
      res = await fetch(url, { headers: { "X-Token": mono.token } });
    } catch {
      return NextResponse.json({ ok: false, error: "Не вдалося перевірити оплату" }, { status: 502 });
    }
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: "Не вдалося перевірити оплату" }, { status: 502 });
    }
    let list: StatementItem[];
    try {
      list = (await res.json()) as StatementItem[];
    } catch {
      return NextResponse.json({ ok: false, error: "Не вдалося перевірити оплату" }, { status: 502 });
    }
    const expectedCents = order.amountExpectedCents;
    const match = list.find(
      (item) =>
        item.amount === expectedCents &&
        item.amount > 0 &&
        (item.currencyCode === 980 || !("currencyCode" in item))
    );
    if (!match) {
      return NextResponse.json({ ok: true, paid: false });
    }
    const quantity = Math.max(1, Number((order as { quantity?: number }).quantity) || 1);
    try {
      await prisma.$transaction([
        prisma.payment.create({
          data: {
            monoOperationId: match.id,
            amountCents: match.amount,
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
    } catch {
      const updated = await prisma.order.findUnique({
        where: { id: order.id },
        include: { payment: true },
      });
      if (updated?.payment) return NextResponse.json({ ok: true, paid: true });
      return NextResponse.json({ ok: true, paid: false });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? "https://lizard.red";
    const paidOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { event: { select: { title: true } }, tickets: true },
    });
    if (paidOrder?.tickets.length) {
      const eventTitle = (paidOrder.event as { title: string }).title ?? "Подія";
      const myTicketsUrl = `${baseUrl.replace(/\/$/, "")}/my-tickets`;
      const qrSize = 200;
      const qrImages = paidOrder.tickets
        .map(
          (t) =>
            `<div style="margin:12px 0;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(`${baseUrl.replace(/\/$/, "")}/api/public/tickets/verify/${t.id}`)}&bgcolor=FFFFFF&color=000000" alt="QR квитка" width="${qrSize}" height="${qrSize}" style="display:block;border-radius:8px;" /></div>`
        )
        .join("");
      const htmlContent = `<p>Оплату отримано. Ваш квиток на подію <strong>${eventTitle}</strong> готовий.</p><p>QR-коди для входу (покажіть на події):</p>${qrImages}<p><a href="${myTicketsUrl}">Переглянути мої квитки</a> (увійдіть з email ${paidOrder.buyerEmail}).</p>`;
      const textContent = `Оплату отримано. Квиток(и) на подію «${eventTitle}» готові. Переглянути: ${myTicketsUrl}`;
      await sendEmail({
        to: paidOrder.buyerEmail,
        subject: `Ваш квиток — ${eventTitle}`,
        textContent,
        htmlContent,
      });
    }

    return NextResponse.json({ ok: true, paid: true });
  } catch (e) {
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
