import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSharedPoll, sourceKey } from "@/lib/monobank-shared-poll";

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
    const nowDate = new Date();
    if (order.expiresAt < nowDate) {
      return NextResponse.json({ ok: true, paid: false, expired: true });
    }
    const event = order.event as {
      orgId: string;
      monoAccountId?: string | null;
      org?: { mono?: { token: string } | null };
    };
    const mono = event.org?.mono;
    if (!mono?.token || !event?.monoAccountId) {
      return NextResponse.json({ ok: true, paid: false });
    }

    const now = Date.now();
    const entry = orderCheckCount.get(orderId);
    if (entry) {
      if (now - entry.windowStart < SPAM_WINDOW_MS) {
        if (entry.count >= SPAM_MAX_REQUESTS) {
          return NextResponse.json({ ok: true, paid: false, stillChecking: true });
        }
        entry.count++;
      } else {
        orderCheckCount.set(orderId, { count: 1, windowStart: now });
      }
    } else {
      orderCheckCount.set(orderId, { count: 1, windowStart: now });
    }

    const key = sourceKey(event.orgId, event.monoAccountId);
    const result = await runSharedPoll(key, mono.token, event.monoAccountId);

    if (!result.ok && result.stillChecking) {
      return NextResponse.json({ ok: true, paid: false, stillChecking: true });
    }
    if (!result.ok) {
      return NextResponse.json({ ok: true, paid: false });
    }

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true, tickets: true },
    });
    const paid = !!(updated?.payment || (updated?.tickets && updated.tickets.length > 0));
    return NextResponse.json({ ok: true, paid });
  } catch (e) {
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
