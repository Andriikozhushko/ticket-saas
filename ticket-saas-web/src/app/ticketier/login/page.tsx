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
        setError((data as { error?: string }).error ?? "Помилка входу");
        return;
      }
      router.push("/ticketier");
      router.refresh();
    } catch {
      setError("Помилка зʼєднання");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Card withBorder padding="xl" radius="lg" style={{ width: "100%", maxWidth: 400 }}>
        <Title order={2} mb="md">Вхід для білетника</Title>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {error && <Text size="sm" c="red">{error}</Text>}
            <TextInput
              label="Логін"
              placeholder="логін"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoComplete="username"
            />
            <TextInput
              label="Пароль"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading}>Увійти</Button>
          </Stack>
        </form>
        <Text size="xs" c="dimmed" mt="lg">Облікові дані надає організатор події.</Text>
      </Card>
    </Box>
  );
}
