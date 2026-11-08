"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { cambiarEstadoRecomendacion, generarRecomendaciones } from "@/app/acciones/finanzas";

type Rec = { id: string; codigo: string; mes: string; problema: string; situacion: string; mejora: string; impacto: string; prioridad: string; accion: string; estado: string };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const PRIORIDAD: Record<string, string> = { ALTA: "var(--danger-text)", MEDIA: "var(--warning-text)", BAJA: "var(--text-muted)" };
const ESTADOS: Record<string, string> = { ABIERTA: "Abierta", EN_CURSO: "En curso", RESUELTA: "Resuelta", DESCARTADA: "Descartada" };

export function PanelRecomendaciones({ recomendaciones, gestionar, mesCorte, nombreMesCorte }: { recomendaciones: Rec[]; gestionar: boolean; mesCorte: number; nombreMesCorte: string }) {
  const router = useRouter();
  const [verCerradas, setVerCerradas] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const visibles = recomendaciones.filter(r => verCerradas || r.estado === "ABIERTA" || r.estado === "EN_CURSO");
  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Se generan solas al cerrar cada mes, con los números del momento.</span>
        <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}><input type="checkbox" checked={verCerradas} onChange={e => setVerCerradas(e.target.checked)} /> Ver resueltas y descartadas</label>
        {gestionar && (
          <button type="button" className="btn" disabled={pendiente} onClick={() => { setMsg(null); iniciar(async () => { const r = await generarRecomendaciones(mesCorte); setMsg(r.ok ? { tipo: "ok", texto: `${r.cantidad} recomendación(es) para ${nombreMesCorte}.` } : { tipo: "error", texto: r.error }); if (r.ok) router.refresh(); }); }}>
            {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Revisar ahora ({nombreMesCorte})
          </button>
        )}
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {visibles.length === 0 && <div style={{ ...tarjeta, padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>No hay recomendaciones abiertas. ✓</div>}
      {visibles.map(r => (
        <div key={r.id} style={{ ...tarjeta, padding: 14, display: "flex", flexDirection: "column", gap: 6, opacity: r.estado === "RESUELTA" || r.estado === "DESCARTADA" ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{r.problema}</div>
            <div style={{ fontSize: 11.5 }}><span style={{ color: PRIORIDAD[r.prioridad], fontWeight: 600 }}>{r.prioridad}</span> · {r.codigo} · {r.mes} · {ESTADOS[r.estado]}</div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}><strong>Situación:</strong> {r.situacion}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}><strong>Mejora:</strong> {r.mejora} <strong>Impacto:</strong> {r.impacto}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-primary)" }}><strong>Qué hacer:</strong> {r.accion}</div>
          {gestionar && (
            <div style={{ display: "flex", gap: 6 }}>
              {Object.entries(ESTADOS).filter(([k]) => k !== r.estado).map(([k, v]) => (
                <button key={k} type="button" className="btn" style={{ height: 26, fontSize: 11 }} disabled={pendiente}
                  onClick={() => iniciar(async () => { const x = await cambiarEstadoRecomendacion(r.id, k as "RESUELTA"); if (x.ok) router.refresh(); else setMsg({ tipo: "error", texto: x.error }); })}>{v}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
