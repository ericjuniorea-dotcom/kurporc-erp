"use client";
import { useState, useTransition } from "react";
import { actualizarSugerencia } from "@/app/acciones/sugerencias";

const TIPO: Record<string, string> = { SUGERENCIA: "Idea", PROBLEMA: "Problema", CONSULTA: "Duda" };
type S = { id: string; tipo: string; mensaje: string; pagina: string | null; estado: string; respuesta: string | null; fecha: string; persona: string; email: string | null; organizacion: string | null };

export function FilaSugerencia({ s }: { s: S }) {
  const [respuesta, setRespuesta] = useState(s.respuesta ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const guardar = (estado: string) => { setError(null); iniciar(async () => {
    const r = await actualizarSugerencia({ id: s.id, estado, respuesta });
    if (!r.ok) setError(r.error);
  }); };
  return (
    <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 12, color: "var(--text-muted)" }}>
        <span><strong style={{ color: "var(--text-primary)" }}>{TIPO[s.tipo] ?? s.tipo}</strong> · {s.persona}{s.email && <> · <a href={`mailto:${s.email}`}>{s.email}</a></>}{s.organizacion && <> · {s.organizacion}</>}</span>
        <span>{new Date(s.fecha).toLocaleString("es-PY")}{s.pagina && <> · {s.pagina}</>}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>{s.mensaje}</div>
      <textarea className="kp-input" value={respuesta} onChange={e => setRespuesta(e.target.value)} rows={2} maxLength={4000} aria-label="Respuesta"
        placeholder="Respuesta (la persona la ve en el botón de ayuda)" style={{ height: "auto", minHeight: 52, padding: 8 }} />
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[["EN_REVISION", "En revisión"], ["HECHA", "Hecha"], ["DESCARTADA", "Descartar"], ["NUEVA", "Volver a nuevas"]].filter(([k]) => k !== s.estado).map(([k, v]) => (
          <button key={k} type="button" className={k === "HECHA" ? "btn btn-primary" : "btn"} style={{ height: 28, fontSize: 12 }} disabled={pendiente} onClick={() => guardar(k)}>{v}</button>
        ))}
        {respuesta !== (s.respuesta ?? "") && <button type="button" className="btn" style={{ height: 28, fontSize: 12 }} disabled={pendiente} onClick={() => guardar(s.estado)}>Guardar respuesta</button>}
      </div>
    </div>
  );
}
