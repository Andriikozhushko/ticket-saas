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
        setError(typeof data?.error === "string" ? data.error : "Не вдалося перевірити оплату");
        return;
      }
      await router.refresh();
    } catch {
      setError("Не вдалося перевірити оплату");
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
        Я оплатив — оновити статус
      </Button>
      {error && (
        <Text size="sm" c="red" mt="xs">
          {error}
        </Text>
      )}
    </>
  );
}
