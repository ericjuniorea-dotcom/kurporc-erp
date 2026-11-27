"use client";
// Inventario · Costos y conteo (costeo por etapa, Fase 4): valor del stock a costo promedio, consumo valorizado por
// etapa del mes, salida manual con etapa, valorizar lo que entró sin costo y conteo físico mensual.
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { IconAlertTriangle, IconClipboardCheck, IconLoader2, IconLogout2, IconX } from "@tabler/icons-react";
import { InputNumero } from "@/components/ui/input-numero";
import { Paginador, usePaginas } from "@/components/ui/paginador";
import { registrarConteo, registrarSalidaInventario, valorizarStock } from "@/app/acciones/costeo-inventario";

type Producto = { id: string; nombre: string; codigo: string | null; categoria: string; unidadMedida: string; etapa: string | null; sub: string | null;
  stock: number; costoPromedio: number | null; valorGs: number | null; sinCosto: boolean };
type Datos = { mes: number; productos: Producto[]; etapas: { codigo: string; nombre: string }[];
  conteos: { id: string; fecha: string; valorSistemaGs: number; diferenciaGs: number; productos: number; conDiferencia: number }[];
  consumoPorEtapa: { codigo: string; nombre: string; gs: number }[]; puedo: { salida: boolean; valorizar: boolean; conteo: boolean } };

