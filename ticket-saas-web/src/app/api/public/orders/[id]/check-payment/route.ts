import { NextResponse } from "next/server";
import {
  getOrderForPaymentSnapshot,
  isOrderExpired,
  isOrderPaid,
  refreshOrderPaymentSnapshot,
} from "@/lib/payments";

const SPAM_WINDOW_MS = 60_000;
const SPAM_MAX_REQUESTS = 3;
const orderCheckCount = new Map<string, { count: number; windowStart: number }>();

/**
 * Lightweight: read from DB, trigger shared poll for this source (cooldown-aware),
 * then re-read order and return. If user spams "Я оплатив", throttle this order for 1 min.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    const order = await getOrderForPaymentSnapshot(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (isOrderPaid(order)) {
      return NextResponse.json({ ok: true, paid: true });
    }

    if (!order.event?.org?.mono?.token || !order.event?.monoAccountId) {
      return NextResponse.json({ ok: true, paid: false, expired: isOrderExpired(order) });
    }

    const now = Date.now();
    const entry = orderCheckCount.get(orderId);
    if (entry) {
      if (now - entry.windowStart < SPAM_WINDOW_MS) {
        if (entry.count >= SPAM_MAX_REQUESTS) {
          return NextResponse.json({ ok: true, paid: false, stillChecking: true });
        }
        entry.count += 1;
      } else {
        orderCheckCount.set(orderId, { count: 1, windowStart: now });
      }
    } else {
      orderCheckCount.set(orderId, { count: 1, windowStart: now });
    }

    const refreshed = await refreshOrderPaymentSnapshot(orderId, true);
    if (!refreshed) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      paid: isOrderPaid(refreshed.order),
      expired: refreshed.snapshot.isExpired,
    });
  } catch {
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
