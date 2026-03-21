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
      return NextResponse.json({ error: rate.error ?? "Р—Р°Р±Р°РіР°С‚Рѕ Р·Р°РјРѕРІР»Рµнь." }, { status: 429 });
    }

    const session = await getSessionFromCookie();
    const raw = await req.json().catch(() => null);
    const parsed = createOrderBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "РќРµРІС–СЂРЅС– РґР°РЅС– Р·Р°РјРѕРІР»Рµння.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { eventId, email: rawEmail, ticketTypeId: rawTicketTypeId, quantity } = parsed.data;
    const ticketTypeId = rawTicketTypeId || null;
    const buyerEmail = resolveBuyerEmail(session?.email, rawEmail);
    if (!buyerEmail) {
      return NextResponse.json(
        { error: session ? "РџРѕРјРёР»РєР° СЃРµСЃС–С—. РЈРІС–Р№РґС–С‚ь Р·нову." : "Р’РєР°Р¶С–С‚ь email." },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return NextResponse.json({ error: "РџРѕРґС–СЋ РЅРµ Р·РЅР°Р№РґРµРЅРѕ." }, { status: 404 });
    if (((event as { status?: string }).status ?? "approved") !== "approved") {
      return NextResponse.json({ error: "РџСЂРѕРґР°Р¶ РєРІРёС‚РєС–РІ РЅР° С†СЋ РїРѕРґС–СЋ РЅРµРґРѕСЃС‚СѓРїРЅРёР№." }, { status: 403 });
    }

    let priceCents: number;
    try {
      priceCents = await resolveOrderPrice(event.id, event.priceCents, ticketTypeId);
    } catch (error) {
      if (error instanceof Error && error.message === "TICKET_TYPE_NOT_FOUND") {
        return NextResponse.json({ error: "Тип РєРІРёС‚РєР° РЅРµ Р·РЅР°Р№РґРµРЅРѕ." }, { status: 400 });
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
          { error: "РќР°СЂР°Р·С– РЅРµРјР°С” РІС–Р»СЊРЅРѕС— суми РґР»я РЅРѕРІРѕРіРѕ Р·Р°РјРѕРІР»Рµння. РЎРїСЂРѕР±СѓР№С‚Рµ С‰Рµ СЂР°Р·." },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch {
    return NextResponse.json({ error: "РџРѕРјРёР»РєР° СЃС‚РІРѕСЂРµння Р·Р°РјРѕРІР»Рµння." }, { status: 500 });
  }
}

