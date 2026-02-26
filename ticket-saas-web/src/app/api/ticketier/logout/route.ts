import { NextResponse } from "next/server";
import { revokeTicketierSessionAndClearCookie } from "@/lib/auth";

export async function POST() {
  await revokeTicketierSessionAndClearCookie();
  return NextResponse.json({ ok: true });
}
