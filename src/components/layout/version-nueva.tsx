"use client";
// Si se publicó una versión nueva mientras el celular tenía KurPorc abierto, al volver a la app se actualiza sola
// (así los botones no fallan con «No se pudo cargar»). No recarga si hay algo escrito sin guardar.
import { useEffect } from "react";

const ACTUAL = process.env.NEXT_PUBLIC_VERSION ?? "local";

function hayAlgoEscrito() {
  return Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input:not([type=hidden]):not([type=date]):not([type=checkbox]):not([type=radio]), textarea"))
    .some(el => el.value.trim() !== "" && el.defaultValue !== el.value);
}

export function VersionNueva() {
  useEffect(() => {
    if (ACTUAL === "local") return;
    let oculto = 0;
    const revisar = async () => {
      if (document.visibilityState === "hidden") { oculto = Date.now(); return; }
      if (!oculto || Date.now() - oculto < 30_000) return; // solo si estuvo afuera al menos 30 segundos
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { version } = await r.json() as { version: string };
        if (version && version !== ACTUAL && !hayAlgoEscrito()) window.location.reload();
      } catch { /* sin conexión: se revisa la próxima vez */ }
    };
    document.addEventListener("visibilitychange", revisar);
    return () => document.removeEventListener("visibilitychange", revisar);
  }, []);
  return null;
}
