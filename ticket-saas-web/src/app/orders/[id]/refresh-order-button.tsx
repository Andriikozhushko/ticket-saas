"use client";

import { useRouter } from "next/navigation";
import { Button, Text } from "@mantine/core";
import { useState } from "react";

export default function RefreshOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/orders/${orderId}/check-payment`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "РќРµ РІРґР°Р»ося РїРµСЂРµРІС–СЂРёС‚Рё РѕРїР»Р°С‚Сѓ");
        return;
      }
      if (data.checkError) {
        setError("РџРµСЂРµРІС–СЂРєР° РѕРїР»Р°С‚Рё С‚РёРјС‡Р°сово РЅРµРґРѕСЃС‚СѓРїРЅР°. РЎРїСЂРѕР±СѓР№С‚Рµ РїС–Р·РЅС–С€Рµ.");
      }
      if (data.stillChecking) setError(null);
      await router.refresh();
    } catch {
      setError("РќРµ РІРґР°Р»ося РїРµСЂРµРІС–СЂРёС‚Рё РѕРїР»Р°С‚Сѓ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleClick}
        variant="outline"
        size="md"
        radius="md"
        loading={loading}
        style={{ borderColor: "var(--border-strong)", color: "var(--text)", fontWeight: 600 }}
      >
        РЇ РѕРїР»Р°С‚РёРІ вЂ” РѕРЅРѕРІРёС‚Рё СЃС‚Р°С‚СѓСЃ
      </Button>
      {error && (
        <Text size="sm" c="red" mt="xs">
          {error}
        </Text>
      )}
    </>
  );
}

