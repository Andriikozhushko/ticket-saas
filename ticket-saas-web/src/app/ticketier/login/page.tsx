"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Card, Stack, Text, TextInput, Title } from "@mantine/core";

export default function TicketierLoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/ticketier/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "РџРѕРјРёР»РєР° РІС…оду");
        return;
      }
      router.push("/ticketier");
      router.refresh();
    } catch {
      setError("РџРѕРјРёР»РєР° Р·КјС”РґРЅР°ння");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Card withBorder padding="xl" radius="lg" style={{ width: "100%", maxWidth: 400 }}>
        <Title order={2} mb="md">Р’С…С–Рґ РґР»я Р±С–Р»РµС‚РЅРёРєР°</Title>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {error && <Text size="sm" c="red">{error}</Text>}
            <TextInput
              label="Р›РѕРіС–РЅ"
              placeholder="Р»РѕРіС–РЅ"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoComplete="username"
            />
            <TextInput
              label="РџР°СЂРѕР»ь"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading}>РЈРІС–Р№С‚Рё</Button>
          </Stack>
        </form>
        <Text size="xs" c="dimmed" mt="lg">РћР±Р»С–РєРѕРІС– РґР°РЅС– РЅР°РґР°С” РѕСЂРіР°РЅС–Р·Р°С‚ор РїРѕРґС–С—.</Text>
      </Card>
    </Box>
  );
}

