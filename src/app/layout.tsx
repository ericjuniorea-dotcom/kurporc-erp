import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SplashScreen } from "@/components/ui/splash-screen";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title:       "KurPorc ERP",
  description: "Sistema de gestión para granjas porcinas · Paraguay",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: `
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
