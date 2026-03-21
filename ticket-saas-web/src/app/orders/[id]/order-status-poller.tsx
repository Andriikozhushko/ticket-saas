"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 30_000; // РЎРїС–Р»СЊРЅРёР№ опрос РїРѕ РґР¶РµСЂРµР»Сѓ СЂР°Р· РЅР° 30 СЃ; СЃС‚РѕСЂС–РЅРєР° РѕРЅРѕРІР»СЋС”С‚ься Р±РµР· В«РЇ РѕРїР»Р°С‚РёРІВ»

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

