import "@mantine/core/styles.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";

import { getSessionFromCookie } from "@/lib/auth";
import Providers from "./providers";
import Shell from "./shell";

export const metadata: Metadata = {
  title: {
    default: "Lizard.red — Квитки на події за хвилину. Безпечно та зручно",
    template: "%s | Lizard.red",
  },
  description:
    "Купуйте квитки на концерти, вечірки та події онлайн. Митлива оплата, квиток на пошту та у «Мої квитки». Без комісій та черг.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromCookie();
  const initialUser = session?.email
    ? { email: session.email, isAdmin: session.isAdmin ?? false }
    : null;

  return (
    <html lang="uk" {...mantineHtmlProps}>
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="any" />
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body>
        <div className="page-bg-glow" aria-hidden />
        <Providers>
          <Shell initialUser={initialUser}>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}