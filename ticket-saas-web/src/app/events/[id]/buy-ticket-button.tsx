"use client";

import { useState, useEffect } from "react";
import { Button, Modal, TextInput, Stack, Text, Select } from "@mantine/core";

type TicketType = { id: string; name: string; priceCents: number };

export default function BuyTicketButton({
  eventId,
  ticketTypes = [],
}: {
  eventId: string;
  ticketTypes?: TicketType[];
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [ticketTypeId, setTicketTypeId] = useState<string | null>(ticketTypes[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ticketTypes.length > 0) setTicketTypeId((id) => (ticketTypes.some((t) => t.id === id) ? id : ticketTypes[0].id));
    else setTicketTypeId(null);
  }, [ticketTypes]);

  const emailToSend = email.trim();
  const handleSubmit = async () => {
    if (!emailToSend) {
      setError("Вкажіть email");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const body: { eventId: string; email: string; ticketTypeId?: string } = { eventId, email: emailToSend };
      if (ticketTypeId && ticketTypes.length > 0) body.ticketTypeId = ticketTypeId;
      const res = await fetch("/api/public/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Помилка. Спробуйте пізніше.");
        return;
      }
      const orderId = (data as { orderId?: string }).orderId;
      if (orderId) {
        setOpen(false);
        window.location.href = `/orders/${orderId}`;
      } else {
        setError("Невірна відповідь сервера");
      }
    } catch {
      setError("Сервер недоступний. Спробуйте пізніше.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="xl"
        variant="filled"
        color="blue"
        onClick={async () => {
          setError("");
          const sessionRes = await fetch("/api/auth/session");
          const { user } = await sessionRes.json().catch(() => ({ user: null }));
          setEmail(user?.email ?? "");
          setOpen(true);
        }}
        className="btn-glow"
        style={{
          background: "var(--gradient-accent)",
          border: "none",
          fontWeight: 800,
          letterSpacing: "0.02em",
          fontSize: 16,
          padding: "18px 36px",
          borderRadius: 14,
          color: "#030304",
          boxShadow: "var(--shadow-glow), 0 6px 32px rgba(239,68,68,0.4)",
        }}
      >
        Купити квиток
      </Button>
      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title="Купити квиток"
        centered
        styles={{
          header: { borderBottom: "1px solid var(--border)" },
          body: { padding: 24 },
        }}
      >
        <Stack gap="md">
          {error && <Text size="sm" c="red">{error}</Text>}
          {ticketTypes.length > 1 && (
            <Select
              label="Вид квитка"
              data={ticketTypes.map((t) => ({ value: t.id, label: `${t.name} — ${(t.priceCents / 100).toFixed(0)} грн` }))}
              value={ticketTypeId}
              onChange={(v) => setTicketTypeId(v)}
            />
          )}
          {email ? (
            <Text size="sm" c="dimmed">
              Квиток надішлемо на <strong>{email}</strong>
            </Text>
          ) : (
            <TextInput
              label="Email для квитка"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              type="email"
              required
            />
          )}
          <Button onClick={handleSubmit} loading={loading} color="blue" size="md" style={{ fontWeight: 600 }} disabled={!email.trim()}>
            Створити замовлення
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
