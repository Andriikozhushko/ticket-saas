import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSessionFromCookie();
    if (!session) return NextResponse.json({ user: null }, { status: 200 });
    return NextResponse.json({ user: { email: session.email, isAdmin: session.isAdmin } }, { status: 200 });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
