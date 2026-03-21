import { NextResponse } from "next/server";
import { verifyAuthCode, createSession, setSessionCookie } from "@/lib/auth";
import { checkVerifyRateLimit, recordVerifyAttempt, getClientIp } from "@/lib/rate-limit";
import { verifyBodySchema } from "@/lib/schemas/auth";
import { formatRouteError } from "@/lib/runtime";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rate = checkVerifyRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.error ?? "Забагато спроб." }, { status: 429 });
    }

    const raw = await req.json().catch(() => null);
    const parsed = verifyBodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Вкажіть email і код.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, code } = parsed.data;
    const result = await verifyAuthCode(email, code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    recordVerifyAttempt(ip);
    const sessionId = await createSession(result.userId);
    await setSessionCookie(sessionId);
    return NextResponse.json({ ok: true, isAdmin: result.isAdmin });
  } catch (error) {
    console.error("[auth/verify]", error);
    const formatted = formatRouteError(error, "Помилка входу.");
    return NextResponse.json({ error: formatted.message }, { status: formatted.status });
  }
}
