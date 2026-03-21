const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileVerifyResult = { success: true } | { success: false; error: string };

export async function verifyTurnstile(
  responseToken: string,
  remoteip?: string
): Promise<TurnstileVerifyResult> {
  if (process.env.NODE_ENV !== "production") {
    return { success: true };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set");
    return { success: false, error: "Captcha not configured" };
  }
  const body = new URLSearchParams({
    secret,
    response: responseToken,
    ...(remoteip ? { remoteip } : {}),
  });
  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
  if (data.success === true) return { success: true };
  const codes = data["error-codes"] ?? [];
  return { success: false, error: codes.length ? codes.join(", ") : "Captcha verification failed" };
}
