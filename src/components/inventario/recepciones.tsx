"use client";
// Recepciones: lo que Finanzas compró y espera entrar al stock. El encargado acepta (con lote y vencimiento)
// o rechaza. El Administrador General puede anular (queda el registro).
import { useCallback, useEffect, useState, useTransition } from "react";
import { IconCheck, IconLoader2, IconTruckDelivery, IconX } from "@tabler/icons-react";
import { aceptarRecepcion, anularRecepcion, rechazarRecepcion, recepciones } from "@/app/acciones/inventario";

type Datos = Awaited<ReturnType<typeof recepciones>>;
type Fila = Datos["filas"][number];
const UNIDAD: Record<string, string> = { DOSIS: "dosis", ML: "ml", KG: "kg", UNIDAD: "unidades", SACO: "sacos" };
const ESTADO: Record<string, { t: string; c: string }> = {
  PENDIENTE: { t: "Por recibir", c: "var(--warning-text)" }, ACEPTADA: { t: "Recibida", c: "var(--success-text)" },
  RECHAZADA: { t: "Rechazada", c: "var(--danger-text)" }, ANULADA: { t: "Anulada", c: "var(--text-muted)" },
};
const gs = (v: number | null) => (v == null ? "—" : `₲ ${Math.round(v).toLocaleString("es-PY")}`);
const fecha = (s: string) => new Date(s).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
const num = (v: number) => v.toLocaleString("es-PY", { maximumFractionDigits: 3 });

