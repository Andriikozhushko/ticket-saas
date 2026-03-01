import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSharedPoll, sourceKey } from "@/lib/monobank-shared-poll";

/**
 * Cron: періодично перевіряє оплати по всіх джерелах Monobank з очікуючими замовленнями.
 * Навіть якщо сайт "закритий" (ніхто не на сторінці), оплата буде підтверджена в БД.
 * Викликати ззовні (cron) кожні 1–2 хв з заголовком Authorization: Bearer <CRON_SECRET>.
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
    const now = new Date();
    const orders = await prisma.order.findMany({
      where: {
        status: "awaiting_payment",
        expiresAt: { gt: now },
        event: {
          monoAccountId: { not: null },
          org: { mono: { isNot: null } },
        },
      },
      select: {
        event: {
          select: {
            orgId: true,
            monoAccountId: true,
            org: { select: { mono: { select: { token: true } } } },
          },
        },
      },
    });

    const sources = new Map<string, { token: string; accountId: string }>();
    for (const o of orders) {
      const ev = o.event as {
        orgId: string;
        monoAccountId: string | null;
        org?: { mono?: { token: string } | null };
      };
      if (!ev?.orgId || !ev?.monoAccountId || !ev?.org?.mono?.token) continue;
      const key = sourceKey(ev.orgId, ev.monoAccountId);
      if (!sources.has(key)) {
        sources.set(key, { token: ev.org.mono.token, accountId: ev.monoAccountId });
      }
    }

    const results: { key: string; matched: string[] }[] = [];
    for (const [key, { token, accountId }] of sources) {
      const result = await runSharedPoll(key, token, accountId);
      if (result.ok && result.matchedOrderIds?.length) {
        results.push({ key, matched: result.matchedOrderIds });
      }
    }

    return NextResponse.json({
      ok: true,
      sourcesChecked: sources.size,
      matched: results,
    });
  } catch (e) {
    console.error("[cron/check-payments]", e);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
