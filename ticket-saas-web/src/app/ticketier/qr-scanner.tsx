"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Text } from "@mantine/core";

function getQrBoxSize(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 250, height: 250 };
  const w = window.innerWidth;
  if (w <= 400) return { width: Math.min(w - 32, 280), height: Math.min(w - 32, 280) };
  if (w <= 768) return { width: Math.min(w - 48, 320), height: Math.min(w - 48, 320) };
  return { width: 250, height: 250 };
}

function extractTicketIdFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\/api\/public\/tickets\/verify\/([^/]+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Пропускаємо "код не знайдено" — це нормально для кожного кадру без QR. Показуємо лише справжні помилки (камера, доступ). */
function isScanFailureOnly(err: unknown): boolean {
  const s = typeof err === "string" ? err : err instanceof Error ? err.message : String(err ?? "");
  if (!s) return true;
  const lower = s.toLowerCase();
  return (
    lower.includes("nomultiformat") ||
    lower.includes("no multiformat") ||
    lower.includes("not found") ||
    lower.includes("no code") ||
    lower.includes("unable to detect") ||
    lower.includes("multiformat readers")
  );
}

type Props = {
  onScan: (ticketId: string) => Promise<{ ok: boolean; error?: string; usedAt?: string }>;
};

const SCANNER_DIV_ID = "ticketier-qr-reader";

export default function QRScanner({ onScan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [cameraError, setCameraError] = useState("");
  const scanningRef = useRef(false);
  const startedRef = useRef(false);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let mounted = true;
    startedRef.current = false;
    scannerRef.current = null;
    const container = containerRef.current;
    if (!container) return;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      const id = SCANNER_DIV_ID;
      const existing = document.getElementById(id);
      if (existing && existing.parentElement !== container) existing.remove();
      container.innerHTML = "";
      const div = document.createElement("div");
      div.id = id;
      div.style.width = "100%";
      div.style.maxWidth = "100%";
      div.style.margin = "0 auto";
      div.style.borderRadius = "12px";
      div.style.overflow = "hidden";
      container.appendChild(div);
      const qrbox = getQrBoxSize();
      const sc = new Html5Qrcode(id);
      scannerRef.current = sc;
      try {
        await sc.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: qrbox.width, height: qrbox.height } },
          (decodedText) => {
            if (!mounted || scanningRef.current) return;
            scanningRef.current = true;
            setStatus("scanning");
            const ticketId = extractTicketIdFromUrl(decodedText) ?? decodedText;
            if (!ticketId) {
              setStatus("error");
              setMessage("Невірний QR-код");
              setTimeout(() => { setStatus("idle"); scanningRef.current = false; }, 2000);
              return;
            }
            onScanRef.current(ticketId).then((res) => {
              if (!mounted) return;
              if (res.ok) {
                setStatus("success");
                setMessage("Квиток підтверджено");
              } else {
                setStatus("error");
                setMessage(res.error ?? "Помилка");
              }
              setTimeout(() => { setStatus("idle"); scanningRef.current = false; }, 2500);
            });
          },
          (err) => {
            if (!mounted) return;
            if (isScanFailureOnly(err)) return;
            const msg = typeof err === "string" ? err : err instanceof Error ? err.message : "Немає доступу до камери";
            setCameraError(msg);
          }
        );
        startedRef.current = true;
        if (mounted) setCameraError("");
      } catch (e) {
        if (mounted) setCameraError(e instanceof Error ? e.message : "Помилка камери");
      }
    })();
    return () => {
      mounted = false;
      const sc = scannerRef.current;
      if (sc && startedRef.current) {
        try {
          sc.stop().catch(() => {});
        } catch {
          // scanner was not running or already stopped
        }
      }
      scannerRef.current = null;
      startedRef.current = false;
    };
  }, []);

  return (
    <Box ref={containerRef} style={{ width: "100%" }}>
      {cameraError && <Text size="sm" c="red" mt="sm">{cameraError}</Text>}
      {status !== "idle" && (
        <Text size="md" fw={600} mt="md" c={status === "success" ? "green" : status === "error" ? "red" : "dimmed"}>
          {message}
        </Text>
      )}
    </Box>
  );
}
