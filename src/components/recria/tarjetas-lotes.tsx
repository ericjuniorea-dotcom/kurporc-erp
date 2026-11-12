"use client";
// Iniciación → Visión general: un carrusel con los lotes abiertos (días de alojamiento contra la meta).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconChevronLeft, IconChevronRight, IconChevronDown, IconPigMoney } from "@tabler/icons-react";

type Lote = { id: string; codigo: string; fase: "PHASE_1" | "PHASE_2"; animales: number; ubicacion: string | null; dias: number; peso: number | null; fechaPeso: string | null };
type Datos = { lotes: Lote[]; metas: { diasFase: number; pesoSalidaKg: number } };

/** Verde hasta el 80 % de la meta de días, ámbar hasta la meta, rojo pasada la meta. */
function colorDias(dias: number, meta: number) {
  if (dias > meta) return { barra: "var(--danger)", texto: "var(--danger-text)" };
  if (dias > meta * 0.8) return { barra: "var(--warning)", texto: "var(--warning-text)" };
  return { barra: "var(--success)", texto: "var(--success-text)" };
}

export function TarjetasLotes() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [abierto, setAbierto] = useState(true);
  const pista = useRef<HTMLDivElement>(null);
  useEffect(() => { fetch("/api/recria/resumen").then(r => (r.ok ? r.json() : null)).then(setDatos).catch(() => setDatos(null)); }, []);
  if (!datos) return null;
  const mover = (dir: number) => pista.current?.scrollBy({ left: dir * (pista.current.clientWidth * 0.9), behavior: "smooth" });
  const total = datos.lotes.reduce((s, l) => s + l.animales, 0);

  return (
    <section aria-labelledby="t-lotes" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto} style={{ background: "none", border: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
          <h2 id="t-lotes" style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Lotes abiertos ({datos.lotes.length})</h2>
          <IconChevronDown size={14} style={{ transform: abierto ? "none" : "rotate(-90deg)", transition: "transform .15s", color: "var(--text-muted)" }} aria-hidden />
        </button>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{total.toLocaleString("es-PY")} animales · meta {datos.metas.diasFase} días en la fase</span>
        {abierto && datos.lotes.length > 2 && (
          <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button className="btn" style={{ height: 28, width: 28, padding: 0, justifyContent: "center" }} aria-label="Lotes anteriores" onClick={() => mover(-1)}><IconChevronLeft size={15} /></button>
            <button className="btn" style={{ height: 28, width: 28, padding: 0, justifyContent: "center" }} aria-label="Lotes siguientes" onClick={() => mover(1)}><IconChevronRight size={15} /></button>
          </span>
        )}
      </div>
      {abierto && (datos.lotes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", padding: 16, background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>No hay lotes abiertos. Se crean al registrar un destete.</div>
      ) : (
        <div ref={pista} style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(280px, calc((100% - 24px) / 3))", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory", paddingBottom: 4 }}>
          {datos.lotes.map(l => {
            const c = colorDias(l.dias, datos.metas.diasFase);
            const pct = Math.min(100, (l.dias / datos.metas.diasFase) * 100);
            return (
              <article key={l.id} style={{ scrollSnapAlign: "start", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: 14, display: "flex", gap: 12 }}>
                  <span aria-hidden style={{ width: 44, height: 44, borderRadius: 999, background: "var(--info-subtle)", color: "var(--info)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconPigMoney size={22} /></span>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                      <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>{l.codigo}</strong>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.ubicacion ?? "Sin ubicación"}</span>
                    </div>
                    <div aria-hidden style={{ height: 6, borderRadius: 99, background: "var(--bg-subtle)", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: c.barra, borderRadius: 99 }} /></div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: c.texto }}>{l.dias} días de alojamiento{l.dias > datos.metas.diasFase ? ` · ${l.dias - datos.metas.diasFase} de más` : ""}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{l.animales.toLocaleString("es-PY")} animales{l.peso !== null ? ` · ${l.peso.toLocaleString("es-PY", { maximumFractionDigits: 1 })} kg promedio` : " · sin pesaje"}</div>
                    <span style={{ alignSelf: "flex-start", fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: l.fase === "PHASE_2" ? "var(--accent-subtle)" : "var(--info-subtle)", color: l.fase === "PHASE_2" ? "var(--accent-text)" : "var(--info-text)" }}>{l.fase === "PHASE_2" ? "Fase 2" : "Fase 1"}</span>
                  </div>
                </div>
                <div style={{ marginTop: "auto", borderTop: "0.5px solid var(--border-default)", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "var(--text-muted)" }}>{l.fechaPeso ? `Pesado el ${l.fechaPeso.slice(8, 10)}/${l.fechaPeso.slice(5, 7)}` : ""}</span>
                  <Link href={`/recria/lotes/${l.id}`} style={{ fontWeight: 600, color: "var(--accent-text, var(--accent))" }}>Ficha del lote →</Link>
                </div>
              </article>
            );
          })}
        </div>
      ))}
    </section>
  );
}
