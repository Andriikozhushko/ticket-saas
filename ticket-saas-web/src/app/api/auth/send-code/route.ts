import { NextResponse } from "next/server";
import { createAuthCode } from "@/lib/auth";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkLoginRateLimit, recordLoginAttempt, getClientIp } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/brevo";
import { sendCodeBodySchema } from "@/lib/schemas/auth";
import { formatRouteError } from "@/lib/runtime";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const raw = await req.json().catch(() => null);
    const parsed = sendCodeBodySchema.safeParse(raw);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Р’РІРµРґС–С‚ь РєРѕСЂРµРєС‚РЅРёР№ email.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, token } = parsed.data;
    if (!token?.trim() && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "РџС–РґС‚РІРµСЂРґС–С‚ь РєР°РїС‡Сѓ." }, { status: 400 });
    }

    const rate = checkLoginRateLimit(ip, email);
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.error ?? "Р—Р°Р±Р°РіР°С‚Рѕ СЃРїСЂРѕР±." }, { status: 429 });
    }

    const turnstile = await verifyTurnstile(token ?? "", ip);
    if (!turnstile.success) {
      const isNotConfigured = turnstile.error === "Captcha not configured";
      return NextResponse.json(
        {
          error: isNotConfigured
            ? "РљР°РїС‡Р° РЅРµ РЅР°Р»Р°С€С‚РѕРІР°РЅР° РЅР° СЃРµСЂРІРµСЂС–. Р”РѕРґР°Р№С‚Рµ TURNSTILE_SECRET_KEY Сѓ .env."
            : "РџРµСЂРµРІС–СЂРєР° РєР°РїС‡С– РЅРµ РїСЂРѕР№С€Р»Р°.",
        },
        { status: isNotConfigured ? 503 : 400 }
      );
    }

    recordLoginAttempt(ip, email);

    const code = await createAuthCode(email);
    const sent = await sendEmail({
      to: email,
      subject: "Код РІС…оду Lizard.red",
      textContent: `Р’Р°С€ РєРѕРґ: ${code}. Р”С–С” 5 С…РІРёР»РёРЅ.`,
      htmlContent: `<p>Р’Р°С€ РєРѕРґ РІС…оду: <strong>${code}</strong></p><p>Код РґС–Р№СЃРЅРёР№ 5 С…РІРёР»РёРЅ.</p>`,
    });

    if (!sent.ok) {
      return NextResponse.json(
        { error: "РќРµ РІРґР°Р»ося РЅР°РґС–СЃР»Р°С‚Рё РєРѕРґ. РЎРїСЂРѕР±СѓР№С‚Рµ С‚СЂРѕС…Рё РїС–Р·РЅС–С€Рµ." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/send-code]", error);
    const formatted = formatRouteError(error, "РџРѕРјРёР»РєР° РІС–РґРїСЂР°РІРєРё коду.");
    return NextResponse.json({ error: formatted.message }, { status: formatted.status });
  }
}

