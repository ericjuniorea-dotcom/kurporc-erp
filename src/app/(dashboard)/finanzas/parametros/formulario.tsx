"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { guardarParametros } from "@/app/acciones/finanzas";
import { PARAMETROS } from "@/lib/finanzas/parametros";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export function FormularioParametros({ valores, editable }: { valores: Record<string, string>; editable: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(valores);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const grupos = Array.from(new Set(PARAMETROS.map(p => p.grupo)));
  const set = (k: string, x: string) => setV(o => ({ ...o, [k]: x }));

  return (
    <form onSubmit={e => { e.preventDefault(); setMsg(null); iniciar(async () => { const r = await guardarParametros(v); setMsg(r.ok ? { tipo: "ok", texto: "Parámetros guardados. Todas las hojas se recalculan con estos valores." } : { tipo: "error", texto: r.error }); if (r.ok) router.refresh(); }); }}
      style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Metas y supuestos de tu granja. Todo lo demás se calcula con estos valores.</div>
      {grupos.map(g => (
        <fieldset key={g} disabled={!editable} style={{ ...tarjeta, padding: 14, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <legend style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", padding: "0 6px" }}>{g}</legend>
          {PARAMETROS.filter(p => p.grupo === g).map(p => (
            <label key={p.clave} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="kp-label">{p.etiqueta}{p.tipo === "pct" ? " (%)" : p.tipo === "gs" ? " (₲)" : ""}</span>
              {p.tipo === "bool" ? (
                <select className="kp-input" value={v[p.clave]} onChange={e => set(p.clave, e.target.value)}><option value="true">Sí</option><option value="false">No</option></select>
              ) : p.tipo === "sel" ? (
                <select className="kp-input" value={v[p.clave]} onChange={e => set(p.clave, e.target.value)}>{Object.entries(p.opciones ?? {}).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
              ) : (
                <input className="kp-input" inputMode="decimal" value={v[p.clave]} onChange={e => set(p.clave, e.target.value)} placeholder={p.opcional ? "Vacío" : undefined} />
              )}
              {p.ayuda && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.ayuda}</span>}
            </label>
          ))}
        </fieldset>
      ))}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {editable && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className="btn btn-primary" disabled={pendiente} style={{ height: 36 }}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar parámetros</button>
        </div>
      )}
    </form>
  );
}
