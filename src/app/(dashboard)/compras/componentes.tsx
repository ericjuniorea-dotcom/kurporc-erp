"use client";
// Formularios de Compras (Fase 13).
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconStar, IconStarFilled, IconTrash } from "@tabler/icons-react";
import { aceptarRespuesta, aceptarTerminosMercado, aprobarPedido, cancelarPedido, crearSolicitudCotizacion, dejarResena, enviarBorrador, pedirDirecto, recibirPedido } from "@/app/acciones/compras";
import { DEPARTAMENTOS } from "@/lib/validaciones/paraguay";

type Res = { ok: true } | { ok: false; error: string; terminos?: boolean };
const etiqueta: React.CSSProperties = { fontSize: 11.5, color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 4 };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16, display: "flex", flexDirection: "column", gap: 12 };
const Cargando = ({ p }: { p: boolean }) => p ? <IconLoader2 size={14} className="animate-spin" aria-hidden /> : null;
export const METODOS: [string, string][] = [["TRANSFERENCIA", "Transferencia"], ["EFECTIVO", "Efectivo"], ["CONTRA_ENTREGA", "Pago contra entrega"], ["CREDITO_VENDEDOR", "Crédito de la tienda"]];
const hoyISO = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);

function useAccion() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [terminos, setTerminos] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const correr = <T extends Res>(f: () => Promise<T>, ok?: (r: T) => void) => {
    setError(null);
    iniciar(async () => {
      const r = await f();
      if (r.ok) { ok?.(r); router.refresh(); }
      else { setError(r.error); setTerminos(!!r.terminos); }
    });
  };
  return { error, terminos, setTerminos, pendiente, correr, router };
}

function Error({ e }: { e: string | null }) {
  return e ? <div role="alert" style={{ fontSize: 13, color: "var(--danger-text)" }}>{e}</div> : null;
}

/** Aceptación de los Términos del Mercado (Fase 4) antes de la primera cotización o pedido. */
export function AceptarTerminos({ alAceptar }: { alAceptar: () => void }) {
  const [ok, setOk] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ ...tarjeta, borderColor: "var(--accent)", gap: 8 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>Antes de tu primera compra en el Mercado</div>
      <label style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        <input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} style={{ marginTop: 3 }} />
        <span>Acepto los <a href="/legal/terminos-mercado" target="_blank" rel="noopener noreferrer">Términos del Mercado KurPorc</a>: cada tienda es responsable de lo que vende y KurPorc no cobra ni interviene en el pago.</span>
      </label>
      {error && <div style={{ fontSize: 12.5, color: "var(--danger-text)" }}>{error}</div>}
      <button className="btn btn-primary" style={{ height: 34, alignSelf: "flex-start" }} disabled={!ok || pendiente}
        onClick={() => iniciar(async () => { const r = await aceptarTerminosMercado(); if (r.ok) alAceptar(); else setError(r.error); })}>
        <Cargando p={pendiente} /> Aceptar y continuar
      </button>
    </div>
  );
}

