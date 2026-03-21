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
      const msg = parsed.error.issues[0]?.message ?? "Введіть коректний email.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, token } = parsed.data;
    if (!token?.trim() && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Підтвердіть капчу." }, { status: 400 });
    }

    const rate = checkLoginRateLimit(ip, email);
    if (!rate.allowed) {
      return NextResponse.json({ error: rate.error ?? "Забагато спроб." }, { status: 429 });
    }

    const turnstile = await verifyTurnstile(token ?? "", ip);
    if (!turnstile.success) {
      const isNotConfigured = turnstile.error === "Captcha not configured";
      return NextResponse.json(
        {
          error: isNotConfigured
            ? "Капча не налаштована на сервері. Додайте TURNSTILE_SECRET_KEY у .env."
            : "Перевірка капчі не пройшла.",
        },
        { status: isNotConfigured ? 503 : 400 }
      );
    }

    recordLoginAttempt(ip, email);

    const code = await createAuthCode(email);
    const sent = await sendEmail({
      to: email,
      subject: "Код входу Lizard.red",
      textContent: `Ваш код: ${code}. Діє 5 хвилин.`,
      htmlContent: `<p>Ваш код входу: <strong>${code}</strong></p><p>Код дійсний 5 хвилин.</p>`,
    });

    if (!sent.ok) {
      return NextResponse.json(
        { error: "Не вдалося надіслати код. Спробуйте трохи пізніше." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth/send-code]", error);
    const formatted = formatRouteError(error, "Помилка відправки коду.");
    return NextResponse.json({ error: formatted.message }, { status: formatted.status });
  }
}
