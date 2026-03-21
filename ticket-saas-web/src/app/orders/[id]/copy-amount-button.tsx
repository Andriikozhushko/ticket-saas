"use client";

import { useState } from "react";
import { Box, Text, Tooltip, ActionIcon } from "@mantine/core";

const IconCopy = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconCheck = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

type Props = {
  amountHuman: string;
  currency?: string;
};

export default function CopyAmountButton({ amountHuman, currency = "UAH" }: Props) {
  const [copied, setCopied] = useState(false);
  const copyValue = amountHuman.replace(/\s/g, "");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      await navigator.clipboard.writeText(`${amountHuman} ${currency}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Box
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        padding: "18px 22px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <Text
        size="xl"
        fw={800}
        style={{
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "0.03em",
          color: "var(--text)",
        }}
      >
        {amountHuman} {currency}
      </Text>
      <Tooltip label={copied ? "Скопійовано!" : "Копіювати суму"} withArrow>
        <ActionIcon
          variant="subtle"
          size="md"
          radius="md"
          onClick={handleCopy}
          aria-label={copied ? "Скопійовано" : "Копіювати суму"}
          style={{
            color: copied ? "var(--accent)" : "var(--muted)",
            background: "transparent",
          }}
        >
          {copied ? <IconCheck /> : <IconCopy />}
        </ActionIcon>
      </Tooltip>
    </Box>
  );
}
