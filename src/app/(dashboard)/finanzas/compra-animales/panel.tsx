"use client";
// Compra de animales: lechones (por lote, con caravanas y pesos si los hay) o reproductoras/reproductores (uno por uno).
// Al guardar se registra el gasto en el libro y los animales quedan «por recibir» en el módulo de destino.
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconLoader2, IconPlus, IconTruckDelivery, IconX } from "@tabler/icons-react";
import { registrarCompraAnimales } from "@/app/acciones/transferencias";
import { CATEGORIAS, DESTINOS_COMPRA, ESTADOS, MODULOS_TRANSFERENCIA, type CategoriaAnimal } from "@/lib/transferencias/tipos";
import { gs } from "@/lib/finanzas/calculos";
import { MEDIOS } from "../movimientos/libro";

type Compra = { id: string; fecha: string; categoria: string; destino: string; proveedor: string | null; cantidad: number; cantidadRecibida: number | null;
  pesoTotalKg: number | null; costoGs: number | null; estado: string; nota: string | null; cargo: string | null; recibio: string | null };
type Fila = { caravana: string; sexo: "H" | "M" | ""; pesoKg: string; genetica: string; nacimiento: string };
const filaVacia = (): Fila => ({ caravana: "", sexo: "", pesoKg: "", genetica: "", nacimiento: "" });
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 14 };
const etiqueta: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-secondary)", minWidth: 0 };
const num = (s: string) => { const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };

