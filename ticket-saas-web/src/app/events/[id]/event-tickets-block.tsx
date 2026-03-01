"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Box, Button, Card, Group, Stack, Text, Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import QuantitySelector from "./quantity-selector";

const CODE_LENGTH = 6;

const ORDER_MODAL_STYLES = {
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
} as const;

const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const TURNSTILE_SITEKEY =
  process.env.NODE_ENV === "development"
    ? (process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "1x00000000000000000000AA")
    : (process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "");

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement | string, opts: { sitekey: string; theme?: string; callback: (token: string) => void; "expired-callback"?: () => void }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type TicketType = { id: string; name: string; priceCents: number };

type Props = {
  eventId: string;
  eventTitle: string;
  dateFormatted: string | null;
  currency: string;
  eventPriceCents: number;
  ticketTypes: TicketType[];
};

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function EventTicketsBlock({
  eventId,
  eventTitle,
  dateFormatted,
  currency,
  eventPriceCents,
  ticketTypes,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailFromSession, setEmailFromSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTicket, setActiveTicket] = useState<{ ticketTypeId: string; name: string; priceCents: number; quantity: number } | null>(null);
  const [activeTicketsFromBar, setActiveTicketsFromBar] = useState<{ ticketTypeId: string; name: string; priceCents: number; quantity: number }[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const narrow = useMediaQuery("(max-width: 420px)");
  const isMobile = useMediaQuery("(max-width: 560px)");
  const sessionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Без реєстрації: спочатку email → надіслати код → ввести код → підтвердити
  const [guestStep, setGuestStep] = useState<"email" | "code" | null>(null);
  const [guestCode, setGuestCode] = useState("");
  const [sendCodeLoading, setSendCodeLoading] = useState(false);
  const [verifyCodeLoading, setVerifyCodeLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const codeSingleRef = useRef<HTMLInputElement>(null);
  useEffect(() => setMounted(true), []);

  const getQty = (id: string) => quantities[id] ?? 1;
  const priceLabel = (cents: number) =>
    narrow && currency === "UAH" ? `${(cents / 100).toFixed(0)} грн` : `${money(cents)} ${currency}`;
  const setQty = (id: string, n: number) => setQuantities((q) => ({ ...q, [id]: n }));

  const refreshSessionEmail = () => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data: { user?: { email?: string } }) => {
        const sessionEmail = data?.user?.email?.trim() ?? "";
        if (sessionEmail) {
          setEmail(sessionEmail);
          setEmailFromSession(true);
        } else {
          setEmailFromSession(false);
        }
      })
      .catch(() => setEmailFromSession(false));
  };

  useEffect(() => {
    refreshSessionEmail();
  }, []);

  // Відкрили модалку без сесії — починаємо крок email
  useEffect(() => {
    if (open && !emailFromSession && guestStep === null) setGuestStep("email");
    if (!open) {
      setGuestStep(null);
      setGuestCode("");
      setTurnstileToken("");
      if (turnstileWidgetIdRef.current != null && typeof window !== "undefined" && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          /* ignore */
        }
        turnstileWidgetIdRef.current = null;
      }
    }
  }, [open, emailFromSession, guestStep]);

  // Turnstile для кроку "надіслати код" — читаємо ref у callback, щоб контейнер вже був у DOM
  useEffect(() => {
    if (!open || !guestStep || guestStep !== "email" || emailFromSession) return;
    if (!TURNSTILE_SITEKEY) return;
    let cancelled = false;
    const tryRender = () => {
      const container = turnstileContainerRef.current;
      if (!container || !window.turnstile || cancelled) return;
      if (turnstileWidgetIdRef.current != null) return;
      setTurnstileToken("");
      const id = window.turnstile.render(container, {
        sitekey: TURNSTILE_SITEKEY,
        theme: "light",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
      });
      turnstileWidgetIdRef.current = id;
    };
    const t = setTimeout(() => tryRender(), 400);
    if (!window.turnstile) {
      const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
      if (!existing) {
        const script = document.createElement("script");
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.onload = () => { if (!cancelled) tryRender(); };
        document.head.appendChild(script);
      }
    }
    return () => {
      cancelled = true;
      clearTimeout(t);
      const container = turnstileContainerRef.current;
      if (turnstileWidgetIdRef.current != null && window.turnstile && container && document.contains(container)) {
        try { window.turnstile.remove(turnstileWidgetIdRef.current); } catch { /* ignore */ }
        turnstileWidgetIdRef.current = null;
      }
      setTurnstileToken("");
    };
  }, [open, guestStep, emailFromSession]);

  const handleBuy = (t: TicketType, quantity: number) => {
    setActiveTicketsFromBar(null);
    setActiveTicket({ ticketTypeId: t.id, name: t.name, priceCents: t.priceCents, quantity });
    setError("");
    refreshSessionEmail();
    setOpen(true);
  };

  const selectedForBar = ticketTypes
    .map((t) => ({ t, qty: getQty(t.id) }))
    .filter(({ qty }) => qty > 0);
  const totalCentsBar = selectedForBar.reduce((sum, { t, qty }) => sum + t.priceCents * qty, 0);
  const openFromBar = () => {
    if (selectedForBar.length === 0) return;
    setActiveTicket(null);
    setActiveTicketsFromBar(
      selectedForBar.map(({ t, qty }) => ({ ticketTypeId: t.id, name: t.name, priceCents: t.priceCents, quantity: qty }))
    );
    setError("");
    refreshSessionEmail();
    setOpen(true);
  };

  const handleSendCode = async () => {
    const em = email.trim();
    if (!em) {
      setError("Вкажіть email");
      return;
    }
    if (process.env.NODE_ENV === "production" && !turnstileToken) {
      setError("Підтвердіть капчу або зачекайте її завантаження");
      return;
    }
    setError("");
    setSendCodeLoading(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, token: turnstileToken || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Помилка. Спробуйте пізніше.");
        return;
      }
      setTurnstileToken("");
      if (turnstileWidgetIdRef.current != null && typeof window !== "undefined" && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch {
          /* ignore */
        }
        turnstileWidgetIdRef.current = null;
      }
      setGuestStep("code");
      setGuestCode("");
      setTimeout(() => codeRefs.current[0]?.focus(), 80);
    } finally {
      setSendCodeLoading(false);
    }
  };

  const handleVerifyGuest = async () => {
    const em = email.trim();
    if (!em) return;
    const codeTrim = guestCode.replace(/\s/g, "").slice(0, 6);
    if (codeTrim.length !== 6) {
      setError("Введіть 6 цифр коду");
      return;
    }
    setError("");
    setVerifyCodeLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, code: codeTrim }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Невірний код. Спробуйте ще раз.");
        return;
      }
      await refreshSessionEmail();
      setGuestStep(null);
      setGuestCode("");
    } finally {
      setVerifyCodeLoading(false);
    }
  };

  const setCodeChar = useCallback((index: number, value: string) => {
    setGuestCode((prev) => {
      const arr = prev.split("");
      arr[index] = value.slice(-1);
      return arr.join("").slice(0, CODE_LENGTH);
    });
    if (value && index < CODE_LENGTH - 1) codeRefs.current[index + 1]?.focus();
  }, []);

  const handleCodeKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !guestCode[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
      setGuestCode((prev) => prev.slice(0, index));
    }
  }, [guestCode]);

  const handleCodePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    setGuestCode(pasted);
    const nextIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    codeRefs.current[nextIndex]?.focus();
  }, []);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Вкажіть email");
      return;
    }
    const toProcess = activeTicketsFromBar ?? (activeTicket ? [activeTicket] : []);
    if (toProcess.length === 0) return;
    setError("");
    setLoading(true);
    try {
      let firstOrderId: string | null = null;
      for (const item of toProcess) {
        const res = await fetch("/api/public/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            email: email.trim(),
            ...(item.ticketTypeId ? { ticketTypeId: item.ticketTypeId } : {}),
            quantity: item.quantity,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Помилка. Спробуйте пізніше.");
          return;
        }
        const orderId = (data as { orderId?: string }).orderId;
        if (orderId && !firstOrderId) firstOrderId = orderId;
      }
      setOpen(false);
      setActiveTicket(null);
      setActiveTicketsFromBar(null);
      if (firstOrderId) window.location.href = `/orders/${firstOrderId}`;
      else setError("Невірна відповідь сервера");
    } catch {
      setError("Сервер недоступний.");
    } finally {
      setLoading(false);
    }
  };

  if (ticketTypes.length === 0) {
    return (
      <>
        <Box className="event-tickets-section">
          <div className="event-tickets-header">
            <span className="event-tickets-header-title">Квитки</span>
            <span className="event-tickets-header-icon" aria-hidden>🎫</span>
          </div>
          <Card withBorder={false} padding="lg" radius="lg" className="event-ticket-card">
            <Box className="event-ticket-card-inner" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <Text className="event-ticket-name">Один тип квитка</Text>
              <Text size="sm" c="dimmed" mt={4}>{money(eventPriceCents)} {currency}</Text>
              <Button
                size="lg"
                mt="md"
                className="event-ticket-buy-btn"
                onClick={() => {
                  setActiveTicket({ ticketTypeId: "", name: "Квиток", priceCents: eventPriceCents, quantity: 1 });
                  setOpen(true);
                }}
              >
                Оформити
              </Button>
            </Box>
          </Card>
        </Box>
        <Modal
          opened={open}
          onClose={() => { setOpen(false); setActiveTicket(null); }}
          title="Оформити замовлення"
          centered
          size="sm"
          withCloseButton
          className="auth-modal"
          overlayProps={{ backgroundOpacity: 0.75, blur: 12 }}
          styles={ORDER_MODAL_STYLES}
          closeButtonProps={{ "aria-label": "Закрити", style: { width: 40, height: 40, minWidth: 40, minHeight: 40, borderRadius: 12, color: "var(--muted)", backgroundColor: "transparent" } }}
        >
          <Stack gap="xl" className="auth-form-stack">
            {error && (
              <Box className="auth-form-error">
                <Text size="sm" c="red" fw={600}>{error}</Text>
              </Box>
            )}
            {activeTicket && (
              <>
                <Text size="sm" fw={500} style={{ color: "var(--text)" }}>
                  {activeTicket.quantity === 1
                    ? `${activeTicket.name} — ${(activeTicket.priceCents / 100).toFixed(2)} ${currency}`
                    : `${activeTicket.name}, ${activeTicket.quantity} шт. — ${(activeTicket.priceCents * activeTicket.quantity / 100).toFixed(2)} ${currency}`}
                </Text>
                {emailFromSession && email ? (
                  <>
                    <Text size="sm" c="dimmed">
                      Квиток надішлемо на <Text span fw={600} c="var(--text)">{email}</Text>
                    </Text>
                    <Button onClick={handleSubmit} loading={loading} fullWidth size="md" className="auth-form-submit">
                      Підтвердити
                    </Button>
                  </>
                ) : guestStep === "code" ? (
                  <>
                    <Text size="sm" c="dimmed">
                      Код надіслано на <Text span fw={600} c="var(--text)">{email}</Text>
                    </Text>
                    <Box>
                      <Text size="sm" fw={600} mb={10} style={{ letterSpacing: "0.02em" }}>Введіть 6 цифр</Text>
                      <Group gap={8} justify="center" wrap="nowrap" onPaste={handleCodePaste} className="auth-code-row auth-code-desktop">
                        {Array.from({ length: CODE_LENGTH }, (_, i) => (
                          <input
                            key={i}
                            ref={(el) => { codeRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={1}
                            value={guestCode[i] ?? ""}
                            onChange={(e) => setCodeChar(i, e.target.value.replace(/\D/g, ""))}
                            onKeyDown={(e) => handleCodeKeyDown(i, e)}
                            className="otp-cell auth-form-input"
                            aria-label={`Цифра ${i + 1}`}
                            style={{ color: "#f4f4f6", WebkitTextFillColor: "#f4f4f6" }}
                          />
                        ))}
                      </Group>
                      <Box className="auth-code-mobile" onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH); if (t) setGuestCode(t); }}>
                        <input
                          ref={codeSingleRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={CODE_LENGTH}
                          value={guestCode}
                          onChange={(e) => setGuestCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                          className="auth-form-input otp-single"
                          aria-label="Код з 6 цифр"
                          style={{ color: "#f4f4f6", WebkitTextFillColor: "#f4f4f6" }}
                        />
                      </Box>
                    </Box>
                    <Button
                      onClick={handleVerifyGuest}
                      loading={verifyCodeLoading}
                      disabled={guestCode.length !== CODE_LENGTH}
                      fullWidth
                      size="md"
                      className="auth-form-submit"
                    >
                      Підтвердити email
                    </Button>
                  </>
                ) : (
                  <>
                    <Box>
                      <Text size="sm" fw={700} mb={10} style={{ letterSpacing: "0.04em", color: "var(--muted)" }}>Email для квитка</Text>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(""); }}
                        onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                        className="auth-form-input"
                      />
                    </Box>
                    <div className="turnstile-outer">
                      <Box ref={turnstileContainerRef} className="turnstile-container" />
                    </div>
                    <Button
                      onClick={handleSendCode}
                      loading={sendCodeLoading}
                      disabled={!email.trim() || (process.env.NODE_ENV === "production" && !turnstileToken)}
                      fullWidth
                      size="md"
                      className="auth-form-submit"
                    >
                      Надіслати код на пошту
                    </Button>
                  </>
                )}
              </>
            )}
          </Stack>
        </Modal>
      </>
    );
  }

  return (
    <>
      <Box className="event-tickets-section">
        <div className="event-tickets-header">
          <span className="event-tickets-header-title">Квитки</span>
          <span className="event-tickets-header-icon" aria-hidden>🎫</span>
        </div>
        <Stack gap="md" className="event-tickets-list">
          {ticketTypes.map((t) => {
            const qty = getQty(t.id);
            const totalCents = t.priceCents * qty;
            return (
              <Card
                key={t.id}
                withBorder={false}
                padding="lg"
                radius="lg"
                className="event-ticket-card"
              >
                <Box className="event-ticket-card-inner">
                  <div className="event-ticket-desktop-info">
                    <span className="event-ticket-desktop-title">{t.name}</span>
                    {dateFormatted && (
                      <span className="event-ticket-desktop-date">{dateFormatted}</span>
                    )}
                  </div>
                  <Box className="event-ticket-first-row">
                    <Text component="span" className="event-ticket-name">
                      {t.name}
                    </Text>
                    <QuantitySelector value={qty} onChange={(n) => setQty(t.id, n)} />
                    <Text component="span" className="event-ticket-price event-ticket-price-in-card" title={`${money(totalCents)} ${currency}`}>
                      {priceLabel(totalCents)}
                    </Text>
                    <Button
                      size="md"
                      className="event-ticket-buy-btn event-ticket-buy-btn-in-card"
                      onClick={() => handleBuy(t, qty)}
                    >
                      Оформити
                    </Button>
                  </Box>
                </Box>
              </Card>
            );
          })}
        </Stack>

        {mounted && isMobile && createPortal(
            <div className="event-tickets-bar" role="region" aria-label="Підсумок замовлення">
              <div>
                {selectedForBar.length === 0 ? (
                  <span className="event-tickets-bar-total event-tickets-bar-total-empty">Оберіть квитки</span>
                ) : (
                  <>
                    <span className="event-tickets-bar-total">Разом</span>
                    <span className="event-tickets-bar-total-amount">
                      {narrow && currency === "UAH"
                        ? `${(totalCentsBar / 100).toFixed(0)} грн`
                        : `${(totalCentsBar / 100).toFixed(2)} ${currency}`}
                    </span>
                  </>
                )}
              </div>
              <Button
                className="event-ticket-buy-btn"
                disabled={selectedForBar.length === 0}
                onClick={openFromBar}
              >
                Оформити
              </Button>
            </div>,
            document.body
          )}
      </Box>

      <Modal
        opened={open}
        onClose={() => { setOpen(false); setActiveTicket(null); setActiveTicketsFromBar(null); }}
        title="Оформити замовлення"
        centered
        size="sm"
        withCloseButton
        className="auth-modal"
        overlayProps={{ backgroundOpacity: 0.75, blur: 12 }}
        styles={ORDER_MODAL_STYLES}
        closeButtonProps={{ "aria-label": "Закрити", style: { width: 40, height: 40, minWidth: 40, minHeight: 40, borderRadius: 12, color: "var(--muted)", backgroundColor: "transparent" } }}
      >
        <Stack gap="xl" className="auth-form-stack">
          {error && (
            <Box className="auth-form-error">
              <Text size="sm" c="red" fw={600}>{error}</Text>
            </Box>
          )}
          {(activeTicketsFromBar?.length ? activeTicketsFromBar : activeTicket ? [activeTicket] : []).map((item) => (
            <Text key={item.ticketTypeId + item.quantity} size="sm" fw={500} style={{ color: "var(--text)" }}>
              {item.quantity === 1
                ? `${item.name} — ${(item.priceCents / 100).toFixed(2)} ${currency}`
                : `${item.name}, ${item.quantity} шт. — ${(item.priceCents * item.quantity / 100).toFixed(2)} ${currency}`}
            </Text>
          ))}
          {((activeTicketsFromBar?.length ?? 0) > 0 || activeTicket) && (
            <>
              {emailFromSession && email ? (
                <>
                  <Text size="sm" c="dimmed">
                    Квиток надішлемо на <Text span fw={600} c="var(--text)">{email}</Text>
                  </Text>
                  <Button onClick={handleSubmit} loading={loading} fullWidth size="md" className="auth-form-submit">
                    Підтвердити
                  </Button>
                </>
              ) : guestStep === "code" ? (
                <>
                  <Text size="sm" c="dimmed">
                    Код надіслано на <Text span fw={600} c="var(--text)">{email}</Text>
                  </Text>
                  <Box>
                    <Text size="sm" fw={600} mb={10} style={{ letterSpacing: "0.02em" }}>Введіть 6 цифр</Text>
                    <Group gap={8} justify="center" wrap="nowrap" onPaste={handleCodePaste} className="auth-code-row auth-code-desktop">
                      {Array.from({ length: CODE_LENGTH }, (_, i) => (
                        <input
                          key={i}
                          ref={(el) => { codeRefs.current[i] = el; }}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={1}
                          value={guestCode[i] ?? ""}
                          onChange={(e) => setCodeChar(i, e.target.value.replace(/\D/g, ""))}
                          onKeyDown={(e) => handleCodeKeyDown(i, e)}
                          className="otp-cell auth-form-input"
                          aria-label={`Цифра ${i + 1}`}
                          style={{ color: "#f4f4f6", WebkitTextFillColor: "#f4f4f6" }}
                        />
                      ))}
                    </Group>
                    <Box className="auth-code-mobile" onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH); if (t) setGuestCode(t); }}>
                      <input
                        ref={codeSingleRef}
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={CODE_LENGTH}
                        value={guestCode}
                        onChange={(e) => setGuestCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
                        className="auth-form-input otp-single"
                        aria-label="Код з 6 цифр"
                        style={{ color: "#f4f4f6", WebkitTextFillColor: "#f4f4f6" }}
                      />
                    </Box>
                  </Box>
                  <Button
                    onClick={handleVerifyGuest}
                    loading={verifyCodeLoading}
                    disabled={guestCode.length !== CODE_LENGTH}
                    fullWidth
                    size="md"
                    className="auth-form-submit"
                  >
                    Підтвердити email
                  </Button>
                </>
              ) : (
                <>
                  <Box>
                    <Text size="sm" fw={700} mb={10} style={{ letterSpacing: "0.04em", color: "var(--muted)" }}>Email для квитка(ів)</Text>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                      className="auth-form-input"
                    />
                  </Box>
                  <div className="turnstile-outer">
                    <Box ref={turnstileContainerRef} className="turnstile-container" />
                  </div>
                  <Button
                    onClick={handleSendCode}
                    loading={sendCodeLoading}
                    disabled={!email.trim() || (process.env.NODE_ENV === "production" && !turnstileToken)}
                    fullWidth
                    size="md"
                    className="auth-form-submit"
                  >
                    Надіслати код на пошту
                  </Button>
                </>
              )}
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
