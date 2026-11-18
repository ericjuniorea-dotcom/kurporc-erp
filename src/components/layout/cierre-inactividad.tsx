"use client";
// Cierre de sesión por inactividad: a los 30 minutos sin tocar KurPorc (en ninguna pestaña) la sesión se cierra.
// Un minuto antes avisa. El servidor también lo controla (middleware), así que vale aunque se cierre el navegador.
import { useEffect, useRef, useState } from "react";
import { LIMITE_INACTIVIDAD_MS, MINUTOS_INACTIVIDAD } from "@/lib/sesion/inactividad";

const CLAVE = "kp_ultima_actividad";
const AVISO_MS = 60_000;          // se avisa el último minuto
const RENOVAR_SERVIDOR_MS = 4 * 60_000; // con uso real, se le avisa al servidor cada 4 min como mucho

function leerCompartida(): number {
  try { return Number(localStorage.getItem(CLAVE)) || 0; } catch { return 0; }
}

export function CierreInactividad() {
  const [restan, setRestan] = useState<number | null>(null);
  const ultima = useRef(Date.now());
  const ultimoServidor = useRef(Date.now());
  const cerrando = useRef(false);

  useEffect(() => {
    let guardada = 0;
    const renovarServidor = () => {
      ultimoServidor.current = Date.now();
      fetch("/api/sesion/activa", { cache: "no-store" }).catch(() => {});
    };
    const marcar = () => {
      const ahora = Date.now();
      ultima.current = ahora;
      if (ahora - guardada > 5_000) { guardada = ahora; try { localStorage.setItem(CLAVE, String(ahora)); } catch { /* sin almacenamiento */ } }
      if (ahora - ultimoServidor.current > RENOVAR_SERVIDOR_MS) renovarServidor();
    };
    const cerrar = async () => {
      if (cerrando.current) return;
      cerrando.current = true;
      await fetch("/auth/salir", { method: "POST" }).catch(() => {});
      window.location.replace("/login?error=inactividad");
    };
    const revisar = () => {
      const inactivo = Date.now() - Math.max(ultima.current, leerCompartida());
      if (inactivo >= LIMITE_INACTIVIDAD_MS) { void cerrar(); return; }
      const quedan = LIMITE_INACTIVIDAD_MS - inactivo;
      setRestan(quedan <= AVISO_MS ? Math.ceil(quedan / 1000) : null);
    };
    const eventos = ["pointerdown", "keydown", "scroll", "wheel", "touchstart", "mousemove"] as const;
    for (const e of eventos) window.addEventListener(e, marcar, { passive: true, capture: true });
    const alVolver = () => { if (document.visibilityState === "visible") revisar(); };
    document.addEventListener("visibilitychange", alVolver);
    const t = setInterval(revisar, 1_000);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
      for (const e of eventos) window.removeEventListener(e, marcar, { capture: true });
    };
  }, []);

  if (restan === null) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="inact-titulo" aria-describedby="inact-texto"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 20, maxWidth: 380, width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 id="inact-titulo" style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>¿Seguís ahí?</h2>
        <p id="inact-texto" style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          Pasaron casi {MINUTOS_INACTIVIDAD} minutos sin usar KurPorc. Por seguridad la sesión se cierra en <strong>{restan} s</strong>.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={async () => { await fetch("/auth/salir", { method: "POST" }).catch(() => {}); window.location.replace("/login"); }}>Cerrar sesión</button>
          {/* El clic ya cuenta como uso (pointerdown); además se le avisa al servidor */}
          <button type="button" className="btn btn-primary" autoFocus onClick={() => { fetch("/api/sesion/activa", { cache: "no-store" }).catch(() => {}); setRestan(null); }}>Seguir conectado</button>
        </div>
      </div>
    </div>
  );
}
