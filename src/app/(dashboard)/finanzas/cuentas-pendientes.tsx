"use client";
// Cuentas por pagar (8.7) y por cobrar (8.6): una vista sobre los movimientos con saldo, no un segundo registro.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso } from "@/components/auth/marco-auth";
import { gs, nombreMes } from "@/lib/finanzas/calculos";
import { FormularioPago } from "./movimientos/libro";

export type FilaPendiente = {
  id: string; fecha: string; vencimiento: string | null; concepto: string; categoria: string; contraparte: string;
  montoGs: string; pagadoGs: string; saldoGs: string; estado: string; tramo: string; factura: string; observacion: string; mesPago: number | null;
};

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (iso: string | null) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";
const COLOR_ESTADO: Record<string, string> = { VENCIDO: "var(--danger-text)", PENDIENTE: "var(--warning-text)", "SIN VENCIMIENTO": "var(--text-muted)" };

export function CuentasPendientes({ filas, esCobro, puedeRegistrar, cuentas, hoy, resumen }: {
  filas: FilaPendiente[]; esCobro: boolean; puedeRegistrar: boolean; hoy: string;
  cuentas: { id: string; nombre: string; tipo: string }[];
  resumen: { tramo: string; montoGs: string; pct: number | null }[];
}) {
  const router = useRouter();
  const [pagoDe, setPagoDe] = useState<FilaPendiente | null>(null);
  const [tramo, setTramo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const total = filas.reduce((s, f) => s + BigInt(f.saldoGs), 0n);
  const vencido = filas.filter(f => f.estado === "VENCIDO").reduce((s, f) => s + BigInt(f.saldoGs), 0n);
  const visibles = filas.filter(f => !tramo || f.tramo === tramo);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <div style={{ ...tarjeta, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{esCobro ? "Total por cobrar" : "Total por pagar"}</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{gs(total)}</div>
        </div>
        <div style={{ ...tarjeta, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Vencido (meta: ₲ 0)</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: vencido > 0n ? "var(--danger-text)" : "var(--success-text)", fontVariantNumeric: "tabular-nums" }}>{gs(vencido)}</div>
        </div>
        <div style={{ ...tarjeta, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Cantidad</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)" }}>{filas.length}</div>
        </div>
      </div>

      <div style={{ ...tarjeta, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>Por tramo de vencimiento</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={() => setTramo("")} style={{ height: 28, fontSize: 11.5, borderColor: !tramo ? "var(--accent)" : undefined }}>Todos</button>
          {resumen.filter(r => BigInt(r.montoGs) > 0n).map(r => (
            <button key={r.tramo} type="button" className="btn" onClick={() => setTramo(r.tramo)}
              style={{ height: 28, fontSize: 11.5, borderColor: tramo === r.tramo ? "var(--accent)" : undefined, color: r.tramo === "Vencido" ? "var(--danger-text)" : undefined }}>
              {r.tramo}: {gs(r.montoGs)}{r.pct !== null ? ` (${r.pct.toLocaleString("es-PY", { maximumFractionDigits: 1 })} %)` : ""}
            </button>
          ))}
        </div>
      </div>

      {msg && <Aviso tipo="ok">{msg}</Aviso>}
      {pagoDe && (
        <FormularioPago mov={{ id: pagoDe.id, concepto: pagoDe.concepto, montoGs: pagoDe.montoGs, pagadoGs: pagoDe.pagadoGs, signo: esCobro ? 1 : -1 }}
          cuentas={cuentas} hoy={hoy} onCerrar={() => setPagoDe(null)} onListo={t => { setPagoDe(null); setMsg(t); router.refresh(); }} />
      )}

      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Fecha</th><th>{esCobro ? "Cliente" : "Proveedor"}</th><th>Concepto</th>
              <th style={{ textAlign: "right" }}>Monto</th><th style={{ textAlign: "right" }}>{esCobro ? "Cobrado" : "Pagado"}</th><th style={{ textAlign: "right" }}>Saldo</th>
              <th>Vence</th><th>Estado</th>{!esCobro && <th>Mes de pago</th>}<th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(f => (
              <tr key={f.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fecha(f.fecha)}</td>
                <td>{f.contraparte || "—"}</td>
                <td>
                  <div style={{ color: "var(--text-primary)" }}>{f.concepto}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.categoria}{f.factura ? ` · Fact. ${f.factura}` : ""}</div>
                </td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.montoGs)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-muted)" }}>{gs(f.pagadoGs)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{gs(f.saldoGs)}</td>
                <td style={{ whiteSpace: "nowrap" }}>{fecha(f.vencimiento)}<div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{f.tramo}</div></td>
                <td style={{ color: COLOR_ESTADO[f.estado] ?? "var(--text-secondary)", fontSize: 11.5, whiteSpace: "nowrap" }}>{f.estado}</td>
                {!esCobro && <td style={{ fontSize: 11.5 }}>{f.mesPago ? nombreMes(f.mesPago, true) : "—"}</td>}
                <td style={{ textAlign: "right" }}>
                  {puedeRegistrar && <button type="button" className="btn" style={{ height: 26, fontSize: 11 }} onClick={() => { setMsg(null); setPagoDe(f); }}>{esCobro ? "Cobrar" : "Pagar"}</button>}
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
                {filas.length === 0 ? (esCobro ? "No hay nada por cobrar." : "No hay nada por pagar.") : "No hay cuentas en ese tramo."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Esta lista sale del libro de movimientos: todo lo cargado como {esCobro ? "«por cobrar»" : "«pendiente»"} con saldo. Para agregar una cuenta, cargá el movimiento en el libro.
        {!esCobro && " Lo vencido se proyecta para el mes que viene."}
      </div>
    </>
  );
}
