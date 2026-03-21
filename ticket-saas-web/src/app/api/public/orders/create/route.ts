import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromCookie } from "@/lib/auth";
import { checkOrderCreateRateLimit, recordOrderCreateAttempt, getClientIp } from "@/lib/rate-limit";
import { createOrderBodySchema } from "@/lib/schemas/orders";
import {
  createAwaitingPaymentOrder,
  resolveBuyerEmail,
  resolveOrderPrice,
} from "@/lib/orders";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rate = checkOrderCreateRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.error ?? "Забагато замовлень." }, { status: 429 });
    }

    const session = await getSessionFromCookie();
    const raw = await req.json().catch(() => null);
    const parsed = createOrderBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Невірні дані замовлення.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { eventId, email: rawEmail, ticketTypeId: rawTicketTypeId, quantity } = parsed.data;
    const ticketTypeId = rawTicketTypeId || null;
    const buyerEmail = resolveBuyerEmail(session?.email, rawEmail);
    if (!buyerEmail) {
      return NextResponse.json(
        { error: session ? "Помилка сесії. Увійдіть знову." : "Вкажіть email." },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return NextResponse.json({ error: "Подію не знайдено." }, { status: 404 });
    if (((event as { status?: string }).status ?? "approved") !== "approved") {
      return NextResponse.json({ error: "Продаж квитків на цю подію недоступний." }, { status: 403 });
    }

    let priceCents: number;
    try {
      priceCents = await resolveOrderPrice(event.id, event.priceCents, ticketTypeId);
    } catch (error) {
      if (error instanceof Error && error.message === "TICKET_TYPE_NOT_FOUND") {
        return NextResponse.json({ error: "Тип квитка не знайдено." }, { status: 400 });
      }
      throw error;
    }

    try {
      const result = await createAwaitingPaymentOrder({
        eventId: event.id,
        buyerEmail,
        quantity,
        ticketTypeId,
        priceCents,
      });
      recordOrderCreateAttempt(ip);
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "NO_FREE_AMOUNTS") {
        return NextResponse.json(
          { error: "Наразі немає вільної суми для нового замовлення. Спробуйте ще раз." },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch {
    return NextResponse.json({ error: "Помилка створення замовлення." }, { status: 500 });
  }
}
