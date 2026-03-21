"use client";

import { useState } from "react";
import { Button, Card, Group, Select, Stack, Text, TextInput } from "@mantine/core";

export default function IssueTicketsBlock({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<string>("gift");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Р’РєР°Р¶С–С‚ь email");
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
        setError((data as { error?: string }).error ?? "РџРѕРјРёР»РєР° РІРёРґР°С‡С–");
        return;
      }
      setSuccess(`Р’РёРґР°РЅРѕ ${(data as { ticketsCount?: number }).ticketsCount ?? quantity} РєРІРёС‚РѕРє(Рё) РЅР° ${trimmed}`);
      setEmail("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card withBorder p="lg" radius="md" style={{ borderColor: "var(--border)" }}>
      <Text size="sm" fw={700} mb={4}>
        РџРѕРґР°СЂСѓРІР°С‚Рё Р°Р±Рѕ РІРёРґР°С‚Рё РєРІРёС‚РєРё
      </Text>
      <Text size="xs" c="dimmed" mb="md">
        Р’РІРµРґС–С‚ь email РѕС‚СЂРёРјСѓРІР°С‡Р°. РЎРёСЃС‚РµРјР° СЃС‚РІРѕСЂРёС‚ь РєРІРёС‚РєРё С‚Р° РЅР°РґС–С€Р»Рµ Р»РёСЃС‚ Р· QR-РєРѕРґР°РјРё.
      </Text>
      <Stack gap="sm">
        <TextInput
          label="Email РѕС‚СЂРёРјСѓРІР°С‡Р°"
          placeholder="email@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.currentTarget.value);
            setError("");
            setSuccess("");
          }}
          type="email"
        />
        <Group grow>
          <Select
            label="РљС–Р»СЊРєС–СЃС‚ь (1-10)"
            data={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
            value={String(quantity)}
            onChange={(value) => setQuantity(Number(value) || 1)}
          />
          <Select
            label="РџСЂРёС‡РёРЅР°"
            data={[
              { value: "gift", label: "РџРѕРґР°рунок" },
              { value: "issuance", label: "Р’РёРґР°С‡Р°" },
              { value: "purchase", label: "РџРѕРєСѓРїРєР°" },
            ]}
            value={reason}
            onChange={(value) => value && setReason(value)}
          />
        </Group>
        {error && <Text size="sm" c="red">{error}</Text>}
        {success && <Text size="sm" c="green">{success}</Text>}
        <Button size="sm" onClick={handleSubmit} loading={loading}>
          {reason === "gift" ? "РџРѕРґР°СЂСѓРІР°С‚Рё РєРІРёС‚РєРё" : "Р’РёРґР°С‚Рё РєРІРёС‚РєРё"}
        </Button>
      </Stack>
    </Card>
  );
}

