"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/auth/marco-auth";
import { borrarAporte, crearAporte } from "@/app/acciones/finanzas";
import { gs, nombreMes } from "@/lib/finanzas/calculos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export function Aportes({ aportes, editable, desde }: { aportes: { id: string; mes: number; montoGs: string; descripcion: string }[]; editable: boolean; desde: number }) {
  const router = useRouter();
  const [mes, setMes] = useState(`${Math.floor(desde / 100)}-${String(desde % 100).padStart(2, "0")}`);
  const [monto, setMonto] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>) => { setError(null); iniciar(async () => { const r = await fn(); if (r.ok) { setMonto(""); setDesc(""); router.refresh(); } else setError(r.error ?? "Error"); }); };
  return (
    <div style={{ ...tarjeta, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Aportes de capital previstos</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Plata que el titular o los socios piensan poner. Los aportes reales se cargan en Movimientos (categoría «Aporte de capital») con su comprobante.</div>
      {aportes.length > 0 && (
        <table className="kp-table">
          <thead><tr><th>Mes</th><th style={{ textAlign: "right" }}>Monto</th><th>Descripción</th><th></th></tr></thead>
          <tbody>
            {aportes.map(a => (
              <tr key={a.id}>
                <td>{nombreMes(a.mes)}</td><td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(a.montoGs)}</td><td>{a.descripcion || "—"}</td>
                <td style={{ textAlign: "right" }}>{editable && <button type="button" className="btn" style={{ height: 24, fontSize: 11 }} disabled={pendiente} onClick={() => correr(() => borrarAporte(a.id))}>Quitar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editable && (
        <form onSubmit={e => { e.preventDefault(); const [y, m] = mes.split("-").map(Number); correr(() => crearAporte({ mes: y * 100 + m, montoGs: monto, descripcion: desc })); }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}><span className="kp-label">Mes</span><input type="month" className="kp-input" value={mes} onChange={e => setMes(e.target.value)} required /></label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}><span className="kp-label">Monto (₲)</span><input className="kp-input" inputMode="numeric" value={monto} onChange={e => setMonto(e.target.value.replace(/\D/g, ""))} required /></label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 180 }}><span className="kp-label">Descripción</span><input className="kp-input" value={desc} onChange={e => setDesc(e.target.value)} maxLength={200} /></label>
          <button type="submit" className="btn btn-primary" disabled={pendiente || !monto} style={{ height: 34 }}>Agregar</button>
        </form>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
    </div>
  );
}
