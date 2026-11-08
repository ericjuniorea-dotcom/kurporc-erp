"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2 } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { cerrarMes, reabrirMes } from "@/app/acciones/finanzas";
import type { Control, PasoCierre } from "@/lib/finanzas/control";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export function PanelCierre(p: {
  mes: number; meses: { mes: number; nombre: string; estado: string }[]; estado: string; cerradoEn: string | null; motivoReapertura: string | null;
  pasos: PasoCierre[]; controles: Control[]; puedeReabrir: boolean;
}) {
  const router = useRouter();
  const [manual, setManual] = useState({ produccion: false, balanceado: false, pendientes: false });
  const [motivo, setMotivo] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const cerrado = p.estado === "CERRADO";
  const pasos = p.pasos.map(x => (x.manual ? { ...x, ok: manual[x.clave as keyof typeof manual] } : x));
  const listo = pasos.every(x => x.ok);
  const nombre = p.meses.find(m => m.mes === p.mes)?.nombre ?? String(p.mes);

  return (
    <>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {p.meses.map(m => (
          <button key={m.mes} type="button" className="btn" onClick={() => router.push(`/finanzas/cierre?mes=${m.mes}`)}
            style={{ height: 28, fontSize: 12, borderColor: m.mes === p.mes ? "var(--accent)" : undefined }}>
            {m.nombre}{m.estado === "CERRADO" ? " 🔒" : ""}
          </button>
        ))}
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
          {cerrado ? `${nombre} está cerrado` : `Cerrar ${nombre}`}
        </div>
        {cerrado ? (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
              Cerrado el {p.cerradoEn ? new Date(p.cerradoEn).toLocaleString("es-PY") : "—"}. El libro de ese mes es de solo lectura: no se cargan, cambian ni pagan movimientos con fecha de {nombre}.
            </div>
            {p.puedeReabrir && (
              <form onSubmit={e => { e.preventDefault(); setMsg(null); iniciar(async () => { const r = await reabrirMes(p.mes, motivo); setMsg(r.ok ? { tipo: "ok", texto: `${nombre} quedó abierto otra vez. Quedó registrado el motivo.` } : { tipo: "error", texto: r.error }); if (r.ok) router.refresh(); }); }}
                style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 240 }}><span className="kp-label">Motivo para reabrir</span><input className="kp-input" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300} required /></label>
                <button type="submit" className="btn btn-danger" disabled={pendiente || motivo.trim().length < 5}>Reabrir</button>
              </form>
            )}
          </>
        ) : (
          <>
            {p.motivoReapertura && <div style={{ fontSize: 12, color: "var(--warning-text)" }}>Se reabrió: {p.motivoReapertura}</div>}
            <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {pasos.map((x, i) => (
                <li key={x.clave} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13 }}>
                  {x.manual ? (
                    <input type="checkbox" checked={x.ok} onChange={e => setManual(m => ({ ...m, [x.clave]: e.target.checked }))} style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--accent)" }} aria-label={x.nombre} />
                  ) : (
                    <span aria-hidden style={{ width: 16, textAlign: "center", color: x.ok ? "var(--success-text)" : "var(--danger-text)", fontWeight: 600 }}>{x.ok ? "✓" : "✗"}</span>
                  )}
                  <span>
                    <span style={{ color: "var(--text-primary)" }}>{i + 1}. {x.nombre}</span>
                    {!x.manual && <span style={{ display: "block", fontSize: 11.5, color: x.ok ? "var(--text-muted)" : "var(--danger-text)" }}>{x.detalle}</span>}
                  </span>
                </li>
              ))}
            </ol>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-primary" disabled={pendiente || !listo} style={{ height: 36 }}
                onClick={() => { setMsg(null); iniciar(async () => { const r = await cerrarMes(p.mes, manual); setMsg(r.ok ? { tipo: "ok", texto: `${nombre} cerrado. Se guardó la foto de los indicadores y se generaron ${r.recomendaciones} recomendación(es).` } : { tipo: "error", texto: r.error }); if (r.ok) router.refresh(); }); }}>
                {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Cerrar {nombre}
              </button>
            </div>
          </>
        )}
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Controles del libro (todos tienen que dar 0)</div>
        <table className="kp-table" style={{ minWidth: 760 }}>
          <thead><tr><th>N°</th><th>Control</th><th style={{ textAlign: "right" }}>Resultado</th><th>Qué hacer si no da cero</th></tr></thead>
          <tbody>
            {p.controles.map(c => (
              <tr key={c.codigo}>
                <td>{c.codigo}</td>
                <td style={{ color: "var(--text-primary)" }}>{c.nombre}{c.detalle && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.detalle}</div>}</td>
                <td style={{ textAlign: "right", fontWeight: 600, color: c.noAplica ? "var(--text-muted)" : c.valor === 0 ? "var(--success-text)" : "var(--danger-text)" }}>{c.noAplica ? "No aplica" : c.valor}</td>
                <td style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{c.queHacer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
