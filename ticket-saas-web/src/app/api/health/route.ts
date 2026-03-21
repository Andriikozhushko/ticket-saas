import { NextResponse } from "next/server";
import {
  getCaptchaHealth,
  getDatabaseHealth,
  getMailHealth,
  getMonobankHealth,
} from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDatabaseHealth();
  const mail = getMailHealth();
  const captcha = getCaptchaHealth();
  const monobank = getMonobankHealth();

  const dependencies = { db, mail, captcha, monobank };
  const hasBlockingIssue = db.status !== "ok";

  return NextResponse.json(
    {
      ok: !hasBlockingIssue,
      app: "ticket-saas-web",
      environment: process.env.NODE_ENV ?? "development",
      timestamp: new Date().toISOString(),
      dependencies,
    },
    { status: hasBlockingIssue ? 503 : 200 }
  );
}
