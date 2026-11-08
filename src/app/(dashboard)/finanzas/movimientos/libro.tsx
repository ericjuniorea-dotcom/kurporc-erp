"use client";
// Libro de movimientos (8.3): el único lugar de carga manual de Finanzas.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconLock, IconPlus, IconX } from "@tabler/icons-react";
import { Aviso } from "@/components/auth/marco-auth";
import { anularMovimiento, crearMovimiento, registrarPago } from "@/app/acciones/finanzas";
import { gs, nombreMes } from "@/lib/finanzas/calculos";

type Mov = {
  id: string; fecha: string; vencimiento: string | null; tipo: string; concepto: string; categoria: string; subcategoria: string;
  cantidad: string | null; unidadMedida: string; contraparte: string; montoGs: string; pagadoGs: string; estado: string; observacion: string;
  naturaleza: string; area: string; signo: number; precioUnitario: string | null; unidad: string; origen: string; motivoAnulacion: string;
  factura: string; ultimoPago: string | null;
};
type Categoria = { id: string; nombre: string; tipo: string; subcategorias: string[]; unidadDefault: string; signo: number };
type Cuenta = { id: string; nombre: string; tipo: string };
type Props = {
  mes: number; meses: number[]; hoy: string;
  puedo: { crear: boolean; anular: boolean; pagar: boolean; cobrar: boolean };
  movimientos: Mov[]; categorias: Categoria[]; cuentas: Cuenta[];
  unidades: { id: string; codigo: string; nombre: string; tipo: string }[];
  productos: { id: string; nombre: string; categoria: string }[];
  contrapartes: { nombre: string; tipo: string }[];
};

