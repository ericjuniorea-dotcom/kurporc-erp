"use client";
// Fase 15.3 · Latido de uso: cada 60 s, solo si la pestaña está a la vista y hubo un toque, tecla o scroll
// en los últimos 120 s. Mide tiempo de uso estimado (ventana abierta con actividad), no atención.
import { useEffect } from "react";

const CADA_MS = 60_000;
const ACTIVO_MS = 120_000;

export function LatidoUso() {
  useEffect(() => {
    let ultimaActividad = Date.now();
    const marcar = () => { ultimaActividad = Date.now(); };
    const eventos = ["pointerdown", "keydown", "scroll", "wheel", "touchstart"] as const;
    for (const e of eventos) window.addEventListener(e, marcar, { passive: true, capture: true });
    const enviar = () => {
      if (document.visibilityState !== "visible" || Date.now() - ultimaActividad > ACTIVO_MS) return;
      fetch("/api/uso/latido", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruta: location.pathname }) }).catch(() => {});
    };
    const t = setInterval(enviar, CADA_MS);
    return () => { clearInterval(t); for (const e of eventos) window.removeEventListener(e, marcar, { capture: true }); };
  }, []);
  return null;
}
