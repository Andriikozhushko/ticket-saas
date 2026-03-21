"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Text } from "@mantine/core";

export default function ApproveEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.refresh();
      } else {
        setError((data as { error?: string }).error ?? "РќРµ РІРґР°Р»ося РѕРґРѕР±СЂРёС‚Рё");
      }
    } catch {
      setError("РќРµ РІРґР°Р»ося РѕРґРѕР±СЂРёС‚Рё");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="light" size="xs" color="green" onClick={handleApprove} loading={loading}>
        РћРґРѕР±СЂРёС‚Рё
      </Button>
      {error && <Text size="xs" c="red" component="span" ml="xs">{error}</Text>}
    </>
  );
}

