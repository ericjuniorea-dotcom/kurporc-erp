"use client";
// Ventana con los animales de un cuadro del Plantel (Stock general, Preñadas, Servidas, Disponibles,
// Reproductores, Cuarentena). Clic en una cerda abre su ficha.
import { useEffect, useMemo, useState } from "react";
import { IconLoader2, IconSearch, IconX } from "@tabler/icons-react";
import { CaravanaFicha } from "@/components/plantel/caravana-ficha";

export type GrupoPlantel = "GENERAL" | "MATERNIDAD" | "PRENADAS" | "SERVIDAS" | "DISPONIBLES" | "REPRODUCTORES" | "CUARENTENA";
type Fila = { id: string; tipo: "cerda" | "verraco"; caravana: string; categoria: string; estado: string; linea: string | null; fecha: string | null; dias: number | null; detalle: string };

const TEXTOS: Record<GrupoPlantel, { titulo: string; sub: string; fecha: string; dias: string }> = {
  GENERAL:       { titulo: "Stock general", sub: "Todas las reproductoras activas y los reproductores", fecha: "Desde", dias: "Días" },
  MATERNIDAD:    { titulo: "Reproductoras en maternidad", sub: "Partos activos sin destete", fecha: "Fecha de parto", dias: "Días de lactancia" },
  PRENADAS:      { titulo: "Preñadas", sub: "Gestación confirmada", fecha: "Fecha de servicio", dias: "Días de gestación" },
  SERVIDAS:      { titulo: "Servidas", sub: "Pendientes de diagnóstico", fecha: "Fecha de servicio", dias: "Días desde el servicio" },
  DISPONIBLES:   { titulo: "Disponibles", sub: "Listas para inseminación", fecha: "Desde", dias: "Días" },
  REPRODUCTORES: { titulo: "Reproductores", sub: "Activos y en descanso", fecha: "Ingreso", dias: "Días" },
  CUARENTENA:    { titulo: "Cuarentena", sub: "Reproductoras en cuarentena", fecha: "Ingreso", dias: "Días en cuarentena" },
};
const fmt = (s: string | null) => s ? new Date(s).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";

export function ModalGrupoPlantel({ grupo, onClose, onVerFicha }: { grupo: GrupoPlantel; onClose: () => void; onVerFicha: (sowId: string) => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [categoria, setCategoria] = useState("");
  const t = TEXTOS[grupo];

  useEffect(() => {
    let vivo = true;
    fetch(`/api/plantel/stats/detalle?grupo=${grupo}`).then(r => r.ok ? r.json() : Promise.reject()).then(d => { if (vivo) setFilas(d); }).catch(() => { if (vivo) setError(true); });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => { vivo = false; window.removeEventListener("keydown", esc); };
  }, [grupo, onClose]);

  const categorias = useMemo(() => Array.from(new Set((filas ?? []).map(f => f.categoria))), [filas]);
  const visibles = (filas ?? []).filter(f => (!buscar || f.caravana.toLowerCase().includes(buscar.toLowerCase())) && (!categoria || f.categoria === categoria));

  return (
    <div role="presentation" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-grupo" onClick={e => e.stopPropagation()}
        style={{ background: "var(--bg-surface)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--border-default)", width: "min(920px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "0.5px solid var(--border-default)", flexShrink: 0 }}>
          <div>
            <h2 id="titulo-grupo" style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
              {t.titulo} {filas && <span style={{ color: "var(--accent-text, var(--accent))", fontSize: 13, marginLeft: 6 }}>{filas.length}</span>}
            </h2>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>{t.sub}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex" }}><IconX size={16} /></button>
        </div>
        <div style={{ display: "flex", gap: 8, padding: "12px 20px", flexWrap: "wrap", flexShrink: 0 }}>
          <label style={{ flex: "1 1 220px", position: "relative", display: "flex" }}>
            <IconSearch size={14} aria-hidden style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
            <input className="kp-input" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por caravana…" aria-label="Buscar por caravana" style={{ paddingLeft: 30, height: 34, width: "100%" }} />
          </label>
          {grupo === "GENERAL" && categorias.length > 1 && (
            <select className="kp-input" value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Categoría" style={{ height: 34, width: "auto" }}>
              <option value="">Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {error ? <div style={{ padding: 30, textAlign: "center", fontSize: 13, color: "var(--danger-text)" }}>No se pudo cargar la lista.</div>
            : !filas ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: "var(--text-muted)", gap: 8, fontSize: 13 }}><IconLoader2 size={16} className="animate-spin" aria-hidden /> Cargando…</div>
            : visibles.length === 0 ? <div style={{ padding: 30, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>No hay animales en este grupo.</div>
            : (
              <table className="kp-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Caravana</th>
                    {grupo === "GENERAL" && <th>Categoría</th>}
                    <th>Estado</th>
                    <th>Línea genética</th>
                    <th>{t.fecha}</th>
                    <th style={{ textAlign: "right" }}>{t.dias}</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map(f => (
                    <tr key={`${f.tipo}-${f.id}`} onClick={() => { if (f.tipo === "cerda") onVerFicha(f.id); }} style={{ cursor: f.tipo === "cerda" ? "pointer" : "default" }}>
                      <td style={{ fontWeight: 600 }}>{f.tipo === "cerda" ? <CaravanaFicha sowId={f.id} caravana={f.caravana} /> : f.caravana}</td>
                      {grupo === "GENERAL" && <td>{f.categoria}</td>}
                      <td style={{ fontSize: 12 }}>{f.estado}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{f.linea ?? "—"}</td>
                      <td>{fmt(f.fecha)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{f.dias ?? "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{f.detalle || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
      </div>
    </div>
  );
}
