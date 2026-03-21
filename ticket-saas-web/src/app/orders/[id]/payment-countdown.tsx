"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Box, Text } from "@mantine/core";

const MS_PER_SEC = 1000;
const SEC_PER_MIN = 60;
const TOTAL_MS = 15 * 60 * MS_PER_SEC;

function formatRemaining(ms: number): { min: number; sec: number } {
  if (ms <= 0) return { min: 0, sec: 0 };
  const totalSec = Math.floor(ms / MS_PER_SEC);
  return { min: Math.floor(totalSec / SEC_PER_MIN), sec: totalSec % SEC_PER_MIN };
}

type Props = {
  expiresAtIso: string;
};

export default function PaymentCountdown({ expiresAtIso }: Props) {
  const router = useRouter();
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const expiredFired = useRef(false);

  useEffect(() => {
    const expiresAt = new Date(expiresAtIso).getTime();
    const tick = () => {
      const now = Date.now();
      const left = expiresAt - now;
      setRemainingMs(left);
      if (left <= 0 && !expiredFired.current) {
        expiredFired.current = true;
        router.refresh();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAtIso, router]);

  if (remainingMs === null) return null;

  if (remainingMs <= 0) {
    return (
      <Box
        style={{
          padding: "16px 20px",
          borderRadius: 14,
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.25)",
          textAlign: "center",
        }}
      >
        <Text size="sm" fw={600} style={{ color: "var(--red)" }}>
          Час на оплату вийшов
        </Text>
      </Box>
    );
  }

  const { min, sec } = formatRemaining(remainingMs);
  const progress = Math.min(1, 1 - remainingMs / TOTAL_MS);

  return (
    <Box
      style={{
        position: "relative",
        padding: "24px 20px 20px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
      }}
    >
      <Box style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <Text size="xs" fw={600} c="dimmed" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Залишилось до оплати
        </Text>
        <Box style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <Text
            component="span"
            style={{
              fontSize: "clamp(2.25rem, 10vw, 3.25rem)",
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.05em",
              color: "var(--text)",
              textShadow: "0 0 40px rgba(239,68,68,0.4)",
            }}
          >
            {String(min).padStart(2, "0")}
          </Text>
          <Text component="span" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--muted)", margin: "0 2px" }}>:</Text>
          <Text
            component="span"
            style={{
              fontSize: "clamp(2.25rem, 10vw, 3.25rem)",
              fontWeight: 800,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.05em",
              color: "var(--text)",
              textShadow: "0 0 40px rgba(239,68,68,0.4)",
            }}
          >
            {String(sec).padStart(2, "0")}
          </Text>
        </Box>
        <Text size="xs" c="dimmed" style={{ letterSpacing: "0.04em" }}>
          хв · сек
        </Text>
      </Box>
      {/* Лінійний прогрес-бар внизу */}
      <Box
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(255,255,255,0.06)",
          borderRadius: "0 0 20px 20px",
          overflow: "hidden",
        }}
      >
        <Box
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: "var(--gradient-accent)",
            borderRadius: "0 2px 0 0",
            transition: "width 1s linear",
          }}
        />
      </Box>
    </Box>
  );
}