export function RecepcionesInventario({ puedeRecibir, onCambio }: { puedeRecibir: boolean; onCambio: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const cargar = useCallback(() => { recepciones().then(setDatos).catch(() => setDatos({ esAdmin: false, filas: [] })); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  if (!datos) return null;
  const pendientes = datos.filas.filter(f => f.estado === "PENDIENTE");
  const resueltas = datos.filas.filter(f => f.estado !== "PENDIENTE");
  const listo = () => { cargar(); onCambio(); };

  return (
    <section aria-labelledby="recepciones" style={{ background: "var(--bg-surface)", border: `0.5px solid ${pendientes.length ? "var(--warning-border)" : "var(--border-default)"}`, borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "0.5px solid var(--border-default)", flexWrap: "wrap" }}>
        <IconTruckDelivery size={16} aria-hidden style={{ color: "var(--text-secondary)" }} />
        <h2 id="recepciones" style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>
          Recepciones de compras {pendientes.length > 0 && <span style={{ color: "var(--warning-text)" }}>· {pendientes.length} por recibir</span>}
        </h2>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Las compras se cargan en Finanzas → Movimientos (marcando «Entra al inventario»)</span>
      </div>
      {pendientes.length === 0 && <div style={{ padding: "14px", fontSize: 12.5, color: "var(--text-muted)" }}>No hay compras esperando. Cuando Finanzas registre una, aparece acá para recibirla.</div>}
      {pendientes.map(f => <Pendiente key={f.id} f={f} puedeRecibir={puedeRecibir} esAdmin={datos.esAdmin} onListo={listo} />)}
      {resueltas.length > 0 && (
        <div style={{ borderTop: "0.5px solid var(--border-default)" }}>
          <button type="button" onClick={() => setVerTodas(v => !v)} style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}>
            {verTodas ? "▾" : "▸"} Historial de recepciones ({resueltas.length})
          </button>
          {verTodas && (
            <div style={{ overflowX: "auto" }}>
              <table className="kp-table" style={{ minWidth: 900 }}>
                <thead><tr><th>Compra</th><th>Producto</th><th style={{ textAlign: "right" }}>Cantidad</th><th style={{ textAlign: "right" }}>Precio</th><th>Proveedor</th><th>Compró</th><th>Estado</th><th>Recibió</th><th /></tr></thead>
                <tbody>
                  {resueltas.map(f => (
                    <tr key={f.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{fecha(f.fechaCompra)}{f.factura ? ` · fact. ${f.factura}` : ""}</td>
                      <td>{f.producto}{f.numeroLote ? <span style={{ color: "var(--text-muted)" }}> · lote {f.numeroLote}</span> : null}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(f.cantidadRecibida ?? f.cantidad)} {UNIDAD[f.unidad] ?? ""}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.costoUnitario)}/{UNIDAD[f.unidad] ?? "u."}</td>
                      <td>{f.proveedor ?? "—"}</td>
                      <td>{f.compradoPor}</td>
                      <td style={{ color: ESTADO[f.estado]?.c }} title={f.nota ?? undefined}>{ESTADO[f.estado]?.t ?? f.estado}</td>
                      <td>{f.resueltaPor ?? "—"}{f.resueltaEn ? <span style={{ color: "var(--text-muted)" }}> · {fecha(f.resueltaEn)}</span> : null}</td>
                      <td>{datos.esAdmin && f.estado === "ACEPTADA" && <Anular id={f.id} onListo={listo} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Pendiente({ f, puedeRecibir, esAdmin, onListo }: { f: Fila; puedeRecibir: boolean; esAdmin: boolean; onListo: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [cant, setCant] = useState(String(f.cantidad));
  const [lote, setLote] = useState(f.numeroLote ?? "");
  const [vence, setVence] = useState(f.fechaVencimiento ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const u = UNIDAD[f.unidad] ?? f.unidad;
  const correr = (fn: () => Promise<{ ok: boolean; error?: string }>) => { setError(null); iniciar(async () => { const r = await fn().catch(() => ({ ok: false, error: "No se pudo. Recargá la página." })); if (r.ok) onListo(); else setError(r.error ?? "No se pudo."); }); };
  return (
    <div style={{ padding: "11px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Llegaron {num(f.cantidad)} {u} de {f.producto}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
            Compra del {fecha(f.fechaCompra)}{f.proveedor ? ` · ${f.proveedor}` : ""}{f.factura ? ` · factura ${f.factura}` : ""} · {gs(f.costoUnitario)} por {u} · cargó {f.compradoPor}
          </div>
        </div>
        {puedeRecibir && !abierta && (
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn btn-primary" style={{ height: 30, fontSize: 12, gap: 4 }} onClick={() => setAbierta(true)}><IconCheck size={13} aria-hidden /> Recibir</button>
            <button type="button" className="btn" style={{ height: 30, fontSize: 12 }} disabled={pendiente}
              onClick={() => { const m = window.prompt("¿Por qué la rechazás?"); if (m) correr(() => rechazarRecepcion(f.id, m)); }}>Rechazar</button>
            {esAdmin && <Anular id={f.id} onListo={onListo} />}
          </div>
        )}
      </div>
      {abierta && (
        <form onSubmit={e => { e.preventDefault(); correr(() => aceptarRecepcion({ id: f.id, cantidadRecibida: Number(cant.replace(",", ".")), numeroLote: lote, fechaVencimiento: vence })); }}
          style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)" }}>
            Cantidad recibida ({u})
            <input className="kp-input" inputMode="decimal" value={cant} onChange={e => setCant(e.target.value)} style={{ height: 32, width: 140 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)" }}>
            N° de lote
            <input className="kp-input" value={lote} onChange={e => setLote(e.target.value)} placeholder="o «S/L»" style={{ height: 32, width: 150 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)" }}>
            Vencimiento{f.categoria === "VACUNA" || f.categoria === "MEDICAMENTO" ? " *" : " (si tiene)"}
            <input type="date" className="kp-input" value={vence} onChange={e => setVence(e.target.value)} style={{ height: 32, width: 160 }} />
          </label>
          <button type="submit" className="btn btn-primary" style={{ height: 32, fontSize: 12 }} disabled={pendiente}>
            {pendiente && <IconLoader2 size={13} className="animate-spin" aria-hidden />} Confirmar recepción
          </button>
          <button type="button" className="btn" style={{ height: 32, fontSize: 12 }} onClick={() => setAbierta(false)}><IconX size={13} aria-hidden /></button>
        </form>
      )}
      {error && <div role="alert" style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</div>}
    </div>
  );
}

function Anular({ id, onListo }: { id: string; onListo: () => void }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button type="button" className="btn" style={{ height: 28, fontSize: 11.5, color: "var(--danger-text)" }} disabled={pendiente} title="Solo el Administrador General · queda el registro"
      onClick={() => {
        const m = window.prompt("Motivo de la anulación (queda registrado):");
        if (!m) return;
        iniciar(async () => { const r = await anularRecepcion(id, m).catch(() => ({ ok: false as const, error: "No se pudo. Recargá la página." })); if (r.ok) onListo(); else window.alert(r.error); });
      }}>
      Anular
    </button>
  );
}
