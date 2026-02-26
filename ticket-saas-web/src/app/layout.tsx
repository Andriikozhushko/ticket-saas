import "@mantine/core/styles.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";

import { getSessionFromCookie } from "@/lib/auth";
import Providers from "./providers";
import Shell from "./shell";

export const metadata: Metadata = {
  title: "Lizard.red",
  description: "Квитки на події — швидко та безпечно",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromCookie();
  const initialUser = session?.email
    ? { email: session.email, isAdmin: session.isAdmin ?? false }
    : null;

  return (
    <html lang="uk" {...mantineHtmlProps}>
      <head>
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