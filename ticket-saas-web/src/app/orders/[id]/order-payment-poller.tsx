"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Button, Card, Text, Title } from "@mantine/core";

export default function OrderErrorState() {
  const router = useRouter();
  return (
    <Box style={{ minHeight: "100vh" }}>
      <Box style={{ maxWidth: 520, margin: "0 auto", padding: "32px 24px" }}>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--muted)",
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          в†ђ РќР° РіРѕР»овну
        </Link>
        <Card withBorder padding="xl" radius="lg" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(18,8,8,0.72)", backdropFilter: "blur(16px)" }}>
          <Title order={2} mb="xs">Р—Р°РјРѕРІР»Рµння РЅРµ Р·РЅР°Р№РґРµРЅРѕ</Title>
          <Text size="sm" c="dimmed" mb="md">РџРµСЂРµРІС–СЂС‚Рµ РїРѕСЃРёР»Р°ння Р°Р±Рѕ СЃРїСЂРѕР±СѓР№С‚Рµ РїС–Р·РЅС–С€Рµ.</Text>
          <Button variant="light" size="sm" onClick={() => router.refresh()}>
            РџРѕРІС‚РѕСЂРёС‚Рё
          </Button>
        </Card>
      </Box>
    </Box>
  );
}

