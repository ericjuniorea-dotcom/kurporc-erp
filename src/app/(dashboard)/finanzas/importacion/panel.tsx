"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/auth/marco-auth";
import { resolverRevision } from "@/app/acciones/finanzas";
import { gs } from "@/lib/finanzas/calculos";

type Fila = { id: string; fila: number; datos: Record<string, string | number | null> };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const f = (iso: unknown) => (typeof iso === "string" && iso ? iso.split("-").reverse().join("/") : "—");

export function PanelRevision({ filas, editable, resumen }: { filas: Fila[]; editable: boolean; resumen: { importados: number; originales: number } }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const abiertas = filas.filter(x => !x.datos.decision);
  const resolver = (id: string, decision: "CARGAR" | "DESCARTAR") => {
    setMsg(null);
    iniciar(async () => {
      const r = await resolverRevision(id, decision);
      setMsg(r.ok ? { tipo: "ok", texto: decision === "CARGAR" ? "Cargada en el libro como pendiente: ya aparece en Por pagar." : "Descartada." } : { tipo: "error", texto: r.error });
      if (r.ok) router.refresh();
    });
  };
  return (
    <>
      <div style={{ ...tarjeta, padding: 14, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        Se importaron <strong>{resumen.importados}</strong> movimientos de la planilla (marcados como «importación») y se guardó una copia fiel de {resumen.originales} filas de DATOS ORIGINALES.
        La planilla llevaba las cuentas por pagar en una hoja aparte del libro: estas no figuran como pendientes en el libro. Decidí cada una: si es una deuda real, cargala; si ya se pagó o está repetida, descartala.
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {filas.length === 0 && <div style={{ ...tarjeta, padding: 16, fontSize: 13 }}>No hay nada para revisar.</div>}
      {filas.length > 0 && (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Cuentas por pagar para revisar ({abiertas.length} sin decidir)</div>
          <table className="kp-table" style={{ minWidth: 900 }}>
            <thead><tr><th>Emisión</th><th>Proveedor</th><th>Concepto</th><th style={{ textAlign: "right" }}>Saldo</th><th>Vence</th><th>Por qué está acá</th><th></th></tr></thead>
            <tbody>
              {filas.map(x => (
                <tr key={x.id} style={{ opacity: x.datos.decision ? 0.55 : 1 }}>
                  <td>{f(x.datos.fecha)}</td>
                  <td style={{ color: "var(--text-primary)" }}>{x.datos.proveedor}</td>
                  <td>{x.datos.concepto}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{x.datos.categoria}{x.datos.factura ? ` · Fact. ${x.datos.factura}` : ""}</div></td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(Number(x.datos.saldoGs ?? x.datos.montoGs ?? 0))}</td>
                  <td>{f(x.datos.vencimiento)}</td>
                  <td style={{ fontSize: 11.5, color: /verificar/i.test(String(x.datos.motivo)) ? "var(--warning-text)" : "var(--text-secondary)" }}>{x.datos.motivo}{x.datos.observacion ? <div style={{ color: "var(--text-muted)" }}>{String(x.datos.observacion).slice(0, 120)}</div> : null}</td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {x.datos.decision ? <span style={{ fontSize: 11.5 }}>{x.datos.decision === "CARGAR" ? "Cargada" : "Descartada"}</span> : editable && (
                      <>
                        <button type="button" className="btn btn-primary" style={{ height: 26, fontSize: 11 }} disabled={pendiente} onClick={() => resolver(x.id, "CARGAR")}>Cargar</button>
                        <button type="button" className="btn" style={{ height: 26, fontSize: 11, marginLeft: 4 }} disabled={pendiente} onClick={() => resolver(x.id, "DESCARTAR")}>Descartar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
