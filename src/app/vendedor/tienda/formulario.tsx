"use client";
import { useState, useTransition } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { guardarTienda } from "@/app/acciones/vendedor";
import { DEPARTAMENTOS } from "@/lib/validaciones/paraguay";

type Datos = { descripcion: string; zonasEntrega: string[]; horario: string; whatsapp: string };
const etiqueta: React.CSSProperties = { fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 };

export function FormularioTienda({ inicial, puedeEditar }: { inicial: Datos; puedeEditar: boolean }) {
  const [d, setD] = useState(inicial);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form onSubmit={e => { e.preventDefault(); setMsg(null); iniciar(async () => { const r = await guardarTienda({ ...d, zonasEntrega: d.zonasEntrega as (typeof DEPARTAMENTOS)[number][] }); setMsg(r.ok ? { ok: true, t: "Guardado." } : { ok: false, t: r.error }); }); }}
      style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 12, maxWidth: 820 }}>
      <fieldset disabled={!puedeEditar} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={etiqueta}>Descripción de la tienda
          <textarea className="kp-input" rows={4} maxLength={2000} value={d.descripcion} onChange={e => setD({ ...d, descripcion: e.target.value })} style={{ height: "auto", padding: 8 }} placeholder="Qué vendés, desde cuándo, marcas que representás, formas de pago…" />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <label style={etiqueta}>WhatsApp de ventas
            <input className="kp-input" value={d.whatsapp} maxLength={30} onChange={e => setD({ ...d, whatsapp: e.target.value })} placeholder="+595 981 000000" />
          </label>
          <label style={etiqueta}>Horario de atención
            <input className="kp-input" value={d.horario} maxLength={200} onChange={e => setD({ ...d, horario: e.target.value })} placeholder="Lunes a sábado, 7 a 17 h" />
          </label>
        </div>
        <div style={etiqueta}>Departamentos donde entregás (se proponen al cargar cada producto)
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {DEPARTAMENTOS.map(dep => {
              const sel = d.zonasEntrega.includes(dep);
              return <button key={dep} type="button" aria-pressed={sel} className="btn" onClick={() => setD({ ...d, zonasEntrega: sel ? d.zonasEntrega.filter(z => z !== dep) : [...d.zonasEntrega, dep] })}
                style={{ height: 28, fontSize: 12, fontWeight: sel ? 600 : 400, borderColor: sel ? "var(--accent)" : undefined }}>{dep}</button>;
            })}
          </div>
        </div>
      </fieldset>
      {puedeEditar ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="submit" className="btn btn-primary" style={{ height: 36 }} disabled={pendiente}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar</button>
          {msg && <span style={{ fontSize: 12.5, color: msg.ok ? "var(--success-text)" : "var(--danger-text)" }}>{msg.t}</span>}
        </div>
      ) : <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No tenés permiso para editar el perfil de la tienda.</div>}
    </form>
  );
}
