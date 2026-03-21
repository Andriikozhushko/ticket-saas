import "@mantine/core/styles.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";

import { getSessionFromCookie } from "@/lib/auth";
import Providers from "./providers";
import Shell from "./shell";

export const metadata: Metadata = {
  title: {
    default: "Lizard.red вЂ” РљРІРёС‚РєРё РЅР° РїРѕРґС–С— Р·Р° С…РІРёР»ину. Р‘РµР·РїРµС‡РЅРѕ С‚Р° Р·СЂСѓС‡РЅРѕ",
    template: "%s | Lizard.red",
  },
  description:
    "РљСѓРїСѓР№С‚Рµ РєРІРёС‚РєРё РЅР° РєРѕРЅС†РµСЂС‚Рё, РІРµС‡С–рки С‚Р° РїРѕРґС–С— РѕРЅР»Р°Р№РЅ. РњРёС‚Р»РёРІР° РѕРїР»Р°С‚Р°, РєРІРёС‚РѕРє РЅР° РїРѕС€С‚Сѓ С‚Р° Сѓ В«РњРѕС— РєРІРёС‚РєРёВ». Р‘РµР· РєРѕРјС–СЃС–Р№ С‚Р° С‡Рµрг.",
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
  // Р—Р°Р±РѕСЂРѕРЅР° Р·уму РЅР° РјРѕР±С–Р»СЊРЅРёС… РЅР° РІСЃС–С… СЃС‚РѕСЂС–РЅРєР°С…
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