function Segmentos<T extends string>({ valor, opciones, onCambio, nombre }: { valor: T; opciones: { v: T; t: string }[]; onCambio: (v: T) => void; nombre: string }) {
  return (
    <div role="radiogroup" aria-label={nombre} style={{ display: "flex", gap: 2, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)", flexWrap: "wrap" }}>
      {opciones.map(o => (
        <button key={o.v} type="button" role="radio" aria-checked={valor === o.v} onClick={() => onCambio(o.v)}
          style={{ flex: "1 1 auto", fontSize: 13, padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer",
            background: valor === o.v ? "var(--bg-surface)" : "transparent", color: valor === o.v ? "var(--text-primary)" : "var(--text-muted)", fontWeight: valor === o.v ? 600 : 400 }}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

export function PanelCompraAnimales(p: { hoy: string; compras: Compra[]; proveedores: string[]; cuentas: { id: string; nombre: string }[]; puedo: { crear: boolean; pagar: boolean } }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(p.compras.length === 0 && p.puedo.crear);
  const [categoria, setCategoria] = useState<CategoriaAnimal>("LECHONES");
  const [destino, setDestino] = useState<string>("INICIACION");
  const [fecha, setFecha] = useState(p.hoy);
  const [proveedor, setProveedor] = useState("");
  const [factura, setFactura] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [pesoTotal, setPesoTotal] = useState("");
  const [edad, setEdad] = useState("");
  const [caravanasTxt, setCaravanasTxt] = useState("");
  const [filas, setFilas] = useState<Fila[]>([filaVacia()]);
  const [ubicacion, setUbicacion] = useState("");
  const [monto, setMonto] = useState("");
  const [pagado, setPagado] = useState(false);
  const [medio, setMedio] = useState<string>("TRANSFERENCIA");
  const [cuenta, setCuenta] = useState("");
  const [obs, setObs] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  const porAnimal = categoria !== "LECHONES";
  const cambiarCategoria = (c: CategoriaAnimal) => { setCategoria(c); setDestino(DESTINOS_COMPRA[c][0]); };
  // Reproductoras/reproductores: una fila por animal según la cantidad
  const ajustarFilas = (n: number) => setFilas(fs => n > 0 && n <= 200 ? Array.from({ length: n }, (_, i) => fs[i] ?? filaVacia()) : fs);
  const caravanasLechones = useMemo(() => caravanasTxt.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean), [caravanasTxt]);
  const setFila = (i: number, k: keyof Fila, v: string) => setFilas(fs => fs.map((f, j) => j === i ? { ...f, [k]: v } : f));

  function guardar() {
    setMsg(null);
    const n = num(cantidad);
    if (!Number.isInteger(n) || n < 1) { setMsg({ tipo: "error", texto: "Escribí cuántos animales compraste." }); return; }
    const montoLimpio = monto.replace(/\D/g, "");
    if (!montoLimpio || BigInt(montoLimpio) <= 0n) { setMsg({ tipo: "error", texto: "Escribí cuánto pagaste en total (guaraníes)." }); return; }
    const pt = pesoTotal ? num(pesoTotal) : null, ed = edad ? num(edad) : null;
    const animales = porAnimal
      ? filas.slice(0, n).map(f => ({ caravana: f.caravana.trim(), sexo: f.sexo, pesoKg: f.pesoKg ? num(f.pesoKg) : null, genetica: f.genetica.trim(), nacimiento: f.nacimiento }))
      : caravanasLechones.map(c => ({ caravana: c }));
    iniciar(async () => {
      const r = await registrarCompraAnimales({
        fecha, categoria, destino: destino as "INICIACION", proveedor, cantidad: n, pesoTotalKg: pt != null && Number.isFinite(pt) ? pt : null,
        edadDias: ed != null && Number.isFinite(ed) ? Math.round(ed) : null, montoGs: montoLimpio, pagado,
        medioPago: pagado ? medio as "EFECTIVO" : null, cuentaFondosId: pagado && cuenta ? cuenta : null,
        facturaNumero: factura, ubicacion, observacion: obs, animales,
      });
      if (!r.ok) { setMsg({ tipo: "error", texto: r.error }); return; }
      setMsg({ tipo: "ok", texto: `Listo: el gasto quedó en el libro y ${n} ${CATEGORIAS[categoria].unidad} quedaron por recibir en ${MODULOS_TRANSFERENCIA[destino as keyof typeof MODULOS_TRANSFERENCIA].etiqueta}.${r.aviso ? ` ${r.aviso}` : ""}` });
      setCantidad(""); setPesoTotal(""); setEdad(""); setCaravanasTxt(""); setFilas([filaVacia()]); setMonto(""); setFactura(""); setObs("");
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Compra de animales</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Lechones, reproductoras o reproductores de otra granja. El módulo que los recibe los acepta y recién ahí entran.</p>
        </div>
        {p.puedo.crear && !abierto && <button type="button" className="btn btn-primary" onClick={() => setAbierto(true)}><IconPlus size={14} aria-hidden /> Registrar compra</button>}
      </div>
      {msg && <div role="status" className={msg.tipo === "ok" ? "kp-alert kp-alert-ok" : "kp-alert kp-alert-danger"} style={{ fontSize: 13 }}>{msg.texto}</div>}

      {abierto && p.puedo.crear && (
        <section style={{ ...tarjeta, display: "flex", flexDirection: "column", gap: 14 }} aria-label="Nueva compra de animales">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Nueva compra</h3>
            <button type="button" className="btn" onClick={() => setAbierto(false)} aria-label="Cerrar"><IconX size={14} /></button>
          </div>
          <label style={etiqueta}>¿Qué compraste?
            <Segmentos nombre="Qué compraste" valor={categoria} onCambio={cambiarCategoria}
              opciones={[{ v: "LECHONES", t: "Lechones" }, { v: "REPRODUCTORAS", t: "Reproductoras" }, { v: "REPRODUCTORES", t: "Reproductores (machos)" }]} />
          </label>
          <label style={etiqueta}>¿A qué módulo van?
            <Segmentos nombre="Destino" valor={destino} onCambio={setDestino}
              opciones={DESTINOS_COMPRA[categoria].map(d => ({ v: d, t: MODULOS_TRANSFERENCIA[d].etiqueta }))} />
          </label>
          <div className="kp-form-compra">
            <label style={etiqueta}>Fecha de compra<input type="date" className="kp-input" value={fecha} max={p.hoy} onChange={e => setFecha(e.target.value)} /></label>
            <label style={etiqueta}>Granja de origen<input className="kp-input" list="proveedores-animales" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Ej.: Granja San José" /></label>
            <label style={etiqueta}>Cantidad<input className="kp-input" inputMode="numeric" value={cantidad} onChange={e => { setCantidad(e.target.value); if (porAnimal) ajustarFilas(num(e.target.value)); }} placeholder="Ej.: 50" /></label>
            <label style={etiqueta}>Factura N° (opcional)<input className="kp-input" value={factura} onChange={e => setFactura(e.target.value)} /></label>
            {!porAnimal && <label style={etiqueta}>Peso total en kg (si tenés)<input className="kp-input" inputMode="decimal" value={pesoTotal} onChange={e => setPesoTotal(e.target.value)} placeholder="Ej.: 350" /></label>}
            {!porAnimal && <label style={etiqueta}>Edad promedio en días (si sabés)<input className="kp-input" inputMode="numeric" value={edad} onChange={e => setEdad(e.target.value)} placeholder="Ej.: 28" /></label>}
            <label style={etiqueta}>¿Dónde van a quedar? (opcional)<input className="kp-input" value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Galpón / corral" /></label>
          </div>
          <datalist id="proveedores-animales">{p.proveedores.map(x => <option key={x} value={x} />)}</datalist>

          {!porAnimal ? (
            <label style={etiqueta}>Caravanas (opcional: una por renglón o separadas por coma)
              <textarea className="kp-input" rows={3} value={caravanasTxt} onChange={e => setCaravanasTxt(e.target.value)} placeholder="Si los lechones vienen con caravana, anotalas acá" style={{ resize: "vertical" }} />
              {caravanasLechones.length > 0 && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{caravanasLechones.length} caravanas</span>}
            </label>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>Datos de cada {categoria === "REPRODUCTORAS" ? "reproductora" : "reproductor"} (la caravana es obligatoria)</div>
              {filas.map((f, i) => (
                <div key={i} className="kp-fila-animal">
                  <span style={{ fontSize: 12, color: "var(--text-muted)", alignSelf: "center" }}>{i + 1}</span>
                  <input className="kp-input" aria-label={`Caravana ${i + 1}`} placeholder="Caravana *" value={f.caravana} onChange={e => setFila(i, "caravana", e.target.value)} />
                  <input className="kp-input" aria-label={`Genética ${i + 1}`} placeholder="Genética" value={f.genetica} onChange={e => setFila(i, "genetica", e.target.value)} />
                  <input className="kp-input" aria-label={`Peso ${i + 1}`} inputMode="decimal" placeholder="Peso kg" value={f.pesoKg} onChange={e => setFila(i, "pesoKg", e.target.value)} />
                  <input className="kp-input" aria-label={`Nacimiento ${i + 1}`} type="date" value={f.nacimiento} onChange={e => setFila(i, "nacimiento", e.target.value)} />
                </div>
              ))}
            </div>
          )}

          <div className="kp-form-compra">
            <label style={etiqueta}>Total pagado (₲)<input className="kp-input" inputMode="numeric" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej.: 21750000" />
              {monto.replace(/\D/g, "") && <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{gs(monto.replace(/\D/g, ""))}{num(cantidad) > 0 ? ` · ${gs(String(Math.round(Number(monto.replace(/\D/g, "")) / num(cantidad))))} por animal` : ""}</span>}
            </label>
            <label style={etiqueta}>¿Ya se pagó?
              <Segmentos nombre="Ya se pagó" valor={pagado ? "si" : "no"} onCambio={v => setPagado(v === "si" && p.puedo.pagar)} opciones={[{ v: "no", t: "No, queda por pagar" }, ...(p.puedo.pagar ? [{ v: "si" as const, t: "Sí" }] : [])]} />
            </label>
            {pagado && <label style={etiqueta}>Medio de pago<select className="kp-input" value={medio} onChange={e => setMedio(e.target.value)}>{MEDIOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>}
            {pagado && p.cuentas.length > 0 && <label style={etiqueta}>Cuenta<select className="kp-input" value={cuenta} onChange={e => setCuenta(e.target.value)}><option value="">—</option>{p.cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>}
          </div>
          <label style={etiqueta}>Observación (opcional)<input className="kp-input" value={obs} onChange={e => setObs(e.target.value)} /></label>
          <button type="button" className="btn btn-primary" disabled={pendiente} onClick={guardar} style={{ minHeight: 44, justifyContent: "center", fontSize: 14 }}>
            {pendiente ? <IconLoader2 size={15} className="animate-spin" aria-hidden /> : <IconTruckDelivery size={16} aria-hidden />} Guardar compra y enviar a {MODULOS_TRANSFERENCIA[destino as keyof typeof MODULOS_TRANSFERENCIA].etiqueta}
          </button>
        </section>
      )}

      <section style={{ ...tarjeta, padding: 0, overflow: "hidden" }} aria-label="Compras registradas">
        <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>Compras registradas</div>
        {p.compras.length === 0 ? <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>Todavía no hay compras de animales.</div> : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {p.compras.map(c => (
              <li key={c.id} style={{ padding: "10px 14px", borderTop: "0.5px solid var(--border-default)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
                <span className={c.estado === "RECIBIDA" ? "badge badge-ok" : c.estado === "EN_CAMINO" ? "badge badge-warn" : "badge badge-danger"}>{ESTADOS[c.estado as keyof typeof ESTADOS] ?? c.estado}</span>
                <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <strong>{c.cantidad}</strong> {CATEGORIAS[c.categoria as CategoriaAnimal]?.unidad ?? "animales"} de {c.proveedor ?? "—"} → {c.destino}
                  {c.cantidadRecibida != null && c.cantidadRecibida !== c.cantidad && <span style={{ color: "var(--danger-text)" }}> · llegaron {c.cantidadRecibida}</span>}
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {c.fecha.slice(0, 10).split("-").reverse().join("/")}{c.costoGs ? ` · ${gs(String(c.costoGs))}` : ""}{c.cargo ? ` · cargó ${c.cargo}` : ""}{c.recibio ? ` · recibió ${c.recibio}` : ""}{c.nota ? ` · ${c.nota}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
