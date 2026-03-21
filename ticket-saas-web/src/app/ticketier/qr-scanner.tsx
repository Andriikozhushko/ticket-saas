"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Text } from "@mantine/core";

type ScanResult = {
  ok: boolean;
  error?: string;
  usedAt?: string | null;
  usedBy?: string | null;
  buyerEmail?: string | null;
  ticketTypeName?: string | null;
  state?: "success" | "already_used" | "error";
};

type Props = {
  onScan: (ticketId: string) => Promise<ScanResult>;
  fileInputRef: React.RefObject<HTMLInputElement>;
};

type FeedbackState = {
  tone: "success" | "warning" | "error";
  title: string;
  subtitle: string;
  meta?: string;
};

type Html5QrCodeInstance = {
  start: (
    cameraConfig: unknown,
    config: unknown,
    onSuccess: (decodedText: string) => void,
    onError?: (errorMessage: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  scanFile: (file: File, showImage?: boolean) => Promise<string>;
};

function getQrBoxSize(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 220, height: 220 };
  const viewport = Math.min(window.innerWidth, window.innerHeight);
  const size = Math.max(180, Math.min(viewport - 140, 240));
  return { width: size, height: size };
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

function normalizeTicketId(decodedText: string): string | null {
  const value = decodedText.trim();
  if (!value) return null;
  return extractTicketIdFromUrl(value) ?? value;
}

function isScanFailureOnly(err: unknown): boolean {
  const message = typeof err === "string" ? err : (err as Error)?.message ?? String(err ?? "");
  if (!message) return true;

  const lower = message.toLowerCase();
  return (
    lower.includes("nomultiformat") ||
    lower.includes("no multiformat") ||
    lower.includes("not found") ||
    lower.includes("no code") ||
    lower.includes("unable to detect") ||
    lower.includes("multiformat readers")
  );
}

function formatRelativeUsedAt(value?: string | null): string | null {
  if (!value) return null;

  const usedAt = new Date(value);
  if (Number.isNaN(usedAt.getTime())) return null;

  const diffMs = usedAt.getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(diffMs) / 60000);
  const relative = new Intl.RelativeTimeFormat("uk", { numeric: "auto" });

  if (absMinutes < 1) return "щойно";
  if (absMinutes < 60) return relative.format(Math.round(diffMs / 60000), "minute");

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) return relative.format(Math.round(diffMs / 3600000), "hour");

  return relative.format(Math.round(diffMs / 86400000), "day");
}

async function decodeImageFile(file: File): Promise<string | null> {
  const { Html5Qrcode } = await import("html5-qrcode");
  const tempId = `ticketier-file-${Date.now()}`;
  const tempDiv = document.createElement("div");
  tempDiv.id = tempId;
  tempDiv.style.display = "none";
  document.body.appendChild(tempDiv);

  try {
    const scanner = new Html5Qrcode(tempId) as unknown as Html5QrCodeInstance;
    return await scanner.scanFile(file, false);
  } finally {
    tempDiv.remove();
  }
}

const SCANNER_DIV_ID = "ticketier-qr-reader";