export const TIPOS = [
  { id: "GASTO", label: "Gasto" }, { id: "INGRESO", label: "Ingreso" },
  { id: "INVERSION", label: "Inversión" }, { id: "FINANCIAMIENTO", label: "Financiamiento" },
] as const;
export const MEDIOS = [
  { id: "EFECTIVO", label: "Efectivo" }, { id: "TRANSFERENCIA", label: "Transferencia" }, { id: "CHEQUE", label: "Cheque" },
  { id: "DEBITO_AUTOMATICO", label: "Débito automático" }, { id: "TARJETA", label: "Tarjeta" }, { id: "CREDITO_PROVEEDOR", label: "Crédito de proveedor" },
] as const;
const ESTADO: Record<string, { label: string; color: string; fondo: string }> = {
  PAGADO: { label: "Pagado", color: "var(--success-text)", fondo: "var(--success-subtle)" },
  COBRADO: { label: "Cobrado", color: "var(--success-text)", fondo: "var(--success-subtle)" },
  PENDIENTE: { label: "Pendiente", color: "var(--warning-text)", fondo: "var(--warning-subtle)" },
  POR_COBRAR: { label: "Por cobrar", color: "var(--warning-text)", fondo: "var(--warning-subtle)" },
  ANULADO: { label: "Anulado", color: "var(--text-muted)", fondo: "var(--bg-overlay)" },
};
const NATURALEZA: Record<string, string> = { FIJO: "Fijo", VARIABLE: "Variable", NO_APLICA: "–" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function LibroMovimientos(p: Props) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [texto, setTexto] = useState("");
  const [pagoDe, setPagoDe] = useState<Mov | null>(null);
  const [anularDe, setAnularDe] = useState<Mov | null>(null);
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const q = texto.trim().toLowerCase();
  const visibles = p.movimientos.filter(m => (!tipo || m.tipo === tipo) && (!estado || m.estado === estado)
    && (!q || `${m.concepto} ${m.categoria} ${m.subcategoria} ${m.contraparte} ${m.observacion} ${m.factura}`.toLowerCase().includes(q)));

  const totales = useMemo(() => {
    let ingresos = 0n, gastos = 0n, inversion = 0n, financiamiento = 0n, pendiente = 0n;
    for (const m of p.movimientos) {
      if (m.estado === "ANULADO") continue;
      const v = BigInt(m.montoGs);
      if (m.tipo === "INGRESO") ingresos += v;
      else if (m.tipo === "GASTO") gastos += v;
      else if (m.tipo === "INVERSION") inversion += v;
      else financiamiento += m.signo > 0 ? v : -v;
      if (m.estado === "PENDIENTE") pendiente += v - BigInt(m.pagadoGs);
    }
    return { ingresos, gastos, inversion, financiamiento, pendiente, resultado: ingresos - gastos };
  }, [p.movimientos]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select className="kp-input" aria-label="Mes" value={p.mes} onChange={e => router.push(`/finanzas/movimientos?mes=${e.target.value}`)} style={{ width: 170 }}>
            {p.meses.map(m => <option key={m} value={m}>{nombreMes(m)}</option>)}
          </select>
          <select className="kp-input" aria-label="Tipo" value={tipo} onChange={e => setTipo(e.target.value)} style={{ width: 150 }}>
            <option value="">Todos los tipos</option>
            {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select className="kp-input" aria-label="Estado" value={estado} onChange={e => setEstado(e.target.value)} style={{ width: 150 }}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <input className="kp-input" placeholder="Buscar concepto, proveedor, factura…" value={texto} onChange={e => setTexto(e.target.value)} style={{ width: 240 }} aria-label="Buscar" />
        </div>
        {p.puedo.crear && !cargando && (
          <button type="button" className="btn btn-primary" onClick={() => { setMsg(null); setCargando(true); }} style={{ height: 34 }}>
            <IconPlus size={15} aria-hidden /> Cargar movimiento
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {[
          ["Ingresos", totales.ingresos, "var(--success-text)"], ["Gastos", totales.gastos, "var(--text-primary)"],
          ["Resultado del mes", totales.resultado, totales.resultado < 0n ? "var(--danger-text)" : "var(--success-text)"],
          ["Inversiones", totales.inversion, "var(--text-primary)"], ["Financiamiento neto", totales.financiamiento, "var(--text-primary)"],
          ["Pendiente de pago", totales.pendiente, "var(--warning-text)"],
        ].map(([t, v, c]) => (
          <div key={t as string} style={{ ...tarjeta, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t as string}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: c as string, fontVariantNumeric: "tabular-nums" }}>{gs(v as bigint)}</div>
          </div>
        ))}
      </div>

      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      {cargando && <FormularioMovimiento {...p} onCerrar={() => setCargando(false)} onListo={(t) => { setCargando(false); setMsg({ tipo: "ok", texto: t }); router.refresh(); }} />}
      {pagoDe && <FormularioPago mov={pagoDe} cuentas={p.cuentas} hoy={p.hoy} onCerrar={() => setPagoDe(null)} onListo={(t) => { setPagoDe(null); setMsg({ tipo: "ok", texto: t }); router.refresh(); }} />}
      {anularDe && <FormularioAnular mov={anularDe} onCerrar={() => setAnularDe(null)} onListo={(t) => { setAnularDe(null); setMsg({ tipo: "ok", texto: t }); router.refresh(); }} />}

      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Fecha</th><th>Concepto</th><th>Proveedor / cliente</th><th>Unidad</th><th>Naturaleza</th>
              <th style={{ textAlign: "right" }}>Monto</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map(m => {
              const saldo = BigInt(m.montoGs) - BigInt(m.pagadoGs);
              const anulado = m.estado === "ANULADO";
              const puedePagar = !anulado && saldo > 0n && (m.signo > 0 ? p.puedo.cobrar : p.puedo.pagar);
              return (
                <tr key={m.id} style={{ opacity: anulado ? 0.55 : 1 }}>
                  <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fechaCorta(m.fecha)}</td>
                  <td style={{ textDecoration: anulado ? "line-through" : undefined }}>
                    <div style={{ color: "var(--text-primary)", display: "flex", gap: 4, alignItems: "center" }}>
                      {m.origen !== "MANUAL" && m.origen !== "IMPORTACION" && <IconLock size={11} aria-label="Generado automáticamente" />}
                      {m.concepto}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {m.categoria}{m.subcategoria ? ` · ${m.subcategoria}` : ""}
                      {m.cantidad ? ` · ${Number(m.cantidad).toLocaleString("es-PY")} ${m.unidadMedida}` : ""}
                      {m.precioUnitario ? ` · ${gs(m.precioUnitario)}/u` : ""}
                      {anulado && m.motivoAnulacion ? ` · Anulado: ${m.motivoAnulacion}` : ""}
                    </div>
                  </td>
                  <td>{m.contraparte || "—"}</td>
                  <td style={{ fontSize: 11 }}>{m.unidad}</td>
                  <td style={{ fontSize: 11 }}>{NATURALEZA[m.naturaleza]}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: m.signo > 0 ? "var(--success-text)" : "var(--text-primary)", fontWeight: 500 }}>
                    {m.signo > 0 ? "+" : "−"}{gs(m.montoGs).replace("₲ ", "₲ ")}
                    {!anulado && saldo > 0n && BigInt(m.pagadoGs) > 0n && <div style={{ fontSize: 10.5, color: "var(--warning-text)", fontWeight: 400 }}>saldo {gs(saldo)}</div>}
                  </td>
                  <td>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: ESTADO[m.estado]?.fondo, color: ESTADO[m.estado]?.color, whiteSpace: "nowrap" }}>{ESTADO[m.estado]?.label ?? m.estado}</span>
                    {!anulado && m.vencimiento && saldo > 0n && <div style={{ fontSize: 10.5, color: m.vencimiento < p.hoy ? "var(--danger-text)" : "var(--text-muted)" }}>vence {fechaCorta(m.vencimiento)}</div>}
                  </td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {puedePagar && <button type="button" className="btn" style={{ height: 26, fontSize: 11 }} onClick={() => { setMsg(null); setPagoDe(m); }}>{m.signo > 0 ? "Cobrar" : "Pagar"}</button>}
                    {p.puedo.anular && !anulado && (m.origen === "MANUAL" || m.origen === "IMPORTACION") && (
                      <button type="button" className="btn" style={{ height: 26, fontSize: 11, marginLeft: 4 }} onClick={() => { setMsg(null); setAnularDe(m); }}>Anular</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>
                {p.movimientos.length === 0 ? `No hay movimientos en ${nombreMes(p.mes)}.` : "Ningún movimiento coincide con los filtros."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        La unidad de negocio, el área, la naturaleza (fijo o variable) y el signo salen solos de la categoría. Ningún movimiento se borra: se anula con motivo.
      </div>
    </>
  );
}

function Campo({ label, children, ancho }: { label: string; children: React.ReactNode; ancho?: number }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: ancho ?? 150, flex: 1 }}>
      <span className="kp-label">{label}</span>
      {children}
    </label>
  );
}

