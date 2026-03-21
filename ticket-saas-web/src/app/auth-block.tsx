"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Button, Group, Modal, Stack, Text, Box } from "@mantine/core";
import { useAuthOpen } from "./auth-open-context";

const CODE_LENGTH = 6;
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const TURNSTILE_SITEKEY =
  process.env.NODE_ENV === "development"
    ? (process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "1x00000000000000000000AA")
    : (process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "");
const IS_DEV = process.env.NODE_ENV !== "production";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement | string, opts: { sitekey: string; theme?: string; callback: (token: string) => void; "expired-callback"?: () => void }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const linkStyle = {
  display: "inline-flex",
  alignItems: "center",
  textDecoration: "none" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  fontWeight: 600,
  color: "var(--text)",
};

type AuthBlockProps = {
  initialUser?: { email: string; isAdmin: boolean } | null;
};

export default function AuthBlock({ initialUser = null }: AuthBlockProps) {
  const { open, openAuth, closeAuth, user, setUser } = useAuthOpen();
  const [loading, setLoading] = useState(initialUser === undefined);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [error, setError] = useState("");
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const codeSingleRef = useRef<HTMLInputElement>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileCodeContainerRef = useRef<HTMLDivElement>(null);
  const [failedCodeAttempts, setFailedCodeAttempts] = useState(0);

  const [sessionError, setSessionError] = useState(false);

  const loadSession = useCallback(() => {
    setSessionError(false);
    fetch("/api/auth/session")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.error ?? "Session check failed");
        }
        return data;
      })
      .then((data) => {
        const u = data.user ?? null;
        setUser(u);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setSessionError(true); });
  }, [setUser]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const needCaptchaOnCodeStep = !IS_DEV && failedCodeAttempts >= 3;
  const showTurnstile = !IS_DEV && open && (step === "email" || (step === "code" && needCaptchaOnCodeStep));

  useEffect(() => {
    if (!showTurnstile) {
      turnstileWidgetIdRef.current = null;
      setTurnstileToken("");
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let rendered = false;
    const doRender = (container: HTMLDivElement) => {
      if (!window.turnstile || !container || cancelled) return;
      if (rendered) return;
      const prevId = turnstileWidgetIdRef.current;
      turnstileWidgetIdRef.current = null;
      if (prevId != null) {
        try {
          if (document.contains(container)) {
            window.turnstile.remove(prevId);
          }
        } catch {
          /* ignore */
        }
      }
      setTurnstileToken("");
      const id = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITEKEY,
        theme: "light",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
      });
      turnstileWidgetIdRef.current = id;
      rendered = true;
    };
    const tryRender = () => {
      const container = step === "email" ? turnstileContainerRef.current : turnstileCodeContainerRef.current;
      if (!container) return false;
      doRender(container);
      return rendered || turnstileWidgetIdRef.current != null;
    };
    const retryRender = (attempt = 0) => {
      if (cancelled) return;
      const ok = tryRender();
      if (ok) return;
      if (attempt >= 40) return;
      retryTimer = setTimeout(() => retryRender(attempt + 1), 150);
    };

    retryRender();

    if (!window.turnstile) {
      const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
      if (!existing) {
        const script = document.createElement("script");
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.onload = () => { if (!cancelled) retryRender(); };
        document.head.appendChild(script);
      }
    }
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      turnstileWidgetIdRef.current = null;
      setTurnstileToken("");
    };
  }, [showTurnstile, step]);

  const handleSendCode = async () => {
    setError("");
    if (!IS_DEV && !turnstileToken) {
      setError("Підтвердіть капчу");
      return;
    }
    setSendLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), token: turnstileToken }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Помилка"); return; }
      setTurnstileToken("");
      if (turnstileWidgetIdRef.current != null && window.turnstile) {
        try { window.turnstile.remove(turnstileWidgetIdRef.current); } catch { /* ignore */ }
        turnstileWidgetIdRef.current = null;
      }
      setStep("code");
      setCode("");
      setFailedCodeAttempts(0);
      setTimeout(() => codeRefs.current[0]?.focus(), 80);
    } finally {
      setSendLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setVerifyLoading(true);
    const hadCaptchaRequired = failedCodeAttempts >= 3;
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error ?? "Помилка";
        setError(errMsg);
        if (errMsg.includes("Вичерпано") || errMsg.includes("спроб")) {
          setStep("email");
          setCode("");
          setTurnstileToken("");
          setFailedCodeAttempts(0);
          return;
        }
        setFailedCodeAttempts((prev) => prev + 1);
        if (hadCaptchaRequired || failedCodeAttempts === 2) {
          setTurnstileToken("");
          if (turnstileWidgetIdRef.current != null && window.turnstile) {
            try { window.turnstile.reset(turnstileWidgetIdRef.current); } catch { /* ignore */ }
          }
        }
        return;
      }
      closeAuth();
      setStep("email");
      setCode("");
      setFailedCodeAttempts(0);
      loadSession();
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  const setCodeChar = useCallback((index: number, value: string) => {
    setCode((prev) => {
      const arr = prev.split("");
      arr[index] = value.slice(-1);
      const next = arr.join("").slice(0, CODE_LENGTH);
      return next;
    });
    if (value && index < CODE_LENGTH - 1) codeRefs.current[index + 1]?.focus();
  }, []);

  const handleCodeKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
      setCode((prev) => prev.slice(0, index));
    }
  }, [code]);

  const handleCodePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    setCode(pasted);
    const nextIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    codeRefs.current[nextIndex]?.focus();
  }, []);

  if (loading) {
    return (
      <Button variant="subtle" color="gray" style={linkStyle} disabled>
        ...
      </Button>
    );
  }

  if (user) {
    return (
      <Group gap={12}>
        {user.isAdmin && (
          <Button component={Link} href="/admin" variant="light" color="blue" style={linkStyle}>
            Адмін
          </Button>
        )}
        <Text size="sm" c="dimmed" visibleFrom="sm">{user.email}</Text>
        <Button variant="outline" color="gray" style={linkStyle} onClick={handleLogout}>
          Вийти
        </Button>
      </Group>
    );
  }

  return (
    <>
      <Group gap={8} wrap="wrap" align="center">
        <Button variant="subtle" color="blue" style={linkStyle} onClick={() => { setError(""); setEmail(""); setCode(""); setStep("email"); openAuth(); }}>
          Увійти
        </Button>
        {sessionError && (
          <Text size="xs" c="dimmed" component="span">
            <Button variant="subtle" size="xs" onClick={loadSession} style={{ padding: "0 6px", minHeight: "auto", height: "auto" }}>
              Повторити
            </Button>
          </Text>
        )}
      </Group>
      <Modal
        opened={open}
        onClose={closeAuth}
        centered
        size="sm"
        withCloseButton
        className="auth-modal"
        overlayProps={{
          backgroundOpacity: 0.75,
          blur: 12,
        }}
        styles={{
          content: {
            background: "linear-gradient(165deg, rgba(10,10,16,0.98) 0%, rgba(6,6,12,0.99) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 0 0 1px rgba(239,68,68,0.12), 0 24px 56px -16px rgba(0,0,0,0.6), 0 0 60px -16px rgba(239,68,68,0.12)",
            borderRadius: 20,
            overflow: "hidden",
          },
          header: {
            background: "transparent",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            padding: "20px 24px 20px 28px",
            margin: 0,
          },
          title: {
            fontWeight: 800,
            letterSpacing: "-0.03em",
            fontSize: "1.35rem",
            background: "var(--gradient-text)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          },
          body: { paddingTop: 24, paddingLeft: 28, paddingRight: 28, paddingBottom: 28 },
        }}
        closeButtonProps={{
          "aria-label": "Закрити",
          style: {
            width: 40,
            height: 40,
            minWidth: 40,
            minHeight: 40,
            borderRadius: 12,
            color: "var(--muted)",
            backgroundColor: "transparent",
          },
        }}
        title="Вхід"
      >
        <Stack gap="xl" className="auth-form-stack">
          {error && (
            <Box className="auth-form-error">
              <Text size="sm" c="red" fw={600}>{error}</Text>
            </Box>
          )}

          {step === "email" ? (
            <>
              <Box>
                <Text size="sm" fw={700} mb={10} style={{ letterSpacing: "0.04em", color: "var(--muted)" }}>Email</Text>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                  className="auth-form-input"
                />
              </Box>
              <div className="turnstile-outer">
                <Box ref={turnstileContainerRef} className="turnstile-container" />
              </div>
              <Button
                onClick={handleSendCode}
                loading={sendLoading}
                disabled={!IS_DEV && !turnstileToken}
                fullWidth
                size="md"
                className="auth-form-submit"
              >
                Отримати код
              </Button>
            </>
          ) : (
            <>
              <Text size="sm" c="dimmed">Код надіслано на <Text span fw={600} c="var(--text)">{email}</Text></Text>
              <Box>
                <Text size="sm" fw={600} mb={10} style={{ letterSpacing: "0.02em" }}>Введіть 6 цифр</Text>
                {/* Десктоп: 6 окремих полів */}
                <Group gap={8} justify="center" wrap="nowrap" onPaste={handleCodePaste} className="auth-code-row auth-code-desktop">
                  {Array.from({ length: CODE_LENGTH }, (_, i) => (
                    <input
                      key={i}
                      ref={(el) => { codeRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={code[i] ?? ""}
                      onChange={(e) => setCodeChar(i, e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => handleCodeKeyDown(i, e)}
                      className="otp-cell auth-form-input"
                      aria-label={`Цифра ${i + 1}`}
                      style={{ color: "#f4f4f6", WebkitTextFillColor: "#f4f4f6" }}
                    />
                  ))}
                </Group>
                {/* Мобільний: одне поле на 6 цифр */}
                <Box className="auth-code-mobile" onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH); if (t) setCode(t); }}>
                  <input
                    ref={codeSingleRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={CODE_LENGTH}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                    className="auth-form-input otp-single"
                    aria-label="Код з 6 цифр"
                    style={{ color: "#f4f4f6", WebkitTextFillColor: "#f4f4f6" }}
                  />
                </Box>
              </Box>
              {needCaptchaOnCodeStep && (
                <>
                  <Text size="xs" c="dimmed" mb={4}>Пройдіть капчу для наступної спроби</Text>
                  <div className="turnstile-outer">
                    <Box ref={turnstileCodeContainerRef} className="turnstile-container" />
                  </div>
                </>
              )}
              <Button
                onClick={handleVerify}
                loading={verifyLoading}
                disabled={code.length !== CODE_LENGTH || (needCaptchaOnCodeStep && !turnstileToken)}
                fullWidth
                size="md"
                className="auth-form-submit"
                style={{
                  background: (code.length === CODE_LENGTH && (!needCaptchaOnCodeStep || turnstileToken)) ? undefined : "var(--panel2)",
                  border: "none",
                  color: (code.length === CODE_LENGTH && (!needCaptchaOnCodeStep || turnstileToken)) ? "#030304" : "var(--muted)",
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  boxShadow: (code.length === CODE_LENGTH && (!needCaptchaOnCodeStep || turnstileToken)) ? "0 0 32px -6px rgba(239,68,68,0.5), 0 4px 20px rgba(239,68,68,0.25)" : "none",
                  transition: "transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease",
                }}
              >
                Увійти
              </Button>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
