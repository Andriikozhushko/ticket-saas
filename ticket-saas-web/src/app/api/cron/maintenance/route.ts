import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance";

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

  return executeMaintenance();
}

export async function POST(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return executeMaintenance();
}

async function executeMaintenance() {
  try {
    const summary = await runMaintenance();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("[cron/maintenance]", error);
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}
