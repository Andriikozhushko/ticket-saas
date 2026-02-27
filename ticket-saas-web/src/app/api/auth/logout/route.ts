import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revokeSessionAndClearCookie } from "@/lib/auth";

const SESSION_COOKIE = "session_id";

export async function POST() {
  try {
    await revokeSessionAndClearCookie();
  } catch {
    const store = await cookies();
    store.delete(SESSION_COOKIE);
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
