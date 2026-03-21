"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Text } from "@mantine/core";

export default function ToggleFinishedButton({ eventId, isFinished }: { eventId: string; isFinished: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFinished: !isFinished }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.refresh();
      } else {
        setError((data as { error?: string }).error ?? "Не вдалося оновити статус події");
      }
    } catch {
      setError("Не вдалося оновити статус події");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="light" size="xs" color={isFinished ? "gray" : "orange"} onClick={handleToggle} loading={loading}>
        {isFinished ? "Відновити продаж" : "Завершити"}
      </Button>
      {error ? <Text size="xs" c="red" component="span" ml="xs">{error}</Text> : null}
    </>
  );
}
