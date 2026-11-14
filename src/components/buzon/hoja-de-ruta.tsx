"use client";
// Hoja de ruta en columnas por estado. La usan los clientes (con voto) y el panel (solo lectura).
import { useState, useTransition } from "react";
import { IconThumbUp, IconThumbUpFilled } from "@tabler/icons-react";
import { votarFuncion } from "@/app/acciones/sugerencias";

export type ItemHoja = { id: string; titulo: string; descripcion: string; estado: string; modulo: string; votos: number; votada: boolean };
export const COLUMNAS_HOJA = [
  { estado: "NUEVA", titulo: "Pedida" },
  { estado: "EN_REVISION", titulo: "Evaluando" },
  { estado: "EN_DESARROLLO", titulo: "En desarrollo" },
  { estado: "HECHA", titulo: "Hecha" },
] as const;

export function HojaDeRuta({ items, votar }: { items: ItemHoja[]; votar: boolean }) {
  const [lista, setLista] = useState(items);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const alternar = (id: string) => { setError(null); iniciar(async () => {
    const r = await votarFuncion(id);
    if (!r.ok) { setError(r.error); return; }
    setLista(l => l.map(i => i.id === id ? { ...i, votada: !!r.votado, votos: Math.max(0, i.votos + (r.votado ? 1 : -1)) } : i));
  }); };
  return (
    <>
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, alignItems: "start" }}>
        {COLUMNAS_HOJA.map(c => {
          const delEstado = lista.filter(i => i.estado === c.estado).sort((a, b) => b.votos - a.votos);
          return (
            <section key={c.estado} aria-label={c.titulo} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{c.titulo} <span style={{ color: "var(--text-muted)" }}>({delEstado.length})</span></h2>
              {delEstado.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nada por ahora.</div>}
              {delEstado.map(i => (
                <article key={i.id} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{i.modulo}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{i.titulo}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{i.descripcion}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{i.votos} {i.votos === 1 ? "granja la pide" : "granjas la piden"}</span>
                    {votar && c.estado !== "HECHA" && (
                      <button type="button" className={i.votada ? "btn btn-primary" : "btn"} style={{ height: 28, fontSize: 12, gap: 4 }} disabled={pendiente} aria-pressed={i.votada} onClick={() => alternar(i.id)}>
                        {i.votada ? <IconThumbUpFilled size={14} aria-hidden /> : <IconThumbUp size={14} aria-hidden />} Yo también la quiero
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