function FormularioMovimiento(p: Props & { onCerrar: () => void; onListo: (t: string) => void }) {
  const [f, setF] = useState({
    fecha: p.hoy, tipo: "GASTO", concepto: "", categoriaId: "", subcategoria: "", cantidad: "", unidadMedida: "",
    contraparte: "", medioPago: "", cuentaFondosId: "", montoGs: "", pagado: true, fechaPago: p.hoy, fechaVencimiento: "",
    unidadId: "", facturaNumero: "", observacion: "", productoSanitarioId: "", mlPorUnidad: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const set = (k: keyof typeof f, v: string | boolean) => setF(x => ({ ...x, [k]: v }));
  const cats = p.categorias.filter(c => c.tipo === f.tipo);
  const cat = p.categorias.find(c => c.id === f.categoriaId);
  const esCobro = (cat?.signo ?? (f.tipo === "INGRESO" ? 1 : -1)) > 0;
  const esSanidad = cat?.nombre === "Sanidad" && /vacuna|medicamento/i.test(f.subcategoria);
  const precio = f.cantidad && f.montoGs && Number(f.cantidad.replace(",", ".")) > 0 ? Math.round(Number(f.montoGs) / Number(f.cantidad.replace(",", "."))) : null;

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await crearMovimiento({
        ...f, tipo: f.tipo as "GASTO", medioPago: (f.medioPago || null) as never, cuentaFondosId: f.cuentaFondosId || null, unidadId: f.unidadId || null,
        montoGs: f.montoGs.replace(/\D/g, ""), fechaPago: f.pagado ? f.fechaPago : undefined,
      });
      if (r.ok) p.onListo(r.aviso ? `Movimiento guardado. ${r.aviso}` : "Movimiento guardado.");
      else setError(r.error);
    });
  }

  return (
    <form onSubmit={guardar} style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>Cargar movimiento</div>
        <button type="button" onClick={p.onCerrar} aria-label="Cerrar" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Fecha" ancho={140}><input type="date" className="kp-input" value={f.fecha} onChange={e => set("fecha", e.target.value)} required /></Campo>
        <Campo label="Tipo" ancho={140}>
          <select className="kp-input" value={f.tipo} onChange={e => setF(x => ({ ...x, tipo: e.target.value, categoriaId: "", subcategoria: "" }))}>
            {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Concepto" ancho={240}><input className="kp-input" value={f.concepto} onChange={e => set("concepto", e.target.value)} maxLength={200} required placeholder="Ej: Balanceado de gestación semana 2" /></Campo>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Categoría" ancho={220}>
          <select className="kp-input" value={f.categoriaId} onChange={e => setF(x => ({ ...x, categoriaId: e.target.value, subcategoria: "" }))} required>
            <option value="">Elegí…</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Subcategoría">
          <input className="kp-input" list="subcats" value={f.subcategoria} onChange={e => set("subcategoria", e.target.value)} maxLength={80} />
          <datalist id="subcats">{cat?.subcategorias.map(s => <option key={s} value={s} />)}</datalist>
        </Campo>
        <Campo label="Cantidad" ancho={110}><input className="kp-input" inputMode="decimal" value={f.cantidad} onChange={e => set("cantidad", e.target.value)} placeholder="opcional" /></Campo>
        <Campo label="Unidad" ancho={100}>
          <input className="kp-input" list="umedidas" value={f.unidadMedida} onChange={e => set("unidadMedida", e.target.value)} maxLength={20} placeholder="kg, unidad…" />
          <datalist id="umedidas">{["kg", "Unidad", "Gl", "frasco", "dosis", "litro", "bolsa"].map(u => <option key={u} value={u} />)}</datalist>
        </Campo>
      </div>
      {esSanidad && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Campo label="Producto (del catálogo de Sanidad)" ancho={240}>
            <select className="kp-input" value={f.productoSanitarioId} onChange={e => set("productoSanitarioId", e.target.value)}>
              <option value="">Elegí…</option>
              {p.productos.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="ml por unidad (frasco)" ancho={140}><input className="kp-input" inputMode="decimal" value={f.mlPorUnidad} onChange={e => set("mlPorUnidad", e.target.value)} /></Campo>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label={esCobro ? "Cliente" : f.tipo === "FINANCIAMIENTO" ? "Acreedor / titular" : "Proveedor"} ancho={200}>
          <input className="kp-input" list="contrapartes" value={f.contraparte} onChange={e => set("contraparte", e.target.value)} maxLength={120} />
          <datalist id="contrapartes">{p.contrapartes.map(c => <option key={c.nombre} value={c.nombre} />)}</datalist>
        </Campo>
        <Campo label="Monto (₲)" ancho={150}>
          <input className="kp-input" inputMode="numeric" value={f.montoGs} onChange={e => set("montoGs", e.target.value.replace(/[^\d]/g, ""))} required placeholder="Ej: 3500000" style={{ fontVariantNumeric: "tabular-nums" }} />
        </Campo>
        {precio !== null && <div style={{ alignSelf: "flex-end", fontSize: 11.5, color: "var(--text-muted)", paddingBottom: 9 }}>{gs(precio)} por {f.unidadMedida || "unidad"}</div>}
        {p.unidades.length > 1 && (
          <Campo label="Unidad de negocio" ancho={170}>
            <select className="kp-input" value={f.unidadId} onChange={e => set("unidadId", e.target.value)}>
              <option value="">Según la categoría</option>
              {p.unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </Campo>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Campo label="Estado" ancho={170}>
          <select className="kp-input" value={f.pagado ? "1" : "0"} onChange={e => set("pagado", e.target.value === "1")}>
            <option value="1">{esCobro ? "Cobrado" : "Pagado"}</option>
            <option value="0">{esCobro ? "Por cobrar" : "Pendiente de pago"}</option>
          </select>
        </Campo>
        {f.pagado ? (
          <>
            <Campo label={esCobro ? "Fecha de cobro" : "Fecha de pago"} ancho={140}><input type="date" className="kp-input" value={f.fechaPago} onChange={e => set("fechaPago", e.target.value)} /></Campo>
            <Campo label="Medio" ancho={160}>
              <select className="kp-input" value={f.medioPago} onChange={e => set("medioPago", e.target.value)}>
                <option value="">—</option>{MEDIOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Campo>
            <Campo label="Caja / banco" ancho={170}>
              <select className="kp-input" value={f.cuentaFondosId} onChange={e => set("cuentaFondosId", e.target.value)}>
                <option value="">No aplica</option>{p.cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
          </>
        ) : (
          <Campo label="Vencimiento" ancho={140}><input type="date" className="kp-input" value={f.fechaVencimiento} onChange={e => set("fechaVencimiento", e.target.value)} /></Campo>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="N° de factura" ancho={140}><input className="kp-input" value={f.facturaNumero} onChange={e => set("facturaNumero", e.target.value)} maxLength={40} /></Campo>
        <Campo label="Observación" ancho={260}><input className="kp-input" value={f.observacion} onChange={e => set("observacion", e.target.value)} maxLength={500} /></Campo>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={p.onCerrar} disabled={pendiente}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={pendiente}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Guardar</button>
      </div>
    </form>
  );
}

export type MovPagable = Pick<Mov, "id" | "concepto" | "montoGs" | "pagadoGs" | "signo">;

export function FormularioPago({ mov, cuentas, hoy, onCerrar, onListo }: { mov: MovPagable; cuentas: Cuenta[]; hoy: string; onCerrar: () => void; onListo: (t: string) => void }) {
  const saldo = BigInt(mov.montoGs) - BigInt(mov.pagadoGs);
  const esCobro = mov.signo > 0;
  const [monto, setMonto] = useState(saldo.toString());
  const [fecha, setFecha] = useState(hoy);
  const [cuenta, setCuenta] = useState("");
  const [medio, setMedio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await registrarPago({ movimientoId: mov.id, montoGs: monto, fechaPago: fecha, cuentaFondosId: cuenta || null, medioPago: (medio || null) as never });
      if (r.ok) onListo(BigInt(monto) < saldo ? `${esCobro ? "Cobro" : "Pago"} parcial registrado. Queda un saldo de ${gs(saldo - BigInt(monto))}.` : `${esCobro ? "Cobro" : "Pago"} registrado.`);
      else setError(r.error);
    });
  }
  return (
    <form onSubmit={guardar} style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{esCobro ? "Registrar cobro" : "Registrar pago"}: {mov.concepto}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Monto {gs(mov.montoGs)} · ya {esCobro ? "cobrado" : "pagado"} {gs(mov.pagadoGs)} · saldo <strong>{gs(saldo)}</strong></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Campo label="Monto (₲)" ancho={150}><input className="kp-input" inputMode="numeric" value={monto} onChange={e => setMonto(e.target.value.replace(/\D/g, ""))} required /></Campo>
        <Campo label="Fecha" ancho={140}><input type="date" className="kp-input" value={fecha} onChange={e => setFecha(e.target.value)} required /></Campo>
        <Campo label="Caja / banco" ancho={170}>
          <select className="kp-input" value={cuenta} onChange={e => setCuenta(e.target.value)}>
            <option value="">No aplica</option>{cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Medio" ancho={160}>
          <select className="kp-input" value={medio} onChange={e => setMedio(e.target.value)}>
            <option value="">—</option>{MEDIOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Campo>
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCerrar} disabled={pendiente}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={pendiente || !monto}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Registrar</button>
      </div>
    </form>
  );
}

function FormularioAnular({ mov, onCerrar, onListo }: { mov: Mov; onCerrar: () => void; onListo: (t: string) => void }) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await anularMovimiento(mov.id, motivo);
      if (r.ok) onListo("Movimiento anulado. Queda tachado y ya no suma.");
      else setError(r.error);
    });
  }
  return (
    <form onSubmit={guardar} style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10, borderColor: "var(--danger)" }}>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>Anular: {mov.concepto} ({gs(mov.montoGs)})</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>No se borra: queda tachado con el motivo y deja de sumar. No se puede deshacer.</div>
      <Campo label="Motivo"><input className="kp-input" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300} required placeholder="Ej: cargado dos veces" /></Campo>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="btn" onClick={onCerrar} disabled={pendiente}>Cancelar</button>
        <button type="submit" className="btn btn-danger" disabled={pendiente || motivo.trim().length < 5}>{pendiente && <IconLoader2 size={14} className="animate-spin" aria-hidden />} Anular</button>
      </div>
    </form>
  );
}
