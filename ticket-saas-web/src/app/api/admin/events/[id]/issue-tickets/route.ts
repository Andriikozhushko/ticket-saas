import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/brevo";

const REASONS = ["gift", "issuance", "purchase"] as const;
type Reason = (typeof REASONS)[number];

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromCookie();
  const canAccess = session?.isAdmin || session?.role === "organizer";
  if (!canAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { id: eventId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const quantity = Math.min(10, Math.max(1, Math.floor(Number(body?.quantity) ?? 1)));
    const reason = REASONS.includes(body?.reason as Reason) ? (body.reason as Reason) : "issuance";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: "Невірний email" }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId },
      include: { org: true },
    });
    if (!event) return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
    if (!session.isAdmin && event.org.ownerId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const minAmount = await prisma.order
      .findFirst({ where: { eventId }, select: { amountExpectedCents: true }, orderBy: { amountExpectedCents: "asc" } })
      .then((o) => o?.amountExpectedCents ?? 0);
    const amountExpectedCents = minAmount >= 0 ? -1 : minAmount - 1;

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    const order = await prisma.order.create({
      data: {
        eventId,
        buyerEmail: email,
        quantity,
        amountExpectedCents,
        status: "paid",
        expiresAt,
      },
    });

    await prisma.ticket.createMany({
      data: Array.from({ length: quantity }, () => ({ orderId: order.id })),
    });

    const orderWithTickets = await prisma.order.findUnique({
      where: { id: order.id },
      include: { event: { select: { title: true } }, tickets: true },
    });

    if (orderWithTickets?.tickets.length) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.SITE_URL ?? "https://lizard.red";
      const eventTitle = (orderWithTickets.event as { title: string }).title ?? "Подія";
      const myTicketsUrl = `${baseUrl.replace(/\/$/, "")}/my-tickets`;
      const qrSize = 200;
      const reasonLabel = { gift: "Подарок", issuance: "Видача", purchase: "Покупка" }[reason];
      const qrImages = orderWithTickets.tickets
        .map(
          (t) =>
            `<div style="margin:12px 0;"><img src="https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(`${baseUrl.replace(/\/$/, "")}/api/public/tickets/verify/${t.id}`)}&bgcolor=FFFFFF&color=000000" alt="QR квитка" width="${qrSize}" height="${qrSize}" style="display:block;border-radius:8px;" /></div>`
        )
        .join("");
      const htmlContent = `<p>Вам видано квиток(и) на подію <strong>${eventTitle}</strong> (${reasonLabel}).</p><p>QR-коди для входу:</p>${qrImages}<p><a href="${myTicketsUrl}">Переглянути мої квитки</a> (увійдіть з email ${email}).</p>`;
      const textContent = `Вам видано квиток(и) на подію «${eventTitle}». Переглянути: ${myTicketsUrl}`;
      await sendEmail({
        to: email,
        subject: `Ваш квиток — ${eventTitle}`,
        textContent,
        htmlContent,
      });
    }

    return NextResponse.json({ ok: true, orderId: order.id, ticketsCount: quantity });
  } catch (e) {
    return NextResponse.json({ error: "Помилка видачі квитків" }, { status: 500 });
  }
}
