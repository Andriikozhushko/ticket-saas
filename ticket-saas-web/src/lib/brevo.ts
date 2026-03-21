const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export type SendEmailOptions = {
  to: string;
  subject: string;
  textContent?: string;
  htmlContent?: string;
};

export async function sendEmail(options: SendEmailOptions): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "noreply@lizard.red";
  const senderName = process.env.BREVO_SENDER_NAME ?? "Lizard.red";
  const text = options.textContent ?? options.htmlContent?.replace(/<[^>]*>/g, "") ?? "";

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.log("[brevo] DEV (no API key): email not sent. Recipient:", options.to);
      console.log("[brevo] DEV content:", text.trim());
      return { ok: true };
    }
    console.error("[brevo] BREVO_API_KEY is not set");
    return { ok: false, error: "Email not configured" };
  }

  const body = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: options.to }],
    subject: options.subject,
    ...(options.htmlContent ? { htmlContent: options.htmlContent } : {}),
    ...(options.textContent ? { textContent: options.textContent } : {}),
  };

  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = (data as { message?: string }).message ?? res.statusText;
      console.error("[brevo] send failed:", res.status, msg);
      return { ok: false, error: msg };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brevo] send error:", msg);
    if (process.env.NODE_ENV !== "production") {
      console.log("[brevo] DEV fallback after send error. Recipient:", options.to);
      console.log("[brevo] DEV fallback content:", text.trim());
      return { ok: true };
    }
    return { ok: false, error: msg };
  }
}
