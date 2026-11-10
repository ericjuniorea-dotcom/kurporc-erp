"use client";
// Tabla de "Lo que te va a faltar" (Fase 14.5).
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconRefresh, IconSettings } from "@tabler/icons-react";
import { crearSolicitudCotizacion } from "@/app/acciones/compras";
import { guardarParametroCompra, mejorPublicacion, recalcularNecesidades } from "@/app/acciones/necesidades";
import { DEPARTAMENTOS } from "@/lib/validaciones/paraguay";

export type Fila = {
  stockItemId: string; nombre: string; categoria: string; unidad: string; productoCatalogoId: string | null; catalogoNombre: string | null;
  metodo: string; metodoConfig: string; stockActual: number; enTransito: number; consumoDiario: number; coberturaDias: number | null;
  fechaQuiebre: string | null; cantidadSugerida: number; urgencia: "CRITICA" | "PRONTO" | "OK" | "SIN_DATOS"; explicacion: string; proyeccion: number[];
  param: { leadTimeDias: number; seguridadDias: number; cicloCompraDias: number; unidadCompra: number; mermaPct: number }; puntoPedido: number; etapas: string[];
};
type Producto = { id: string; nombre: string; unidad: string };

// Colores pastel (14.3): crítica rojo · pronto amarillo · ok verde · sin datos gris — con texto, no solo color
const URG: Record<Fila["urgencia"], { t: string; bg: string; fg: string }> = {
  CRITICA: { t: "Crítica", bg: "var(--danger-subtle)", fg: "var(--danger-text)" },
  PRONTO: { t: "Pronto", bg: "var(--warning-subtle)", fg: "var(--warning-text)" },
  OK: { t: "Bien", bg: "var(--success-subtle)", fg: "var(--success-text)" },
  SIN_DATOS: { t: "Sin datos", bg: "var(--bg-subtle)", fg: "var(--text-muted)" },
};
const CATEGORIA: Record<string, string> = { BALANCEADO: "Alimentación", VACUNA: "Vacunas", MEDICAMENTO: "Medicamentos", SUPLEMENTO: "Suplementos", EQUIPAMIENTO: "Equipos e insumos" };
const METODO: Record<string, string> = { RACION: "Por ración", PROGRAMADO: "Calendario sanitario", HISTORICO: "Histórico", SIN_DATOS: "Sin datos", NO_PREDECIR: "No predecir" };
const ETAPAS: [string, string][] = [["GESTATION", "Gestación"], ["LACTATION", "Lactancia"], ["PRE_STARTER", "Pre-inicial (lechones al pie)"], ["PHASE_1", "Recría fase 1"], ["PHASE_2", "Recría fase 2"], ["GROWING", "Engorde"]];
const n = (v: number, d = 1) => v.toLocaleString("es-PY", { maximumFractionDigits: d });
const fecha = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : "—");

