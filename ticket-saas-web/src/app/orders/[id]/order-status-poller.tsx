"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 30_000; // Спільний опрос по джерелу раз на 30 с; сторінка оновлюється без «Я оплатив»

export default function OrderStatusPoller({
  orderId,
  isAwaiting,
}: {
  orderId: string;
  isAwaiting: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isAwaiting) return;
    const interval = setInterval(async () => {
      await fetch(`/api/public/orders/${orderId}/check-payment`, { method: "POST" });
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [orderId, isAwaiting, router]);

  return null;
}
