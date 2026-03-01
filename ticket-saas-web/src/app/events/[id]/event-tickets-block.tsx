"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Box, Button, Card, Group, Stack, Text, Modal, TextInput } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useAuthOpen } from "@/app/auth-open-context";
import QuantitySelector from "./quantity-selector";

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
  const { openAuth } = useAuthOpen();
  const sessionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Після підтвердження email у auth-модалці — підтягуємо сесію в цьому модалі
  useEffect(() => {
    if (!open) {
      if (sessionPollRef.current) {
        clearInterval(sessionPollRef.current);
        sessionPollRef.current = null;
      }
      return;
    }
    if (emailFromSession && email) return;
    sessionPollRef.current = setInterval(refreshSessionEmail, 2000);
    return () => {
      if (sessionPollRef.current) {
        clearInterval(sessionPollRef.current);
        sessionPollRef.current = null;
      }
    };
  }, [open, emailFromSession, email]);

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
          styles={{ header: { borderBottom: "1px solid var(--border)" }, body: { padding: 24 } }}
        >
          <Stack gap="md">
            {error && <Text size="sm" c="red">{error}</Text>}
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
                      Квиток надішлемо на <strong style={{ color: "var(--text)" }}>{email}</strong>
                    </Text>
                    <Button
                      onClick={handleSubmit}
                      loading={loading}
                      className="event-ticket-buy-btn"
                    >
                      Підтвердити
                    </Button>
                  </>
                ) : (
                  <>
                    <Text size="sm" c="dimmed">
                      Без входу потрібно підтвердити email: на пошту надійде код.
                    </Text>
                    <Button
                      onClick={() => openAuth()}
                      variant="light"
                      className="event-ticket-buy-btn"
                    >
                      Підтвердити email (код з пошти)
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

        {isMobile &&
          typeof document !== "undefined" &&
          createPortal(
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
        styles={{ header: { borderBottom: "1px solid var(--border)" }, body: { padding: 24 } }}
      >
        <Stack gap="md">
          {error && <Text size="sm" c="red">{error}</Text>}
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
                    Квиток надішлемо на <strong style={{ color: "var(--text)" }}>{email}</strong>
                  </Text>
                  <Button
                    onClick={handleSubmit}
                    loading={loading}
                    className="event-ticket-buy-btn"
                  >
                    Підтвердити
                  </Button>
                </>
              ) : (
                <>
                  <Text size="sm" c="dimmed">
                    Без входу потрібно підтвердити email: на пошту надійде код.
                  </Text>
                  <Button
                    onClick={() => openAuth()}
                    variant="light"
                    className="event-ticket-buy-btn"
                  >
                    Підтвердити email (код з пошти)
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
