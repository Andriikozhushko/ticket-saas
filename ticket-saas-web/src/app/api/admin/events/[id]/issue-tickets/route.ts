import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issuePaidOrderWithTickets, normalizeOrderEmail } from "@/lib/orders";
import { sendTicketsEmail } from "@/lib/ticket-email";

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
    const email = typeof body?.email === "string" ? normalizeOrderEmail(body.email) : "";
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

    const orderId = await issuePaidOrderWithTickets({
      eventId,
      buyerEmail: email,
      quantity,
    });

    await sendTicketsEmail(orderId, reason);
    return NextResponse.json({ ok: true, orderId, ticketsCount: quantity });
  } catch {
    return NextResponse.json({ error: "Помилка видачі квитків" }, { status: 500 });
  }
}
