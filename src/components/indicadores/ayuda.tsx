"use client";
// Ayuda de indicadores: al pasar el mouse (o tocar, en el celular) sobre un indicador aparece una nube con
// «Cómo se calcula» y «Para qué sirve». Cada usuario la prende o la apaga en Configuración → Generales.
// Los textos salen del catálogo único (src/lib/indicadores/catalogo.ts).
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { IconInfoCircle } from "@tabler/icons-react";
import { INDICADORES, type ClaveIndicador, type Indicador } from "@/lib/indicadores/catalogo";

type Pref = { ayuda: boolean; setAyuda: (v: boolean) => void };
const Ctx = createContext<Pref>({ ayuda: true, setAyuda: () => {} });

export function PreferenciasProvider({ ayudaIndicadores, children }: { ayudaIndicadores: boolean; children: React.ReactNode }) {
  const [ayuda, setAyuda] = useState(ayudaIndicadores);
  return <Ctx.Provider value={{ ayuda, setAyuda }}>{children}</Ctx.Provider>;
}
export const usePreferencias = () => useContext(Ctx);

/**
 * Envuelve el nombre (o la tarjeta) de un indicador. Con la ayuda prendida muestra la nube al pasar el mouse,
 * al enfocar con el teclado o al tocar; con la ayuda apagada solo muestra el contenido.
 */
export function AyudaIndicador({ clave, info, children, icono = true, bloque = false }: {
  clave?: ClaveIndicador; info?: Pick<Indicador, "nombre" | "formula" | "paraQue">;
  children: React.ReactNode; icono?: boolean; bloque?: boolean;
}) {
  const { ayuda } = usePreferencias();
  const [abierta, setAbierta] = useState(false);
  const [arriba, setArriba] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const datos = info ?? (clave ? INDICADORES[clave] : null);

  const abrir = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setArriba(window.innerHeight - r.bottom < 220 && r.top > 220);
    setAbierta(true);
  }, []);
  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierta(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierta(false); };
    document.addEventListener("pointerdown", fuera); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierta]);

  if (!ayuda || !datos) return <>{children}</>;
  const Tag = bloque ? "div" : "span";
  return (
    <Tag ref={ref as React.Ref<HTMLDivElement & HTMLSpanElement>} style={{ position: "relative", display: bloque ? "block" : "inline-flex", alignItems: "center", gap: 4, cursor: "help" }}
      onMouseEnter={abrir} onMouseLeave={() => setAbierta(false)} onFocus={abrir} onBlur={() => setAbierta(false)}
      onClick={e => { e.preventDefault(); e.stopPropagation(); if (abierta) setAbierta(false); else abrir(); }} tabIndex={0} aria-describedby={abierta ? id : undefined}>
      {children}
      {icono && <IconInfoCircle size={12} aria-hidden style={{ color: "var(--text-muted)", flexShrink: 0, opacity: 0.7 }} />}
      {abierta && (
        <span role="tooltip" id={id} style={{
          position: "absolute", zIndex: 60, left: 0, [arriba ? "bottom" : "top"]: "calc(100% + 6px)",
          width: "min(300px, calc(100vw - 32px))", padding: "10px 12px", borderRadius: "var(--radius-md)",
          background: "var(--bg-surface)", border: "0.5px solid var(--border-strong)", boxShadow: "0 8px 24px rgba(0,0,0,.14)",
          fontSize: 12, lineHeight: 1.45, color: "var(--text-secondary)", textAlign: "left", fontWeight: 400,
          textTransform: "none", letterSpacing: 0, whiteSpace: "normal", cursor: "default",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          <strong style={{ color: "var(--text-primary)", fontWeight: 600, fontSize: 12.5 }}>{datos.nombre}</strong>
          <span><b style={{ fontWeight: 600, color: "var(--text-primary)" }}>Cómo se calcula: </b>{datos.formula}</span>
          <span><b style={{ fontWeight: 600, color: "var(--text-primary)" }}>Para qué sirve: </b>{datos.paraQue}</span>
        </span>
      )}
    </Tag>
  );
}

/** Nota al pie «Cómo se calcula» con la fórmula de cada indicador de la pantalla (siempre visible). */
export function ComoSeCalcula({ claves, titulo = "Cómo se calcula cada indicador" }: { claves: ClaveIndicador[]; titulo?: string }) {
  return (
    <section aria-label={titulo} style={{ fontSize: 11.5, color: "var(--text-muted)", borderTop: "0.5px solid var(--border-default)", paddingTop: 8 }}>
      <h4 style={{ margin: 0, fontSize: 11.5, color: "var(--text-secondary)", fontWeight: 500 }}>{titulo}</h4>
      <dl className="kp-como-se-calcula" style={{ margin: "8px 0 0", display: "grid", gridTemplateColumns: "minmax(140px, 220px) 1fr", gap: "4px 12px" }}>
        {claves.map(c => (
          <div key={c} style={{ display: "contents" }}>
            <dt style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{INDICADORES[c].nombre}</dt>
            <dd style={{ margin: 0 }}>{INDICADORES[c].formula}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
