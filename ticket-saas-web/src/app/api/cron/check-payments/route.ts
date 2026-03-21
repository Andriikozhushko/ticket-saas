import { NextResponse } from "next/server";
import { runSharedPoll } from "@/lib/monobank-shared-poll";
import { expireAwaitingPaymentOrders, getPendingMonobankSources } from "@/lib/payments";

/**
 * Cron: periodically checks payments across all Monobank sources that still have pending orders.
 * Call externally every 1-2 minutes with Authorization: Bearer <CRON_SECRET>.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function checkCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  return token === secret;
}

export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCheckPayments();
}

export async function POST(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return runCheckPayments();
}

async function runCheckPayments() {
  try {
    const expiredCount = await expireAwaitingPaymentOrders();
    if (expiredCount > 0) {
      console.log("[cron/check-payments] marked expired count=%s", expiredCount);
    }

    const sources = await getPendingMonobankSources();
    const results: { key: string; matched: string[] }[] = [];

    for (const { key, token, accountId } of sources) {
      const result = await runSharedPoll(key, token, accountId);
      if (result.ok && result.matchedOrderIds.length > 0) {
        results.push({ key, matched: result.matchedOrderIds });
      }
    }

    return NextResponse.json({
      ok: true,
      sourcesChecked: sources.length,
      matched: results,
    });
  } catch (error) {
    console.error("[cron/check-payments]", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