// ── Pedido directo desde una publicación ─────────────────────────────────
type Granja = { id: string; nombre: string };
export function FormPedidoDirecto({ publicacion, granjas, terminosPendientes }: {
  publicacion: { id: string; titulo: string; unidadVenta: string; precioGs: number; pedidoMinimo: number; stock: number | null; contenidoBase: number; unidadBase: string };
  granjas: Granja[]; terminosPendientes: boolean;
}) {
  const a = useAccion();
  const [cantidad, setCantidad] = useState(String(publicacion.pedidoMinimo));
  const [metodo, setMetodo] = useState("TRANSFERENCIA");
  const [granjaId, setGranjaId] = useState(granjas[0]?.id ?? "");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [faltaAceptar, setFaltaAceptar] = useState(terminosPendientes);
  const n = Math.max(0, Math.floor(Number(cantidad) || 0));
  const total = n * publicacion.precioGs;
  if (faltaAceptar || a.terminos) return <AceptarTerminos alAceptar={() => { setFaltaAceptar(false); a.setTerminos(false); }} />;
  return (
    <form onSubmit={e => { e.preventDefault(); a.correr(() => pedirDirecto({ publicacionId: publicacion.id, cantidad: n, metodoPago: metodo as "TRANSFERENCIA", granjaId: granjaId || null, direccion, notas }), r => a.router.push(`/compras/pedidos/${(r as unknown as { id: string }).id}`)); }}
      style={{ ...tarjeta, maxWidth: 640 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <label style={etiqueta}>Cantidad ({publicacion.unidadVenta})
          <input className="kp-input" type="number" min={publicacion.pedidoMinimo} max={publicacion.stock ?? undefined} value={cantidad} onChange={e => setCantidad(e.target.value)} required />
        </label>
        <label style={etiqueta}>Forma de pago
          <select className="kp-input" value={metodo} onChange={e => setMetodo(e.target.value)}>{METODOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        {granjas.length > 0 && (
          <label style={etiqueta}>Granja de destino
            <select className="kp-input" value={granjaId} onChange={e => setGranjaId(e.target.value)}>{granjas.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select>
          </label>
        )}
      </div>
      <label style={etiqueta}>Dirección de entrega
        <input className="kp-input" value={direccion} maxLength={300} onChange={e => setDireccion(e.target.value)} placeholder="Compañía, ruta, referencia" />
      </label>
      <label style={etiqueta}>Notas para la tienda
        <textarea className="kp-input" rows={2} value={notas} maxLength={1000} onChange={e => setNotas(e.target.value)} style={{ height: "auto", padding: 8 }} />
      </label>
      <div style={{ fontSize: 14 }}>Total: <strong>Gs {total.toLocaleString("es-PY")}</strong> <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {(n * publicacion.contenidoBase).toLocaleString("es-PY")} {publicacion.unidadBase.toLowerCase()} · el envío lo coordina la tienda</span></div>
      <Error e={a.error} />
      <button type="submit" className="btn btn-primary" style={{ height: 38, alignSelf: "flex-start" }} disabled={a.pendiente || n < publicacion.pedidoMinimo}><Cargando p={a.pendiente} /> Enviar pedido</button>
    </form>
  );
}

// ── Acciones sobre un pedido ──────────────────────────────────────────────
export function AccionesPedido({ id, estado, puedeAprobar, puedeCancelar, puedeEnviar }: { id: string; estado: string; puedeAprobar: boolean; puedeCancelar: boolean; puedeEnviar: boolean }) {
  const a = useAccion();
  const [nota, setNota] = useState("");
  const [modo, setModo] = useState<"" | "cancelar" | "devolver">("");
  const cancelable = ["BORRADOR", "PENDIENTE_APROBACION", "ENVIADO", "CONFIRMADO"].includes(estado);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {estado === "PENDIENTE_APROBACION" && puedeAprobar && <>
          <button className="btn btn-primary" style={{ height: 34 }} disabled={a.pendiente} onClick={() => a.correr(() => aprobarPedido(id, true, ""))}><Cargando p={a.pendiente} /> Aprobar y enviar a la tienda</button>
          <button className="btn" style={{ height: 34 }} onClick={() => setModo("devolver")}>No aprobar…</button>
        </>}
        {estado === "BORRADOR" && puedeEnviar && <button className="btn btn-primary" style={{ height: 34 }} disabled={a.pendiente} onClick={() => a.correr(() => enviarBorrador(id))}>Enviar de nuevo</button>}
        {cancelable && puedeCancelar && <button className="btn" style={{ height: 34, color: "var(--danger-text)" }} onClick={() => setModo("cancelar")}>Cancelar pedido…</button>}
      </div>
      {modo && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="kp-input" value={nota} onChange={e => setNota(e.target.value)} maxLength={500} placeholder={modo === "cancelar" ? "Motivo de la cancelación" : "Por qué no se aprueba"} style={{ flex: 1, minWidth: 240 }} />
          <button className="btn" style={{ height: 34 }} disabled={a.pendiente} onClick={() => a.correr(() => (modo === "cancelar" ? cancelarPedido(id, nota) : aprobarPedido(id, false, nota)), () => setModo(""))}>Confirmar</button>
          <button className="btn" style={{ height: 34 }} onClick={() => setModo("")}>Volver</button>
        </div>
      )}
      <Error e={a.error} />
    </div>
  );
}

// ── Recepción ─────────────────────────────────────────────────────────────
type ItemRecibir = { id: string; descripcion: string; cantidad: number; contenidoBase: number; unidadBase: string; sugerido: string | null };
type ProductoStock = { id: string; nombre: string; categoria: string; unidad: string };
const SANIDAD = new Set(["VACUNA", "MEDICAMENTO", "SUPLEMENTO"]);

export function FormRecepcion({ pedidoId, items, productos, unidades, cuentas, puedePagar, metodoPago }: {
  pedidoId: string; items: ItemRecibir[]; productos: ProductoStock[]; unidades: { id: string; nombre: string }[];
  cuentas: { id: string; nombre: string }[]; puedePagar: boolean; metodoPago: string;
}) {
  const a = useAccion();
  const [fecha, setFecha] = useState(hoyISO());
  const [unidadId, setUnidadId] = useState(unidades[0]?.id ?? "");
  const [pagado, setPagado] = useState(false);
  const [cuenta, setCuenta] = useState("");
  const [vencePago, setVencePago] = useState("");
  const [factura, setFactura] = useState("");
  const [filas, setFilas] = useState(items.map(i => ({ itemId: i.id, cantidadRecibida: String(i.cantidad), productoInventarioId: i.sugerido ?? "", cantidadStock: String(i.cantidad * i.contenidoBase), lote: "", vencimiento: "" })));
  const set = (idx: number, k: keyof (typeof filas)[number], v: string) => setFilas(fs => fs.map((f, i) => {
    if (i !== idx) return f;
    const n = { ...f, [k]: v };
    if (k === "cantidadRecibida") n.cantidadStock = String((Number(v) || 0) * items[idx].contenidoBase);
    return n;
  }));
  return (
    <form onSubmit={e => { e.preventDefault(); a.correr(() => recibirPedido({
      pedidoId, fecha, unidadId, pagado, cuentaFondosId: cuenta || null, vencimientoPago: vencePago, facturaNumero: factura,
      items: filas.map(f => ({ itemId: f.itemId, cantidadRecibida: Number(f.cantidadRecibida) || 0, productoInventarioId: f.productoInventarioId || null, cantidadStock: Number(f.cantidadStock) || 0, lote: f.lote, vencimiento: f.vencimiento })),
    })); }} style={tarjeta}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Recibir el pedido</div>
      <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Al confirmar, lo recibido entra a tu stock y se carga el gasto en Finanzas con la tienda como proveedor. Si no lo pagaste todavía, queda en Cuentas por pagar.</div>
      <div style={{ overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 900 }}>
          <thead><tr><th>Producto</th><th>Recibido</th><th>Entra a stock como</th><th>Cantidad en stock</th><th>Lote</th><th>Vencimiento</th></tr></thead>
          <tbody>{items.map((it, i) => {
            const f = filas[i];
            const prod = productos.find(p => p.id === f.productoInventarioId);
            const san = prod && SANIDAD.has(prod.categoria);
            return (
              <tr key={it.id}>
                <td style={{ fontSize: 12.5 }}>{it.descripcion}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>Pedido: {it.cantidad}</div></td>
                <td><input className="kp-input" type="number" min={0} max={it.cantidad} step="any" value={f.cantidadRecibida} onChange={e => set(i, "cantidadRecibida", e.target.value)} style={{ width: 80 }} /></td>
                <td>
                  <select className="kp-input" value={f.productoInventarioId} onChange={e => set(i, "productoInventarioId", e.target.value)} style={{ minWidth: 200 }}>
                    <option value="">No entra a stock (equipo o servicio)</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.unidad.toLowerCase()})</option>)}
                  </select>
                </td>
                <td><input className="kp-input" type="number" min={0} step="any" value={f.cantidadStock} disabled={!f.productoInventarioId} onChange={e => set(i, "cantidadStock", e.target.value)} style={{ width: 100 }} />
                  {prod && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 4 }}>{prod.unidad.toLowerCase()}</span>}</td>
                <td><input className="kp-input" value={f.lote} disabled={!f.productoInventarioId} required={!!san} onChange={e => set(i, "lote", e.target.value)} placeholder={san ? "Obligatorio" : "Opcional"} style={{ width: 110 }} /></td>
                <td><input className="kp-input" type="date" value={f.vencimiento} disabled={!f.productoInventarioId} required={!!san} onChange={e => set(i, "vencimiento", e.target.value)} /></td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
      {productos.length === 0 && <div style={{ fontSize: 12, color: "var(--warning-text)" }}>Todavía no tenés productos en stock. Crealos en Logística → Inventario y volvé a esta pantalla.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <label style={etiqueta}>Fecha de recepción<input className="kp-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required /></label>
        <label style={etiqueta}>Unidad de negocio
          <select className="kp-input" value={unidadId} onChange={e => setUnidadId(e.target.value)} required>{unidades.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
        </label>
        <label style={etiqueta}>N.º de factura (opcional)<input className="kp-input" value={factura} maxLength={40} onChange={e => setFactura(e.target.value)} /></label>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        {puedePagar && <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={pagado} onChange={e => setPagado(e.target.checked)} /> Ya lo pagué</label>}
        {pagado ? (
          cuentas.length > 0 && <label style={etiqueta}>Pagado desde<select className="kp-input" value={cuenta} onChange={e => setCuenta(e.target.value)}><option value="">Sin indicar</option>{cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
        ) : (
          <label style={etiqueta}>Vence el pago{metodoPago === "CREDITO_VENDEDOR" ? " (por defecto, 30 días)" : ""}<input className="kp-input" type="date" value={vencePago} onChange={e => setVencePago(e.target.value)} /></label>
        )}
      </div>
      <Error e={a.error} />
      <button type="submit" className="btn btn-primary" style={{ height: 38, alignSelf: "flex-start" }} disabled={a.pendiente || !unidadId}><Cargando p={a.pendiente} /> Confirmar recepción</button>
    </form>
  );
}

export function FormResena({ pedidoId, tienda }: { pedidoId: string; tienda: string }) {
  const a = useAccion();
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  return (
    <div style={tarjeta}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>¿Cómo te fue con {tienda}?</div>
      <div style={{ display: "flex", gap: 4 }} role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={estrellas === n} aria-label={`${n} estrella${n > 1 ? "s" : ""}`} onClick={() => setEstrellas(n)}
            style={{ background: "none", border: 0, cursor: "pointer", padding: 2, color: n <= estrellas ? "#E8A317" : "var(--text-muted)" }}>
            {n <= estrellas ? <IconStarFilled size={24} /> : <IconStar size={24} />}
          </button>
        ))}
      </div>
      <textarea className="kp-input" rows={2} value={comentario} maxLength={1000} onChange={e => setComentario(e.target.value)} placeholder="Contá cómo fue la entrega, la calidad y la atención (opcional)" style={{ height: "auto", padding: 8 }} />
      <Error e={a.error} />
      <button className="btn btn-primary" style={{ height: 34, alignSelf: "flex-start" }} disabled={!estrellas || a.pendiente} onClick={() => a.correr(() => dejarResena(pedidoId, estrellas, comentario))}><Cargando p={a.pendiente} /> Publicar reseña</button>
    </div>
  );
}