export default function QRScanner({ onScan, fileInputRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [cameraError, setCameraError] = useState("");
  const scanningRef = useRef(false);
  const scannerRef = useRef<Html5QrCodeInstance | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const closeFeedback = useCallback(() => {
    setFeedback(null);
    scanningRef.current = false;
  }, []);

  const handleDecodedValue = useCallback(async (decodedText: string) => {
    if (scanningRef.current) return;

    scanningRef.current = true;
    const ticketId = normalizeTicketId(decodedText);

    if (!ticketId) {
      setFeedback({
        tone: "error",
        title: "Невірний QR-код",
        subtitle: "Спробуйте навести камеру ще раз.",
      });
      return;
    }

    const result = await onScanRef.current(ticketId);

    if (result.ok || result.state === "success") {
      setFeedback({
        tone: "success",
        title: "Квиток підтверджено",
        subtitle: result.ticketTypeName
          ? `Вхід дозволено. Тип квитка: ${result.ticketTypeName}.`
          : "Вхід дозволено. Гість може проходити.",
        meta: result.buyerEmail ?? undefined,
      });
      return;
    }

    if (result.state === "already_used") {
      const relative = formatRelativeUsedAt(result.usedAt);
      setFeedback({
        tone: "warning",
        title: "Квиток уже сканували",
        subtitle: relative ? `Цей квиток уже використали ${relative}.` : "Цей квиток уже використали раніше.",
        meta: result.usedBy ? `Сканував: ${result.usedBy}` : result.buyerEmail ?? undefined,
      });
      return;
    }

    setFeedback({
      tone: "error",
      title: "Не вдалося підтвердити",
      subtitle: result.error ?? "Сталася помилка під час сканування.",
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const container = containerRef.current;
      if (!container) return;

      const { Html5Qrcode } = await import("html5-qrcode");
      container.innerHTML = "";
      const div = document.createElement("div");
      div.id = SCANNER_DIV_ID;
      div.style.width = "100%";
      div.style.height = "100%";
      container.appendChild(div);

      const scanner = new Html5Qrcode(SCANNER_DIV_ID) as unknown as Html5QrCodeInstance;
      scannerRef.current = scanner;
      const qrbox = getQrBoxSize();

      const onSuccess = (decodedText: string) => {
        if (!mounted || scanningRef.current) return;
        void handleDecodedValue(decodedText);
      };
      const onError = (err: unknown) => {
        if (!mounted || isScanFailureOnly(err)) return;
        setCameraError(typeof err === "string" ? err : "Немає доступу до камери");
      };

      try {
        try {
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: qrbox.width, height: qrbox.height } },
            onSuccess,
            onError
          );
        } catch {
          await scanner.start(
            { facingMode: "user" },
            { fps: 10, qrbox: { width: qrbox.width, height: qrbox.height } },
            onSuccess,
            onError
          );
        }
        if (mounted) setCameraError("");
      } catch (error) {
        if (mounted) {
          setCameraError(error instanceof Error ? error.message : "Помилка камери");
        }
      }
    })();

    return () => {
      mounted = false;
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          void scanner.stop().catch(() => {});
        } catch {
          // scanner already stopped
        }
      }
      scannerRef.current = null;
    };
  }, [handleDecodedValue]);

  return (
    <Box className="ticketier-scanner-shell">
      <Box ref={containerRef} className="ticketier-scanner-surface" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          if (!file) return;
          void (async () => {
            try {
              const decoded = await decodeImageFile(file);
              if (!decoded) {
                setFeedback({
                  tone: "error",
                  title: "QR не знайдено",
                  subtitle: "Спробуйте чіткіше фото або поверніться до камери.",
                });
                return;
              }
              await handleDecodedValue(decoded);
            } catch {
              setFeedback({
                tone: "error",
                title: "Не вдалося прочитати фото",
                subtitle: "Спробуйте інше фото або поверніться до камери.",
              });
            } finally {
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }
          })();
        }}
      />

      {cameraError ? (
        <Box className="ticketier-scan-overlay ticketier-scan-overlay-error">
          <Box className="ticketier-scan-result-card">
            <Text className="ticketier-scan-result-title">Камера недоступна</Text>
            <Text className="ticketier-scan-result-subtitle">{cameraError}</Text>
          </Box>
        </Box>
      ) : null}

      {feedback ? (
        <Box className={`ticketier-scan-overlay ticketier-scan-overlay-${feedback.tone}`}>
          <Box className="ticketier-scan-ripple" aria-hidden="true" />
          <Box className="ticketier-scan-ripple ticketier-scan-ripple-delayed" aria-hidden="true" />
          <Box className="ticketier-scan-result-card">
            <Box className={`ticketier-scan-result-icon ticketier-scan-result-icon-${feedback.tone}`} aria-hidden="true">
              {feedback.tone === "success" ? "OK" : feedback.tone === "warning" ? "УЖЕ" : "STOP"}
            </Box>
            <Text className="ticketier-scan-result-title">{feedback.title}</Text>
            <Text className="ticketier-scan-result-subtitle">{feedback.subtitle}</Text>
            {feedback.meta ? <Text className="ticketier-scan-result-meta">{feedback.meta}</Text> : null}
            <Button mt="lg" color="dark" variant="white" size="lg" radius="md" fullWidth onClick={closeFeedback}>
              OK
            </Button>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}