/** Stock proyectado contra punto de pedido, 30 días. */
function Mini({ f }: { f: Fila }) {
  const ys = [f.stockActual + f.enTransito, ...f.proyeccion.slice(0, 30)];
  if (ys.length < 2 || f.urgencia === "SIN_DATOS") return <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>;
  const max = Math.max(...ys, f.puntoPedido, 1), min = Math.min(0, ...ys);
  const W = 96, H = 26, x = (i: number) => (i / (ys.length - 1)) * W, y = (v: number) => H - ((v - min) / (max - min || 1)) * H;
  const color = URG[f.urgencia].fg;
  return (
    <svg width={W} height={H} role="img" aria-label={`Stock proyectado a 30 días; punto de pedido ${n(f.puntoPedido)} ${f.unidad}`}>
      <line x1={0} x2={W} y1={y(f.puntoPedido)} y2={y(f.puntoPedido)} stroke="var(--text-muted)" strokeDasharray="3 3" strokeWidth={1} />
      {min < 0 && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--border-default)" strokeWidth={1} />}
      <polyline points={ys.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function TablaNecesidades({ filas, productos, departamento, puedeConfigurar, puedeCotizar, puedePedir }: {
  filas: Fila[]; productos: Producto[]; departamento: string; puedeConfigurar: boolean; puedeCotizar: boolean; puedePedir: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set(filas.filter(f => (f.urgencia === "CRITICA" || f.urgencia === "PRONTO") && f.productoCatalogoId && f.cantidadSugerida > 0).map(f => f.stockItemId)));
  const [cant, setCant] = useState<Record<string, string>>(Object.fromEntries(filas.map(f => [f.stockItemId, f.cantidadSugerida ? String(Math.ceil(f.cantidadSugerida)) : ""])));
  const [abierto, setAbierto] = useState<string | null>(null);
  const [config, setConfig] = useState<string | null>(null);
  const [depto, setDepto] = useState(departamento);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pendiente, iniciar] = useTransition();
  const elegidas = filas.filter(f => sel.has(f.stockItemId));
  const grupos = Array.from(new Set(filas.map(f => f.categoria)));

  const cotizar = () => iniciar(async () => {
    setMsg(null);
    const items = elegidas.filter(f => f.productoCatalogoId && Number(cant[f.stockItemId]) > 0).map(f => ({ productoCatalogoId: f.productoCatalogoId!, cantidadBase: Number(cant[f.stockItemId]) }));
    if (!items.length) { setMsg({ ok: false, t: "Elegí productos vinculados al catálogo y con cantidad." }); return; }
    const r = await crearSolicitudCotizacion({ items, departamento: depto as (typeof DEPARTAMENTOS)[number], origen: "MOTOR_NECESIDADES", nota: "Pedido armado desde «Lo que te va a faltar»." });
    if (r.ok) router.push(`/compras/cotizaciones/${r.id}`);
    else setMsg({ ok: false, t: r.terminos ? `${r.error} Hacelo desde «Pedir cotización» la primera vez.` : r.error });
  });
  const comprarYa = () => iniciar(async () => {
    setMsg(null);
    const f = elegidas[0];
    if (!f?.productoCatalogoId) { setMsg({ ok: false, t: "Elegí un producto vinculado al catálogo." }); return; }
    const r = await mejorPublicacion(f.productoCatalogoId, depto, Number(cant[f.stockItemId]) || 0);
    if (!r.ok) { setMsg({ ok: false, t: r.error }); return; }
    if (!r.slug) { setMsg({ ok: false, t: `Ninguna tienda verificada publica ${f.catalogoNombre ?? f.nombre} con entrega en ${depto}. Pedí cotización.` }); return; }
    router.push(`/compras/pedidos/nuevo?publicacion=${r.slug}&cantidad=${(r as { cantidad: number }).cantidad}`);
  });

  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", position: "sticky", top: 0, zIndex: 2, background: "var(--bg-base)", padding: "6px 0" }}>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{elegidas.length} seleccionado{elegidas.length === 1 ? "" : "s"} · entrega en</span>
        <select className="kp-input" value={depto} onChange={e => setDepto(e.target.value)} aria-label="Departamento de entrega" style={{ height: 32 }}>
          <option value="">Elegí…</option>{DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {puedeCotizar && <button className="btn btn-primary" style={{ height: 32 }} disabled={pendiente || !elegidas.length || !depto} onClick={cotizar}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Pedir cotización</button>}
        {puedePedir && <button className="btn" style={{ height: 32 }} disabled={pendiente || elegidas.length !== 1 || !depto} onClick={comprarYa} title="Elegí un solo producto">Comprar ya</button>}
        <button className="btn" style={{ height: 32, marginLeft: "auto" }} disabled={pendiente} onClick={() => iniciar(async () => { await recalcularNecesidades(); router.refresh(); })}><IconRefresh size={14} aria-hidden /> Recalcular</button>
      </div>
      {msg && <div role="alert" style={{ fontSize: 13, color: msg.ok ? "var(--success-text)" : "var(--danger-text)" }}>{msg.t}</div>}

      {grupos.map(g => (
        <div key={g} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflowX: "auto" }}>
          <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 600 }}>{CATEGORIA[g] ?? g}</div>
          <table className="kp-table" style={{ minWidth: 1080 }}>
            <thead><tr>
              <th style={{ width: 28 }}></th><th>Producto</th><th style={{ textAlign: "right" }}>Stock</th><th style={{ textAlign: "right" }}>En camino</th>
              <th style={{ textAlign: "right" }}>Consumo/día</th><th style={{ textAlign: "right" }}>Alcanza</th><th>Se termina</th><th>Próximos 30 días</th>
              <th style={{ textAlign: "right" }}>Pedir</th><th>Urgencia</th><th></th>
            </tr></thead>
            <tbody>
              {filas.filter(f => f.categoria === g).map(f => {
                const u = URG[f.urgencia];
                const vinculado = !!f.productoCatalogoId;
                return (
                  <Fragment key={f.stockItemId}>
                    <tr>
                      <td><input type="checkbox" aria-label={`Elegir ${f.nombre}`} checked={sel.has(f.stockItemId)} disabled={!vinculado}
                        title={vinculado ? undefined : "Vinculalo a un producto del catálogo (⚙) para pedir cotización"}
                        onChange={e => { const s = new Set(sel); if (e.target.checked) s.add(f.stockItemId); else s.delete(f.stockItemId); setSel(s); }} /></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{f.nombre}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{METODO[f.metodo] ?? f.metodo}{f.catalogoNombre ? ` · ${f.catalogoNombre}` : " · sin vincular al catálogo"}</div>
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n(f.stockActual)} {f.unidad}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.enTransito ? n(f.enTransito) : "—"}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.urgencia === "SIN_DATOS" ? "—" : n(f.consumoDiario)}</td>
                      <td style={{ textAlign: "right" }}>{f.urgencia === "SIN_DATOS" ? "—" : f.coberturaDias === null ? "+60 días" : `${f.coberturaDias} día${f.coberturaDias === 1 ? "" : "s"}`}</td>
                      <td>{fecha(f.fechaQuiebre)}</td>
                      <td><Mini f={f} /></td>
                      <td style={{ textAlign: "right" }}><span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                        <input className="kp-input" inputMode="decimal" value={cant[f.stockItemId] ?? ""} onChange={e => setCant({ ...cant, [f.stockItemId]: e.target.value.replace(/[^\d.,]/g, "").replace(",", ".") })} aria-label={`Cantidad a pedir de ${f.nombre}`} style={{ width: 80, textAlign: "right" }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.unidad}</span></span></td>
                      <td><span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: u.bg, color: u.fg }}>{u.t}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn" style={{ height: 26, fontSize: 11.5 }} aria-expanded={abierto === f.stockItemId} onClick={() => setAbierto(abierto === f.stockItemId ? null : f.stockItemId)}>¿Por qué?</button>
                        {puedeConfigurar && <button className="btn" style={{ height: 26, marginLeft: 4 }} aria-label={`Configurar ${f.nombre}`} onClick={() => setConfig(config === f.stockItemId ? null : f.stockItemId)}><IconSettings size={13} /></button>}
                      </td>
                    </tr>
                    {abierto === f.stockItemId && <tr><td></td><td colSpan={10} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55, background: "var(--bg-subtle)" }}>{f.explicacion}</td></tr>}
                    {config === f.stockItemId && <tr><td></td><td colSpan={10} style={{ background: "var(--bg-subtle)" }}><Configurar f={f} productos={productos} alGuardar={() => { setConfig(null); router.refresh(); }} /></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

function Configurar({ f, productos, alGuardar }: { f: Fila; productos: Producto[]; alGuardar: () => void }) {
  const [d, setD] = useState({
    metodo: f.metodoConfig, leadTimeDias: String(f.param.leadTimeDias), seguridadDias: String(f.param.seguridadDias), cicloCompraDias: String(f.param.cicloCompraDias),
    unidadCompra: String(f.param.unidadCompra), mermaPct: String(Math.round(f.param.mermaPct * 1000) / 10), productoCatalogoId: f.productoCatalogoId ?? "", etapas: f.etapas,
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const lab: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 };
  const num = (k: "leadTimeDias" | "seguridadDias" | "cicloCompraDias" | "unidadCompra" | "mermaPct", l: string) => (
    <label style={lab}>{l}<input className="kp-input" inputMode="decimal" value={d[k]} onChange={e => setD({ ...d, [k]: e.target.value })} style={{ width: 110 }} /></label>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "6px 0" }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={lab}>Cómo calcular
          <select className="kp-input" value={d.metodo} onChange={e => setD({ ...d, metodo: e.target.value })}>
            <option value="AUTO">Automático</option><option value="RACION">Por ración</option><option value="PROGRAMADO">Calendario sanitario</option><option value="HISTORICO">Histórico</option><option value="NO_PREDECIR">No predecir</option>
          </select>
        </label>
        {num("leadTimeDias", "Días que tarda el proveedor")}{num("seguridadDias", "Días de seguridad")}{num("cicloCompraDias", "Cada cuántos días comprás")}
        {num("unidadCompra", `Se compra de a (${f.unidad})`)}{num("mermaPct", "Merma (%)")}
      </div>
      <label style={lab}>Producto del catálogo del Mercado (para cotizar)
        <select className="kp-input" value={d.productoCatalogoId} onChange={e => setD({ ...d, productoCatalogoId: e.target.value })} style={{ maxWidth: 420 }}>
          <option value="">Sin vincular</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.unidad})</option>)}
        </select>
      </label>
      {f.categoria === "BALANCEADO" && (
        <div style={lab}>Con este balanceado se alimenta (de acá sale la ración)
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{ETAPAS.map(([k, l]) => (
            <label key={k} style={{ fontSize: 12.5, color: "var(--text-secondary)", display: "flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={d.etapas.includes(k)} onChange={e => setD({ ...d, etapas: e.target.checked ? [...d.etapas, k] : d.etapas.filter(x => x !== k) })} /> {l}
            </label>
          ))}</div>
        </div>
      )}
      {error && <div style={{ fontSize: 12.5, color: "var(--danger-text)" }}>{error}</div>}
      <button className="btn btn-primary" style={{ height: 30, alignSelf: "flex-start" }} disabled={pendiente}
        onClick={() => iniciar(async () => {
          const r = await guardarParametroCompra({ stockItemId: f.stockItemId, metodo: d.metodo as "AUTO", leadTimeDias: Number(d.leadTimeDias), seguridadDias: Number(d.seguridadDias), cicloCompraDias: Number(d.cicloCompraDias),
            unidadCompra: Number(d.unidadCompra.replace(",", ".")), mermaPct: Number(d.mermaPct.replace(",", ".")), productoCatalogoId: d.productoCatalogoId || null, etapas: d.etapas as "GESTATION"[] });
          if (r.ok) alGuardar(); else setError(r.error);
        })}>{pendiente && <IconLoader2 size={13} className="animate-spin" aria-hidden />} Guardar y recalcular</button>
    </div>
  );
}
