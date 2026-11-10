"use client";
// CAPTCHA (Anexo F.1 / Fase 2.3) con Cloudflare Turnstile, verificado por Supabase Auth.
// Solo se muestra si está NEXT_PUBLIC_TURNSTILE_SITE_KEY: sin la variable, los formularios funcionan igual
// (y Supabase no exige CAPTCHA mientras no se active en Authentication → Attack Protection).
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void };
    __kpTurnstile?: Promise<void>;
  }
}

export const CAPTCHA_ACTIVO = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function cargarScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  window.__kpTurnstile ??= new Promise<void>((ok, mal) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.defer = true;
    s.onload = () => ok(); s.onerror = () => mal(new Error("No se pudo cargar el CAPTCHA"));
    document.head.appendChild(s);
  });
  return window.__kpTurnstile;
}

/**
 * `onToken(null)` cuando vence o falla. `reiniciar` cambia cada vez que hay que pedir un token nuevo
 * (por ejemplo, después de un intento fallido: cada token sirve una sola vez).
 */
export function Captcha({ onToken, reiniciar = 0 }: { onToken: (t: string | null) => void; reiniciar?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!CAPTCHA_ACTIVO || !caja.current) return;
    let vivo = true;
    cargarScript().then(() => {
      if (!vivo || !caja.current || !window.turnstile || id.current) return;
      id.current = window.turnstile.render(caja.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, language: "es", theme: "auto", appearance: "interaction-only",
        callback: (t: string) => cb.current(t), "expired-callback": () => cb.current(null), "error-callback": () => cb.current(null),
      });
    }).catch(() => cb.current(null));
    return () => { vivo = false; if (id.current && window.turnstile) window.turnstile.remove(id.current); id.current = null; };
  }, []);

  useEffect(() => {
    if (reiniciar && id.current && window.turnstile) { cb.current(null); window.turnstile.reset(id.current); }
  }, [reiniciar]);

  if (!CAPTCHA_ACTIVO) return null;
  return <div ref={caja} style={{ minHeight: 0 }} aria-label="Verificación de seguridad" />;
}