const UNIDAD: Record<string, string> = { DOSIS: "dosis", ML: "ml", KG: "kg", UNIDAD: "un.", SACO: "sacos", LITRO: "l" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const etiqueta: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-secondary)", minWidth: 0, flex: "1 1 160px" };
const gs = (v: number | null | undefined) => (v == null ? "—" : `₲ ${Math.round(v).toLocaleString("es-PY")}`);
const num = (v: number, dec = 3) => v.toLocaleString("es-PY", { maximumFractionDigits: dec });
const nro = (s: string) => Number((s || "").replace(/\./g, "").replace(",", "."));
const hoy = () => new Date().toISOString().slice(0, 10);
const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function PanelCosteoInventario() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [modo, setModo] = useState<"" | "salida" | "conteo">("");
  const [valorizando, setValorizando] = useState<Producto | null>(null);
  const cargar = useCallback(() => {
    fetch("/api/inventario/costeo", { cache: "no-store" }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setDatos(j); })
      .catch((e: unknown) => setMsg({ ok: false, t: e instanceof Error ? e.message : "No se pudo cargar." }));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const conStock = useMemo(() => (datos?.productos ?? []).filter(p => p.stock > 0), [datos]);
  const pag = usePaginas(conStock, 8);
  const listo = (t: string) => { setMsg({ ok: true, t }); setModo(""); setValorizando(null); cargar(); };

  if (!datos) return <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>{msg ? <span style={{ color: "var(--danger-text)" }}>{msg.t}</span> : <><IconLoader2 size={15} className="animate-spin" /> Cargando…</>}</div>;
  const valorTotal = conStock.reduce((s, p) => s + (p.valorGs ?? 0), 0);
  const sinCosto = conStock.filter(p => p.sinCosto || p.costoPromedio == null);
  const consumoTotal = datos.consumoPorEtapa.reduce((s, e) => s + e.gs, 0);
  const mesTxt = `${NOMBRE_MES[(datos.mes % 100) - 1]} ${Math.floor(datos.mes / 100)}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {msg && <div role="status" style={{ fontSize: 13, padding: "8px 12px", borderRadius: "var(--radius-md)", background: msg.ok ? "var(--success-subtle)" : "var(--danger-subtle)", color: msg.ok ? "var(--success-text)" : "var(--danger-text)" }}>{msg.t}</div>}

      {/* Resumen */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <div style={{ ...tarjeta, padding: 14 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>Valor del stock</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{gs(valorTotal)}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>a costo promedio ponderado</div>
        </div>
        <div style={{ ...tarjeta, padding: 14 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>Consumido en {mesTxt}</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{gs(consumoTotal)}</div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>salidas valorizadas, por etapa abajo</div>
        </div>
      </div>

      {/* Acciones */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {datos.puedo.salida && <button type="button" className="btn btn-primary" onClick={() => { setModo("salida"); setMsg(null); }}><IconLogout2 size={14} aria-hidden /> Registrar salida</button>}
        {datos.puedo.conteo && <button type="button" className="btn" onClick={() => { setModo("conteo"); setMsg(null); }}><IconClipboardCheck size={14} aria-hidden /> Conteo físico</button>}
      </div>

      {modo === "salida" && <FormSalida datos={datos} onCerrar={() => setModo("")} onListo={listo} onError={t => setMsg({ ok: false, t })} />}
      {modo === "conteo" && <FormConteo datos={datos} productos={datos.productos} onCerrar={() => setModo("")} onListo={listo} onError={t => setMsg({ ok: false, t })} />}

      {sinCosto.length > 0 && (
        <div className="kp-alert kp-alert-warning" style={{ fontSize: 12.5, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <IconAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
          <span>{sinCosto.length.toLocaleString("es-PY")} {sinCosto.length === 1 ? "producto tiene" : "productos tienen"} stock sin costo (se cargaron sin precio). Sin costo, su consumo no suma a ninguna etapa: tocá <strong>Valorizar</strong> y escribí cuánto vale cada unidad.</span>
        </div>
      )}

      {/* Consumo por etapa */}
      <section style={{ ...tarjeta, overflow: "hidden" }} aria-label="Consumo por etapa">
        <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>Consumo del inventario por etapa · {mesTxt}</div>
        {datos.consumoPorEtapa.length === 0 ? <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>Todavía no hay salidas valorizadas este mes.</div> : (
          <div style={{ padding: "6px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {datos.consumoPorEtapa.sort((a, b) => b.gs - a.gs).map(e => (
              <div key={e.codigo} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                  <span style={{ color: "var(--text-primary)" }}>{e.nombre}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{gs(e.gs)} <span style={{ color: "var(--text-muted)" }}>· {consumoTotal ? Math.round((e.gs / consumoTotal) * 100) : 0} %</span></span>
                </div>
                <div style={{ height: 6, borderRadius: 6, background: "var(--bg-overlay)", overflow: "hidden" }}>
                  <div style={{ width: `${consumoTotal ? Math.max(2, (e.gs / consumoTotal) * 100) : 0}%`, height: "100%", background: "var(--accent)", borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: "8px 14px", borderTop: "0.5px solid var(--border-default)", fontSize: 11.5, color: "var(--text-muted)" }}>
          Cómo se calcula: cada salida del inventario (Nutrición, Vacunación, tratamientos, salidas manuales y faltantes de conteo) × costo promedio del producto, sumada a la etapa donde se usó. Las devoluciones por anulación restan.
        </div>
      </section>

      {/* Stock valorizado */}
      <section style={{ ...tarjeta, overflow: "hidden", display: "flex", flexDirection: "column" }} aria-label="Stock valorizado">
        <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>Stock valorizado</div>
        {conStock.length === 0 && <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>No hay stock.</div>}
        {pag.visibles.map(p => (
          <div key={p.id} style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px", minWidth: 0 }}>
              <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{p.nombre}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                {num(p.stock)} {UNIDAD[p.unidadMedida] ?? ""} · {p.costoPromedio != null ? `${gs(p.costoPromedio)} por ${UNIDAD[p.unidadMedida] ?? "unidad"}` : "sin costo"}{p.etapa ? ` · se usa en ${datos.etapas.find(e => e.codigo === p.etapa)?.nombre ?? p.etapa}` : ""}
              </div>
            </div>
            <div style={{ fontSize: 13, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{gs(p.valorGs)}</div>
            {datos.puedo.valorizar && (p.sinCosto || p.costoPromedio == null) && <button type="button" className="btn" onClick={() => setValorizando(p)}>Valorizar</button>}
            {valorizando?.id === p.id && <FormValorizar p={p} onCerrar={() => setValorizando(null)} onListo={listo} onError={t => setMsg({ ok: false, t })} />}
          </div>
        ))}
        <Paginador {...pag} />
      </section>

      {/* Conteos */}
      <section style={{ ...tarjeta, overflow: "hidden" }} aria-label="Conteos físicos">
        <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", fontSize: 12.5, fontWeight: 500, color: "var(--text-secondary)" }}>Conteos físicos</div>
        {datos.conteos.length === 0 ? <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>Todavía no hay conteos. Hacé uno por mes: lo que contás en el depósito contra lo que dice el sistema.</div> : datos.conteos.map(c => {
          const pct = c.valorSistemaGs ? (c.diferenciaGs / c.valorSistemaGs) * 100 : 0;
          return (
            <div key={c.id} style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, alignItems: "center" }}>
              <span style={{ flex: "1 1 140px" }}>{c.fecha.split("-").reverse().join("/")} · {c.productos.toLocaleString("es-PY")} productos{c.conDiferencia ? `, ${c.conDiferencia.toLocaleString("es-PY")} con diferencia` : ", sin diferencias"}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: c.diferenciaGs < 0 ? "var(--danger-text)" : "var(--text-primary)" }}>{gs(c.diferenciaGs)} · {pct.toLocaleString("es-PY", { maximumFractionDigits: 1 })} %</span>
            </div>
          );
        })}
        <div style={{ padding: "8px 14px", fontSize: 11.5, color: "var(--text-muted)" }}>Diferencia = (contado − sistema) × costo promedio. En % sobre el valor del stock según el sistema. Negativo = faltante.</div>
      </section>
    </div>
  );
}

function FormSalida({ datos, onCerrar, onListo, onError }: { datos: Datos; onCerrar: () => void; onListo: (t: string) => void; onError: (t: string) => void }) {
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [etapa, setEtapa] = useState("");
  const [loteAnimal, setLoteAnimal] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [pendiente, iniciar] = useTransition();
  const p = datos.productos.find(x => x.id === productoId);
  const pideLote = p && (p.sub?.startsWith("ALI") || p.sub?.startsWith("SAN"));
  const pideMotivo = p?.sub === "INS-02";
  function elegir(id: string) { setProductoId(id); const x = datos.productos.find(y => y.id === id); setEtapa(x?.etapa ?? ""); }
  function guardar() {
    iniciar(async () => {
      const r = await registrarSalidaInventario({ productoId, cantidad: nro(cantidad), etapaCodigo: etapa, loteAnimal, motivo, fecha });
      if (!r.ok) { onError(r.error); return; }
      onListo(r.aviso ? `Salida registrada. ${r.aviso}` : "Salida registrada.");
    });
  }
  return (
    <section style={{ ...tarjeta, padding: 14, display: "flex", flexDirection: "column", gap: 10 }} aria-label="Registrar salida">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>Registrar salida</div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={etiqueta}>Producto
          <select className="kp-input" value={productoId} onChange={e => elegir(e.target.value)}>
            <option value="">Elegí…</option>
            {datos.productos.filter(x => x.stock > 0).map(x => <option key={x.id} value={x.id}>{x.nombre} ({num(x.stock)} {UNIDAD[x.unidadMedida] ?? ""})</option>)}
          </select>
        </label>
        <label style={{ ...etiqueta, flex: "0 1 130px" }}>Cantidad{p ? ` (${UNIDAD[p.unidadMedida] ?? ""})` : ""}<InputNumero className="kp-input" inputMode="decimal" value={cantidad} onChange={e => setCantidad(e.target.value)} /></label>
        <label style={{ ...etiqueta, flex: "0 1 150px" }}>Fecha<input type="date" className="kp-input" value={fecha} max={hoy()} onChange={e => setFecha(e.target.value)} /></label>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={etiqueta}>Etapa donde se usa *
          <select className="kp-input" value={etapa} onChange={e => setEtapa(e.target.value)}>
            <option value="">Elegí…</option>
            {datos.etapas.map(e => <option key={e.codigo} value={e.codigo}>{e.codigo === "CMP" ? "Compartido (se reparte al cerrar)" : e.nombre}</option>)}
          </select>
        </label>
        {pideLote && <label style={etiqueta}>Lote de animales (opcional)<input className="kp-input" value={loteAnimal} onChange={e => setLoteAnimal(e.target.value)} placeholder="Ej.: lote de destete L-0007" maxLength={80} /></label>}
        <label style={etiqueta}>Motivo{pideMotivo ? " *" : " (opcional)"}<input className="kp-input" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={pideMotivo ? "Ej.: arreglo del comedero del galpón 2" : ""} maxLength={300} /></label>
      </div>
      {p && nro(cantidad) > 0 && p.costoPromedio != null && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Valor de la salida: {gs(nro(cantidad) * p.costoPromedio)}</div>}
      <button type="button" className="btn btn-primary" disabled={pendiente || !productoId || !(nro(cantidad) > 0) || !etapa || (pideMotivo && motivo.trim().length < 3)} onClick={guardar} style={{ alignSelf: "flex-start" }}>
        {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Registrar salida
      </button>
    </section>
  );
}

function FormValorizar({ p, onCerrar, onListo, onError }: { p: Producto; onCerrar: () => void; onListo: (t: string) => void; onError: (t: string) => void }) {
  const [costo, setCosto] = useState("");
  const [pendiente, iniciar] = useTransition();
  return (
    <div style={{ flexBasis: "100%", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", padding: 10, borderRadius: "var(--radius-md)", background: "var(--bg-base)" }}>
      <label style={etiqueta}>Costo por {UNIDAD[p.unidadMedida] ?? "unidad"} (₲)<InputNumero className="kp-input" inputMode="decimal" value={costo} onChange={e => setCosto(e.target.value)} placeholder="Ej.: 2500" /></label>
      <button type="button" className="btn btn-primary" disabled={pendiente || !(nro(costo) > 0)} onClick={() => iniciar(async () => {
        const r = await valorizarStock({ productoId: p.id, costoUnitario: nro(costo) });
        if (!r.ok) onError(r.error); else onListo(`${p.nombre} valorizado.`);
      })}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar</button>
      <button type="button" className="btn" onClick={onCerrar}>Cancelar</button>
      <span style={{ flexBasis: "100%", fontSize: 11.5, color: "var(--text-muted)" }}>Se aplica solo a los lotes sin precio; lo comprado conserva su costo. El promedio se recalcula solo.</span>
    </div>
  );
}

function FormConteo({ datos, productos, onCerrar, onListo, onError }: { datos: Datos; productos: Producto[]; onCerrar: () => void; onListo: (t: string) => void; onError: (t: string) => void }) {
  const lista = productos.filter(p => p.stock > 0);
  const [fecha, setFecha] = useState(hoy());
  const [contado, setContado] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState<Record<string, string>>({});
  const [pendiente, iniciar] = useTransition();
  const pag = usePaginas(lista, 8);
  const cargados = lista.filter(p => (contado[p.id] ?? "") !== "");
  const dif = (p: Producto) => Math.round((nro(contado[p.id] ?? "") - p.stock) * 1000) / 1000;
  const faltaMotivo = cargados.some(p => dif(p) !== 0 && (motivo[p.id] ?? "").trim().length < 3);
  const difTotal = cargados.reduce((s, p) => s + dif(p) * (p.costoPromedio ?? 0), 0);
  function guardar() {
    iniciar(async () => {
      const r = await registrarConteo({ fecha, items: cargados.map(p => ({ productoId: p.id, contado: nro(contado[p.id]), motivo: motivo[p.id] ?? "" })) });
      if (!r.ok) { onError(r.error); return; }
      onListo(`Conteo guardado: ${r.ajustes.toLocaleString("es-PY")} ${r.ajustes === 1 ? "ajuste" : "ajustes"}, diferencia ${gs(Number(r.diferenciaGs))}.`);
    });
  }
  return (
    <section style={{ ...tarjeta, display: "flex", flexDirection: "column", overflow: "hidden" }} aria-label="Conteo físico">
      <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "0.5px solid var(--border-default)" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Conteo físico</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Escribí lo que hay en el depósito. Si no coincide, poné el motivo. Los que dejes vacíos no se cuentan.</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" className="kp-input" value={fecha} max={hoy()} onChange={e => setFecha(e.target.value)} aria-label="Fecha del conteo" style={{ width: 150 }} />
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
        </div>
      </div>
      {pag.visibles.map(p => {
        const d = (contado[p.id] ?? "") === "" ? null : dif(p);
        return (
          <div key={p.id} style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: "1 1 170px", minWidth: 0 }}>
              <div style={{ fontSize: 13 }}>{p.nombre}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Sistema: {num(p.stock)} {UNIDAD[p.unidadMedida] ?? ""}</div>
            </div>
            <InputNumero className="kp-input" inputMode="decimal" aria-label={`Contado de ${p.nombre}`} placeholder="Contado" value={contado[p.id] ?? ""} style={{ width: 120 }}
              onChange={e => setContado(c => ({ ...c, [p.id]: e.target.value }))} />
            {d !== null && <span style={{ fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 70, color: d === 0 ? "var(--success-text)" : "var(--danger-text)" }}>{d === 0 ? "✓ coincide" : `${d > 0 ? "+" : ""}${num(d)}`}</span>}
            {d !== null && d !== 0 && (
              <input className="kp-input" aria-label={`Motivo de ${p.nombre}`} placeholder="Motivo *" value={motivo[p.id] ?? ""} maxLength={300} style={{ flex: "1 1 100%" }}
                onChange={e => setMotivo(m => ({ ...m, [p.id]: e.target.value }))} />
            )}
          </div>
        );
      })}
      <Paginador {...pag} />
      <div style={{ padding: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{cargados.length.toLocaleString("es-PY")} contados · diferencia {gs(difTotal)}</span>
        <button type="button" className="btn btn-primary" disabled={pendiente || cargados.length === 0 || faltaMotivo} onClick={guardar}>
          {pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar conteo
        </button>
      </div>
      {datos.puedo.conteo && faltaMotivo && <div style={{ padding: "0 14px 12px", fontSize: 12, color: "var(--danger-text)" }}>Falta el motivo en los productos con diferencia.</div>}
    </section>
  );
}
