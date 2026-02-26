"use client";

import { MantineProvider, createTheme } from "@mantine/core";

const theme = createTheme({
  primaryColor: "red",
  defaultRadius: "md",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
  colors: {
    red: [
      "#fef2f2",
      "#fee2e2",
      "#fecaca",
      "#fca5a5",
      "#f87171",
      "#ef4444",
      "#dc2626",
      "#b91c1c",
      "#991b1b",
      "#7f1d1d",
    ],
  },
  other: {
    bg: "#050508",
    panel: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.08)",
    glow: "rgba(239,68,68,0.4)",
    glowStrong: "rgba(239,68,68,0.55)",
    textMuted: "rgba(255,255,255,0.6)",
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {children}
    </MantineProvider>
  );
}