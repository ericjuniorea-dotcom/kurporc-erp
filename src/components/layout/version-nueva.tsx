"use client";
// Si se publicó una versión nueva mientras KurPorc estaba abierto, la pantalla vieja puede fallar al cargar o guardar
// («An unexpected response…»). Al volver a la app se actualiza sola (si no hay nada escrito sin guardar) y, si la
// pantalla quedó abierta, cada 5 minutos se revisa y aparece un aviso para actualizar con un toque.
import { useEffect, useState } from "react";
import { IconRefresh } from "@tabler/icons-react";

const ACTUAL = process.env.NEXT_PUBLIC_VERSION ?? "local";

function hayAlgoEscrito() {
  return Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input:not([type=hidden]):not([type=date]):not([type=checkbox]):not([type=radio]), textarea"))
    .some(el => el.value.trim() !== "" && el.defaultValue !== el.value);
}
async function hayNueva() {
  try {
    const r = await fetch("/api/version", { cache: "no-store" });
    if (!r.ok) return false;
    const { version } = await r.json() as { version?: string };
    return !!version && version !== "local" && version !== ACTUAL;
  } catch { return false; }
}

export function VersionNueva() {
  const [nueva, setNueva] = useState(false);
  useEffect(() => {
    if (ACTUAL === "local") return;
    let oculto = 0;
    const alVolver = async () => {
      if (document.visibilityState === "hidden") { oculto = Date.now(); return; }
      if (!oculto || Date.now() - oculto < 30_000) return; // estuvo afuera al menos 30 segundos
      if (await hayNueva()) { if (!hayAlgoEscrito()) window.location.reload(); else setNueva(true); }
    };
    const id = setInterval(async () => { if (document.visibilityState === "visible" && await hayNueva()) setNueva(true); }, 5 * 60_000);
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", alVolver); };
  }, []);
  if (!nueva) return null;
  return (
    <div role="status" style={{ position: "fixed", left: "50%", bottom: 16, transform: "translateX(-50%)", zIndex: 300, maxWidth: "calc(100vw - 24px)",
      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 8px 14px", borderRadius: 999, background: "var(--text-primary)", color: "var(--bg-base)",
      boxShadow: "0 8px 24px rgba(0,0,0,.25)", fontSize: 13 }}>
      Hay una versión nueva de KurPorc
      <button type="button" onClick={() => window.location.reload()}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", borderRadius: 999, padding: "6px 12px", cursor: "pointer", background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 13, minHeight: 0 }}>
        <IconRefresh size={14} aria-hidden /> Actualizar
      </button>
    </div>
  );
}
