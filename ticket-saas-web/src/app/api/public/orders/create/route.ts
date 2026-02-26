import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookie } from "@/lib/auth";
import { checkOrderCreateRateLimit, recordOrderCreateAttempt, getClientIp } from "@/lib/rate-limit";
import { createOrderBodySchema } from "@/lib/schemas/orders";

const ORDER_TTL_MINUTES = 15;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rate = checkOrderCreateRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.error ?? "Забагато замовлень" }, { status: 429 });
    }
    const session = await getSessionFromCookie();
    const raw = await req.json().catch(() => null);
    const parsed = createOrderBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Невірні дані замовлення";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { eventId, email: rawEmail, ticketTypeId: rawTicketTypeId, quantity } = parsed.data;
    const ticketTypeId = rawTicketTypeId || null;
    const email = session?.email
      ? session.email.toLowerCase()
      : rawEmail ? (emailRegex.test(rawEmail) ? rawEmail.toLowerCase() : "") : "";
    if (!email) {
      return NextResponse.json(
        { error: session ? "Помилка сесії. Увійдіть знову." : "Вкажіть email" },
        { status: 400 }
      );
    }
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (((event as { status?: string }).status ?? "approved") !== "approved") {
      return NextResponse.json({ error: "Event not available for tickets" }, { status: 403 });
    }

    const ticketTypes = await (prisma as unknown as { ticketType: { findMany: (args: { where: { eventId: string }; orderBy: { sortOrder: "asc" } }) => Promise<{ id: string; priceCents: number }[]> } }).ticketType.findMany({
      where: { eventId: event.id },
      orderBy: { sortOrder: "asc" },
    });

    let priceCents = event.priceCents;
    if (ticketTypeId) {
      const tt = ticketTypes.find((t: { id: string; priceCents: number }) => t.id === ticketTypeId);
      if (!tt) return NextResponse.json({ error: "Ticket type not found" }, { status: 400 });
      priceCents = tt.priceCents;
    } else if (ticketTypes.length > 0) {
      priceCents = ticketTypes[0].priceCents;
    }

    const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60 * 1000);
    const baseAmountCents = priceCents * quantity;

    const kValues = Array.from({ length: 99 }, (_, i) => i + 1);
    for (let i = kValues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [kValues[i], kValues[j]] = [kValues[j], kValues[i]];
    }

    for (const k of kValues) {
      const amountExpectedCents = baseAmountCents + k;
      try {
        const order = await prisma.order.create({
          data: {
            eventId: event.id,
            buyerEmail: email,
            quantity,
            amountExpectedCents,
            status: "awaiting_payment",
            expiresAt,
            ...(ticketTypeId ? { ticketTypeId } : {}),
          } as Parameters<typeof prisma.order.create>[0]["data"],
        });
        recordOrderCreateAttempt(ip);
        return NextResponse.json({
          orderId: order.id,
          amountExpectedCents,
          amountHuman: (amountExpectedCents / 100).toFixed(2),
          expiresAt: expiresAt.toISOString(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("quantity") || msg.includes("Unknown arg") || msg.includes("Invalid `prisma.order.create()`")) {
          break;
        }
        continue;
      }
    }

    for (const k of kValues) {
      const amountExpectedCents = baseAmountCents + k;
      try {
        const order = await prisma.order.create({
          data: {
            eventId: event.id,
            buyerEmail: email,
            quantity,
            amountExpectedCents,
            status: "awaiting_payment",
            expiresAt,
            ...(ticketTypeId ? { ticketTypeId } : {}),
          } as Parameters<typeof prisma.order.create>[0]["data"],
        });
        recordOrderCreateAttempt(ip);
        return NextResponse.json({
          orderId: order.id,
          amountExpectedCents,
          amountHuman: (amountExpectedCents / 100).toFixed(2),
          expiresAt: expiresAt.toISOString(),
        });
      } catch {
        continue;
      }
    }
    return NextResponse.json({ error: "No free amounts available" }, { status: 409 });
  } catch (e) {
    return NextResponse.json({ error: "Помилка створення замовлення" }, { status: 500 });
  }
}
