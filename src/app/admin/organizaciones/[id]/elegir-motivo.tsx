"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { elegirMotivo, entrarModoPlataforma } from "@/app/acciones/admin";

export function ElegirMotivo({ organizacionId, nombre, motivos }: { organizacionId: string; nombre: string; motivos: Record<string, string> }) {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <form onSubmit={e => { e.preventDefault(); setError(null); iniciar(async () => { const r = await elegirMotivo(organizacionId, motivo, detalle); if (r.ok) router.refresh(); else setError(r.error); }); }}
      style={{ maxWidth: 520, background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Ver los datos de {nombre}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.55 }}>
        Elegí el motivo. Vale por 2 horas para esta organización, cada página que veas queda registrada y la organización lo ve en su actividad.
      </div>
      <select className="kp-input" value={motivo} onChange={e => setMotivo(e.target.value)} required aria-label="Motivo">
        <option value="">Elegí un motivo…</option>
        {Object.entries(motivos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <input className="kp-input" value={detalle} onChange={e => setDetalle(e.target.value)} maxLength={200} placeholder={motivo === "OTRO" ? "Detallá el motivo (obligatorio)" : "Detalle (opcional), ej. número de ticket"} />
      {error && <Aviso tipo="error">{error}</Aviso>}
      <button type="submit" className="btn btn-primary" disabled={pendiente || !motivo} style={{ height: 36, justifyContent: "center" }}>
        {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Entrar en modo lectura
      </button>
    </form>
  );
}

/** "Ver todo": abre el ERP de la organización en modo plataforma (solo lectura). */
export function VerTodo({ organizacionId }: { organizacionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} disabled={pendiente}
        onClick={() => iniciar(async () => { const r = await entrarModoPlataforma(organizacionId); if (r.ok) window.location.assign("/dashboard"); else setError(r.error); })}>
        {pendiente && <IconLoader2 size={13} className="animate-spin" aria-hidden />} Ver todo (abrir su ERP en solo lectura)
      </button>
      {error && <span style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</span>}
    </span>
  );
}