// ── Solicitud de cotización ───────────────────────────────────────────────
type ProductoCat = { id: string; codigo: string; nombre: string; unidad: string; categoria: string };
export function FormSolicitud({ productos, granjas, departamentoDefecto, inicial, terminosPendientes }: { productos: ProductoCat[]; granjas: (Granja & { departamento: string | null })[]; departamentoDefecto: string; inicial: string | null; terminosPendientes: boolean }) {
  const a = useAccion();
  const [items, setItems] = useState<{ productoCatalogoId: string; cantidadBase: string; nota: string }[]>(inicial ? [{ productoCatalogoId: inicial, cantidadBase: "", nota: "" }] : []);
  const [buscar, setBuscar] = useState("");
  const [granjaId, setGranjaId] = useState(granjas[0]?.id ?? "");
  const [depto, setDepto] = useState(granjas[0]?.departamento ?? departamentoDefecto);
  const [fecha, setFecha] = useState("");
  const [nota, setNota] = useState("");
  const [faltaAceptar, setFaltaAceptar] = useState(terminosPendientes);
  const [enviado, setEnviado] = useState<number | null>(null);
  const sugeridos = useMemo(() => {
    const q = buscar.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/).filter(Boolean);
    if (!q.length) return [];
    return productos.filter(p => !items.some(i => i.productoCatalogoId === p.id) && q.every(w => `${p.nombre} ${p.codigo}`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(w))).slice(0, 8);
  }, [buscar, productos, items]);
  if (faltaAceptar || a.terminos) return <AceptarTerminos alAceptar={() => { setFaltaAceptar(false); a.setTerminos(false); }} />;
  if (enviado !== null) return <div style={{ ...tarjeta, fontSize: 13.5 }}>Listo: le pedimos cotización a {enviado} tienda{enviado > 1 ? "s" : ""}. Te avisamos a medida que respondan. Redirigiendo…</div>;
  return (
    <form onSubmit={e => { e.preventDefault(); a.correr(() => crearSolicitudCotizacion({
      items: items.map(i => ({ productoCatalogoId: i.productoCatalogoId, cantidadBase: Number(i.cantidadBase.replace(",", ".")), nota: i.nota })),
      granjaId: granjaId || null, departamento: depto as (typeof DEPARTAMENTOS)[number], fechaRequerida: fecha, nota,
    }), r => { const x = r as unknown as { id: string; tiendas: number }; setEnviado(x.tiendas); setTimeout(() => a.router.push(`/compras/cotizaciones/${x.id}`), 1200); }); }}
      style={{ ...tarjeta, maxWidth: 860 }}>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Elegí los productos y cuánto necesitás. Se la mandamos a hasta 10 tiendas verificadas que entregan en tu departamento, y comparás las respuestas en una sola tabla.</div>
      <div style={{ position: "relative" }}>
        <input className="kp-input" value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Agregar producto: maíz, núcleo lactación, vacuna circovirus…" style={{ width: "100%" }} aria-label="Buscar producto" />
        {sugeridos.length > 0 && (
          <div style={{ position: "absolute", zIndex: 5, left: 0, right: 0, top: "100%", marginTop: 4, ...tarjeta, padding: 4, gap: 0, boxShadow: "0 6px 20px rgba(0,0,0,.12)" }}>
            {sugeridos.map(p => (
              <button key={p.id} type="button" onClick={() => { setItems([...items, { productoCatalogoId: p.id, cantidadBase: "", nota: "" }]); setBuscar(""); }}
                style={{ textAlign: "left", padding: "7px 10px", background: "none", border: 0, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
                {p.nombre} <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.categoria} · por {p.unidad.toLowerCase()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {items.length > 0 && (
        <table className="kp-table">
          <thead><tr><th>Producto</th><th>Cantidad</th><th>Nota</th><th></th></tr></thead>
          <tbody>{items.map((it, i) => {
            const p = productos.find(x => x.id === it.productoCatalogoId);
            return (
              <tr key={it.productoCatalogoId}>
                <td style={{ fontSize: 13 }}>{p?.nombre ?? "—"}</td>
                <td><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><input className="kp-input" inputMode="decimal" required value={it.cantidadBase} onChange={e => setItems(items.map((x, j) => (j === i ? { ...x, cantidadBase: e.target.value } : x)))} style={{ width: 100 }} /> <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{p?.unidad.toLowerCase()}</span></span></td>
                <td><input className="kp-input" value={it.nota} maxLength={300} onChange={e => setItems(items.map((x, j) => (j === i ? { ...x, nota: e.target.value } : x)))} placeholder="Marca preferida, presentación…" /></td>
                <td><button type="button" aria-label="Quitar" className="btn" style={{ height: 28 }} onClick={() => setItems(items.filter((_, j) => j !== i))}><IconTrash size={13} /></button></td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {granjas.length > 0 && (
          <label style={etiqueta}>Granja de destino
            <select className="kp-input" value={granjaId} onChange={e => { setGranjaId(e.target.value); const g = granjas.find(x => x.id === e.target.value); if (g?.departamento) setDepto(g.departamento); }}>{granjas.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select>
          </label>
        )}
        <label style={etiqueta}>Entrega en
          <select className="kp-input" value={depto} onChange={e => setDepto(e.target.value)} required><option value="">Elegí…</option>{DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </label>
        <label style={etiqueta}>Lo necesito para (opcional)<input className="kp-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
      </div>
      <label style={etiqueta}>Nota para las tiendas<textarea className="kp-input" rows={2} value={nota} maxLength={1000} onChange={e => setNota(e.target.value)} style={{ height: "auto", padding: 8 }} /></label>
      <Error e={a.error} />
      <button type="submit" className="btn btn-primary" style={{ height: 38, alignSelf: "flex-start" }} disabled={a.pendiente || !items.length || !depto}><Cargando p={a.pendiente} /> Pedir cotización</button>
    </form>
  );
}

export function AceptarCotizacion({ respuestaId, tienda, total }: { respuestaId: string; tienda: string; total: number }) {
  const a = useAccion();
  const [abierto, setAbierto] = useState(false);
  const [metodo, setMetodo] = useState("TRANSFERENCIA");
  const [direccion, setDireccion] = useState("");
  if (a.terminos) return <AceptarTerminos alAceptar={() => a.setTerminos(false)} />;
  if (!abierto) return <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} onClick={() => setAbierto(true)}>Aceptar</button>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
      <div style={{ fontSize: 12 }}>Pedido a <strong>{tienda}</strong> por Gs {total.toLocaleString("es-PY")}</div>
      <select className="kp-input" value={metodo} onChange={e => setMetodo(e.target.value)} aria-label="Forma de pago">{METODOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <input className="kp-input" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección de entrega" maxLength={300} />
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} disabled={a.pendiente} onClick={() => a.correr(() => aceptarRespuesta(respuestaId, metodo, direccion), r => a.router.push(`/compras/pedidos/${(r as unknown as { id: string }).id}`))}><Cargando p={a.pendiente} /> Hacer el pedido</button>
        <button className="btn" style={{ height: 30, fontSize: 12 }} onClick={() => setAbierto(false)}>Volver</button>
      </div>
      <Error e={a.error} />
    </div>
  );
}
