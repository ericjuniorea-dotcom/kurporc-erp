"use client";
import { useState, useTransition } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { crearTareaEcografia, crearTareaParada } from "@/app/acciones/cerdas-paradas";

export function BotonTarea({ sowId, ecografia }: { sowId: string; ecografia?: boolean }) {
  const [estado, setEstado] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  if (estado === "ok") return <span style={{ fontSize: 12, color: "var(--success)" }}>Tarea creada</span>;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <button type="button" className="btn" style={{ height: 26, fontSize: 12 }} disabled={pendiente}
        onClick={() => iniciar(async () => { const r = await (ecografia ? crearTareaEcografia(sowId) : crearTareaParada(sowId)); setEstado(r.ok ? "ok" : r.error); })}>
        {pendiente && <IconLoader2 size={12} className="animate-spin" aria-hidden />} Crear tarea
      </button>
      {estado && estado !== "ok" && <span role="alert" style={{ fontSize: 11, color: "var(--danger)" }}>{estado}</span>}
    </span>
  );
}

/** Línea simple con un punto por mes; al pasar el mouse muestra el valor. */
export function Tendencia({ puntos }: { puntos: { etiqueta: string; valor: number; texto: string }[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  if (puntos.length === 0) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin datos.</div>;
  const W = 520, H = 160, pad = 24, max = Math.max(1, ...puntos.map(p => p.valor));
  const x = (i: number) => pad + (puntos.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (puntos.length - 1));
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const ruta = puntos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={puntos.map(p => `${p.etiqueta}: ${p.texto}`).join("; ")} onMouseLeave={() => setActivo(null)}>
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="var(--border-default)" />
        <path d={ruta} fill="none" stroke="var(--danger)" strokeWidth={2} strokeLinejoin="round" />
        {puntos.map((p, i) => (
          <g key={i}>
            <rect x={x(i) - 18} y={0} width={36} height={H} fill="transparent" onMouseEnter={() => setActivo(i)} />
            <circle cx={x(i)} cy={y(p.valor)} r={activo === i ? 5 : 4} fill="var(--danger)" stroke="var(--bg-surface)" strokeWidth={2} />
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{p.etiqueta}</text>
          </g>
        ))}
      </svg>
      {activo !== null && (
        <div style={{ position: "absolute", left: `${(x(activo) / W) * 100}%`, top: 0, transform: "translateX(-50%)", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "var(--text-primary)", pointerEvents: "none", whiteSpace: "nowrap" }}>
          {puntos[activo].etiqueta}: {puntos[activo].texto}
        </div>
      )}
    </div>
  );
}
