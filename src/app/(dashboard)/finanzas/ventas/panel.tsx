"use client";
// Ventas (8.5): una venta genera su ingreso en el libro y da de baja los animales del lote.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconPlus, IconX } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { anularVenta, crearVenta } from "@/app/acciones/finanzas";
import { gs } from "@/lib/finanzas/calculos";
import { MEDIOS } from "../movimientos/libro";

type Venta = { id: string; fecha: string; tipo: string; cantidad: number; kg: number; importeGs: string; destino: string; cliente: string; edad: number | null; remito: string; estado: string };
type Lote = { id: string; batchCode: string; currentCount: number };
const TIPOS: Record<string, string> = { LECHONES: "Lechones", MATRIZ_DESCARTE: "Matriz de descarte", REPRODUCTOR: "Reproductor", DOSIS_SEMINALES: "Dosis seminales", CERDO_TERMINADO: "Cerdos terminados", OTRO: "Otro" };
const DESTINOS: Record<string, string> = { ENGORDE: "Engorde", CONSUMO: "Consumo", CARNEADO: "Carneado", REPRODUCCION: "Reproducción", FRIGORIFICO: "Frigorífico" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function PanelVentas(p: {
  ventas: Venta[]; lotesDestete: Lote[]; lotesEngorde: Lote[]; clientes: string[]; cuentas: { id: string; nombre: string }[];
  hoy: string; diferenciaControl: string; puedo: { crear: boolean; anular: boolean; cobrar: boolean };
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const confirmadas = p.ventas.filter(v => v.estado === "CONFIRMADA");
  const t = useMemo(() => {
    const cant = confirmadas.reduce((s, v) => s + v.cantidad, 0), kg = confirmadas.reduce((s, v) => s + v.kg, 0);
    const imp = confirmadas.reduce((s, v) => s + BigInt(v.importeGs), 0n);
    return { cant, kg, imp, peso: cant ? kg / cant : null, valor: cant ? Number(imp) / cant : null };
  }, [confirmadas]);
  const dif = BigInt(p.diferenciaControl);

  function anular(v: Venta) {
    const motivo = prompt(`Motivo para anular la venta de ${v.cantidad} (${gs(v.importeGs)}):`);
    if (!motivo) return;
    setMsg(null);
    iniciar(async () => {
      const r = await anularVenta(v.id, motivo);
      setMsg(r.ok ? { tipo: "ok", texto: "Venta anulada: el ingreso dejó de sumar y los animales volvieron al lote." } : { tipo: "error", texto: r.error });
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {([["Animales vendidos", t.cant.toLocaleString("es-PY")], ["Kg vendidos", `${t.kg.toLocaleString("es-PY", { maximumFractionDigits: 0 })} kg`],
          ["Peso promedio", t.peso === null ? "—" : `${t.peso.toLocaleString("es-PY", { maximumFractionDigits: 1 })} kg`], ["Importe", gs(t.imp)],
          ["Valor promedio por animal", t.valor === null ? "—" : gs(Math.round(t.valor))]] as const).map(([k, v]) => (
          <div key={k} style={{ ...tarjeta, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{k}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: dif === 0n ? "var(--success-text)" : "var(--danger-text)" }}>
          {dif === 0n ? "✓ Control: las ventas coinciden con los ingresos por ventas del libro." : `Control: diferencia de ${gs(dif)} entre ventas e ingresos por ventas del libro.`}
        </span>
        {p.puedo.crear && !abierto && <button type="button" className="btn btn-primary" onClick={() => { setMsg(null); setAbierto(true); }} style={{ height: 34 }}><IconPlus size={15} aria-hidden /> Registrar venta</button>}
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {abierto && <FormularioVenta {...p} onCerrar={() => setAbierto(false)} onListo={t => { setAbierto(false); setMsg({ tipo: "ok", texto: t }); router.refresh(); }} />}
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 880 }}>
          <thead><tr><th>Salida</th><th>Tipo</th><th>Cliente</th><th style={{ textAlign: "right" }}>Cantidad</th><th style={{ textAlign: "right" }}>Kg</th><th style={{ textAlign: "right" }}>Peso prom.</th><th style={{ textAlign: "right" }}>Importe</th><th>Destino</th><th></th></tr></thead>
          <tbody>
            {p.ventas.map(v => (
              <tr key={v.id} style={{ opacity: v.estado === "ANULADA" ? 0.5 : 1, textDecoration: v.estado === "ANULADA" ? "line-through" : undefined }}>
                <td style={{ whiteSpace: "nowrap" }}>{fecha(v.fecha)}</td>
                <td>{TIPOS[v.tipo] ?? v.tipo}{v.edad ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.edad} días</div> : null}</td>
                <td>{v.cliente}{v.remito ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Remito {v.remito}</div> : null}</td>
                <td style={{ textAlign: "right" }}>{v.cantidad}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v.kg.toLocaleString("es-PY")}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{(v.kg / v.cantidad).toLocaleString("es-PY", { maximumFractionDigits: 1 })}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{gs(v.importeGs)}</td>
                <td>{DESTINOS[v.destino] ?? v.destino}</td>
                <td style={{ textAlign: "right" }}>{p.puedo.anular && v.estado === "CONFIRMADA" && <button type="button" className="btn" style={{ height: 26, fontSize: 11 }} disabled={pendiente} onClick={() => anular(v)}>Anular</button>}</td>
              </tr>
            ))}
            {p.ventas.length === 0 && <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Sin ventas en este año.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Campo({ label, children, ancho }: { label: string; children: React.ReactNode; ancho?: number }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: ancho ?? 150, flex: 1 }}><span className="kp-label">{label}</span>{children}</label>;
}

function FormularioVenta(p: Parameters<typeof PanelVentas>[0] & { onCerrar: () => void; onListo: (t: string) => void }) {
  const [f, setF] = useState({
    fechaSalida: p.hoy, tipoVenta: "LECHONES", loteDesteteId: "", loteEngordeId: "", cantidad: "", kgTotales: "", modoPrecio: "POR_KG",
    precioGs: "", destino: "ENGORDE", cliente: "", recibePor: "", remitoFactura: "", guiaTraslado: "", fechaVencimientoCobro: "",
    cobrada: false, fechaCobro: p.hoy, cuentaFondosId: "", medioPago: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (k: keyof typeof f, v: string | boolean) => setF(x => ({ ...x, [k]: v }));
  const cant = Number(f.cantidad) || 0, kg = Number(f.kgTotales.replace(",", ".")) || 0, precio = Number(f.precioGs) || 0;
  const importe = f.modoPrecio === "POR_KG" ? Math.round(kg * precio) : cant * precio;
  const lotes = f.tipoVenta === "CERDO_TERMINADO" ? p.lotesEngorde : f.tipoVenta === "LECHONES" ? p.lotesDestete : [];

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await crearVenta({
        ...f, tipoVenta: f.tipoVenta as "LECHONES", modoPrecio: f.modoPrecio as "POR_KG", destino: f.destino as "ENGORDE", cantidad: cant,
        loteDesteteId: f.tipoVenta === "LECHONES" ? f.loteDesteteId : "", loteEngordeId: f.tipoVenta === "CERDO_TERMINADO" ? f.loteEngordeId : "",
        cuentaFondosId: f.cuentaFondosId || null, medioPago: (f.medioPago || null) as never,
      });
      if (r.ok) p.onListo(`Venta registrada por ${gs(r.importe)}. El ingreso ya está en el libro${f.cobrada ? " como cobrado" : " como por cobrar"}.`);
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={guardar} style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Registrar venta</div>
        <button type="button" onClick={p.onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Fecha de salida" ancho={140}><input type="date" className="kp-input" value={f.fechaSalida} onChange={e => set("fechaSalida", e.target.value)} required /></Campo>
        <Campo label="Qué se vende" ancho={170}><select className="kp-input" value={f.tipoVenta} onChange={e => set("tipoVenta", e.target.value)}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        {lotes.length > 0 && (
          <Campo label={f.tipoVenta === "LECHONES" ? "Lote de destete" : "Lote de engorde"} ancho={200}>
            <select className="kp-input" value={f.tipoVenta === "LECHONES" ? f.loteDesteteId : f.loteEngordeId} onChange={e => set(f.tipoVenta === "LECHONES" ? "loteDesteteId" : "loteEngordeId", e.target.value)}>
              <option value="">Sin lote</option>
              {lotes.map(l => <option key={l.id} value={l.id}>{l.batchCode} · {l.currentCount} animales</option>)}
            </select>
          </Campo>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Cantidad" ancho={100}><input className="kp-input" inputMode="numeric" value={f.cantidad} onChange={e => set("cantidad", e.target.value.replace(/\D/g, ""))} required /></Campo>
        <Campo label="Kg totales (balanza)" ancho={140}><input className="kp-input" inputMode="decimal" value={f.kgTotales} onChange={e => set("kgTotales", e.target.value)} required /></Campo>
        <Campo label="Precio" ancho={130}>
          <select className="kp-input" value={f.modoPrecio} onChange={e => set("modoPrecio", e.target.value)}><option value="POR_KG">Por kg</option><option value="POR_CABEZA">Por cabeza</option></select>
        </Campo>
        <Campo label={f.modoPrecio === "POR_KG" ? "₲ por kg" : "₲ por cabeza"} ancho={130}><input className="kp-input" inputMode="numeric" value={f.precioGs} onChange={e => set("precioGs", e.target.value.replace(/\D/g, ""))} required /></Campo>
      </div>
      {cant > 0 && kg > 0 && precio > 0 && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Peso promedio <strong>{(kg / cant).toLocaleString("es-PY", { maximumFractionDigits: 1 })} kg</strong> · importe <strong>{gs(importe)}</strong> · <strong>{gs(Math.round(importe / cant))}</strong> por animal
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Destino" ancho={140}><select className="kp-input" value={f.destino} onChange={e => set("destino", e.target.value)}>{Object.entries(DESTINOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Campo>
        <Campo label="Cliente" ancho={200}>
          <input className="kp-input" list="clientes-venta" value={f.cliente} onChange={e => set("cliente", e.target.value)} required maxLength={120} />
          <datalist id="clientes-venta">{p.clientes.map(c => <option key={c} value={c} />)}</datalist>
        </Campo>
        <Campo label="Entrega (puesto)" ancho={140}><input className="kp-input" value={f.recibePor} onChange={e => set("recibePor", e.target.value)} maxLength={80} placeholder="Ej: Comercial" /></Campo>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="N° de remito o factura" ancho={150}><input className="kp-input" value={f.remitoFactura} onChange={e => set("remitoFactura", e.target.value)} maxLength={40} /></Campo>
        <Campo label="Guía de traslado" ancho={150}><input className="kp-input" value={f.guiaTraslado} onChange={e => set("guiaTraslado", e.target.value)} maxLength={40} /></Campo>
        <Campo label="Cobro" ancho={150}>
          <select className="kp-input" value={f.cobrada ? "1" : "0"} onChange={e => set("cobrada", e.target.value === "1")} disabled={!p.puedo.cobrar}>
            <option value="0">Por cobrar</option><option value="1">Ya cobrada</option>
          </select>
        </Campo>
        {f.cobrada ? (
          <>
            <Campo label="Fecha de cobro" ancho={140}><input type="date" className="kp-input" value={f.fechaCobro} onChange={e => set("fechaCobro", e.target.value)} /></Campo>
            <Campo label="Caja / banco" ancho={160}><select className="kp-input" value={f.cuentaFondosId} onChange={e => set("cuentaFondosId", e.target.value)}><option value="">No aplica</option>{p.cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>
            <Campo label="Medio" ancho={150}><select className="kp-input" value={f.medioPago} onChange={e => set("medioPago", e.target.value)}><option value="">—</option>{MEDIOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Campo>
          </>
        ) : (
          <Campo label="Vence el cobro" ancho={140}><input type="date" className="kp-input" value={f.fechaVencimientoCobro} onChange={e => set("fechaVencimientoCobro", e.target.value)} /></Campo>
        )}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={p.onCerrar} disabled={pendiente}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={pendiente}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Registrar venta</button>
      </div>
    </form>
  );
}
