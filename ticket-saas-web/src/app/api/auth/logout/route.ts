import { NextResponse } from "next/server";
import { revokeSessionAndClearCookie } from "@/lib/auth";

export async function POST() {
  await revokeSessionAndClearCookie();
  return NextResponse.json({ ok: true });
}
