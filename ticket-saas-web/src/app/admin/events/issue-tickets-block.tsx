"use client";

import { useState } from "react";
import { Box, Button, Card, Stack, Text, TextInput, Select, Group } from "@mantine/core";

export default function IssueTicketsBlock({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<string>("issuance");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Вкажіть email");
      return;
    }
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/issue-tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, quantity, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Помилка видачі");
        return;
      }
      setSuccess(`Видано ${(data as { ticketsCount?: number }).ticketsCount ?? quantity} квиток(и) на ${trimmed}`);
      setEmail("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card withBorder p="lg" radius="md" style={{ borderColor: "var(--border)" }}>
      <Text size="sm" fw={700} mb="md">Видати квитки на email</Text>
      <Stack gap="sm">
        <TextInput
          label="Email отримувача"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => { setEmail(e.currentTarget.value); setError(""); setSuccess(""); }}
          type="email"
        />
        <Group grow>
          <Select
            label="Кількість (1–10)"
            data={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            value={String(quantity)}
            onChange={(v) => setQuantity(Number(v) || 1)}
          />
          <Select
            label="Причина"
            data={[
              { value: "gift", label: "Подарок" },
              { value: "issuance", label: "Видача" },
              { value: "purchase", label: "Покупка" },
            ]}
            value={reason}
            onChange={(v) => v && setReason(v)}
          />
        </Group>
        {error && <Text size="sm" c="red">{error}</Text>}
        {success && <Text size="sm" c="green">{success}</Text>}
        <Button size="sm" onClick={handleSubmit} loading={loading}>Видати квитки</Button>
      </Stack>
    </Card>
  );
}
