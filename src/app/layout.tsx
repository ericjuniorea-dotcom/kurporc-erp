import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SplashScreen } from "@/components/ui/splash-screen";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title:       "KurPorc ERP",
  description: "La inteligencia que hace crecer tu granja porcina.",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce de la CSP (lo genera src/middleware.ts): sin él, la política bloquearía este script en línea.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/* eslint-disable-next-line no-restricted-syntax -- script fijo del tema (sin datos del usuario), lleva el nonce de la CSP */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `
          try {
            var t = sessionStorage.getItem('kurporc-theme') || 'dark';
            document.documentElement.setAttribute('data-theme', t);
          } catch(e) {
            document.documentElement.setAttribute('data-theme', 'dark');
          }
        ` }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <Providers>
          <SplashScreen />
          {children}
        </Providers>
      </body>
    </html>
  );
}
