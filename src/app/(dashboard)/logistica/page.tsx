"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession, usePermisos } from "@/lib/auth/sesion-cliente";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import {
  IconTruck, IconLoader2, IconAlertTriangle, IconPlus, IconCheck,
  IconExternalLink, IconHistory, IconPackage, IconSearch, IconX,
  IconAlertCircle, IconCoin,
} from "@tabler/icons-react";
import { CentralAnalisisLogistica } from "@/components/logistica/central-analisis";

const ALLOWED = [1, 2, 3, 7];

interface StockItem {
  productoId: string;
  nombre: string;
  enfermedad: string;
  codigo: string | null;
  categoria: string;
  unidadMedida: string;
  criticidad: string;
  stockMinimo: number | null;
  stockNoVencido: number;
  demandaProyectada: number | null;
  ventanaDias: number;
  diasHastaAgotamiento: number | null;
  faltante: number;
  costoUnitarioPromedio: number | null;
  valorInvertido: number;
  alertaDemanda: boolean;
  alertaStockMinimo: boolean;
  alertaStock: boolean;
}

interface Movimiento {
  id: string;
  fecha: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE";
  origen: string;
  cantidad: number;
  producto: { nombre: string; codigo: string | null; categoria: string; unidadMedida: string };
  numeroLote: string | null;
}

const CATEGORIA_LABEL: Record<string, string> = {
  VACUNA: "Vacunas", SUPLEMENTO: "Suplementos", MEDICAMENTO: "Medicamentos",
  BALANCEADO: "Balanceado", EQUIPAMIENTO: "Equipamiento",
};
const CATEGORIA_A_MARKETPLACE: Record<string, string> = {
  VACUNA: "VACUNA", SUPLEMENTO: "INSUMO", MEDICAMENTO: "MEDICAMENTO",
  BALANCEADO: "ALIMENTO", EQUIPAMIENTO: "EQUIPAMIENTO",
};
const UNIDAD_LABEL: Record<string, string> = { DOSIS: "dosis", ML: "ml", KG: "kg", UNIDAD: "unidades", SACO: "sacos" };
const UNIDAD_POR_CATEGORIA: Array<{ categoria: string; unidad: string }> = [
  { categoria: "Vacunas",       unidad: "dosis" },
  { categoria: "Suplementos",   unidad: "dosis / unidad" },
  { categoria: "Medicamentos",  unidad: "ml" },
  { categoria: "Materia prima", unidad: "kg" },
  { categoria: "Balanceado",    unidad: "kg" },
  { categoria: "Equipamiento",  unidad: "unidades" },
];
const FILTROS = ["TODOS", "VACUNA", "SUPLEMENTO", "MEDICAMENTO", "BALANCEADO", "EQUIPAMIENTO"] as const;

const TIPO_COLOR: Record<string, string> = { ENTRADA: "var(--success)", SALIDA: "var(--danger)", AJUSTE: "var(--warning)" };
const ORIGEN_LABEL: Record<string, string> = {
  VACUNACION: "Vacunación", TRATAMIENTO: "Tratamiento", MATERNIDAD: "Maternidad",
  ALIMENTACION: "Alimentación", COMPRA: "Compra", AJUSTE_MANUAL: "Ajuste manual",
};

function todayPlusYears(y: number) { const d = new Date(); d.setFullYear(d.getFullYear() + y); return d.toISOString().slice(0, 10); }
function fmtGs(v: number | null | undefined) { return v == null ? "—" : `₲ ${Math.round(v).toLocaleString("es-PY")}`; }

function KpiCard({ label, value, color, onClick, active }: { label: string; value: string; color: string; onClick?: () => void; active?: boolean }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-surface)", border: `0.5px solid ${active ? color : "var(--border-default)"}`,
        borderRadius: "var(--radius-lg)", padding: "12px 16px", flex: 1,
        cursor: onClick ? "pointer" : "default", transition: "border-color 0.15s",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export default function LogisticaPage() {
  const { data: session, status } = useSession();
  const { alguno } = usePermisos();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [stock,       setStock]       = useState<StockItem[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filtro,      setFiltro]      = useState<(typeof FILTROS)[number]>("TODOS");
  const [busqueda,    setBusqueda]    = useState("");
  const [tab,         setTab]         = useState<"inventario" | "movimientos" | "analisis">("inventario");
  const [mostrarCriticos, setMostrarCriticos] = useState(false);
  const [msg,         setMsg]         = useState<string | null>(null);
  const [err,         setErr]         = useState<string | null>(null);

  const EMPTY_FORM = { productoId: "", cantidad: "", numeroLote: "", fechaVencimiento: todayPlusYears(2), proveedor: "", costoUnitario: "" };
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const canEdit = alguno(["stock.entradas.crear", "stock.items.editar"]);
  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, mRes] = await Promise.all([
        fetch("/api/logistica/inventario"),
        fetch("/api/logistica/movimientos"),
      ]);
      const [sd, md] = await Promise.all([sRes.json(), mRes.json()]);
      if (Array.isArray(sd)) setStock(sd);
      if (Array.isArray(md)) setMovimientos(md);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated") load();
  }, [status, router, load]);

  const productoSeleccionado = stock.find(s => s.productoId === form.productoId);

  const filtrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let base = filtro === "TODOS" ? stock : stock.filter(s => s.categoria === filtro);
    if (q) {
      base = base.filter(s =>
        s.nombre.toLowerCase().includes(q) ||
        s.enfermedad.toLowerCase().includes(q) ||
        (s.codigo ?? "").toLowerCase().includes(q),
      );
    }
    return [...base].sort((a, b) => Number(b.alertaStock) - Number(a.alertaStock));
  }, [stock, filtro, busqueda]);

  const criticos = useMemo(() => stock.filter(s => s.alertaStock).sort((a, b) => (a.diasHastaAgotamiento ?? 999) - (b.diasHastaAgotamiento ?? 999)), [stock]);
  const valorTotal = useMemo(() => stock.reduce((s, p) => s + p.valorInvertido, 0), [stock]);
  const movimientosSemana = useMemo(() => {
    const hace7 = Date.now() - 7 * 86400000;
    return movimientos.filter(m => new Date(m.fecha).getTime() >= hace7).length;
  }, [movimientos]);

  function iniciarCompra(productoId: string) {
    setTab("inventario");
    setForm(f => ({ ...f, productoId }));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
  }

  async function submitCompra(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (!form.productoId || !form.cantidad || !form.numeroLote) {
      setErr("Elegí un producto, cantidad y número de lote"); return;
    }
    setSaving(true);
    const res = await fetch("/api/logistica/compras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form, cantidad: Number(form.cantidad),
        costoUnitario: form.costoUnitario ? Number(form.costoUnitario) : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setForm(EMPTY_FORM);
      showMsg("Compra registrada — stock actualizado");
      load();
    } else {
      const d = await res.json();
      setErr(d.error ?? "Error al registrar la compra");
    }
  }

  if (status === "loading" || !session) return null;

  return (
    <>
      <Topbar
        title="Logística"
        icon={IconTruck}
        iconColor="var(--text-secondary)"
        tabs={[{ key: "inventario", label: "Inventario" }, { key: "movimientos", label: "Movimientos" }, { key: "analisis", label: "Central de análisis" }]}
        activeTab={tab}
        onTabChange={(k) => setTab(k as "inventario" | "movimientos" | "analisis")}
      />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {msg && <div className="kp-alert kp-alert-ok"><IconCheck size={13} /> {msg}</div>}
        {err && <div className="kp-alert kp-alert-danger"><IconAlertTriangle size={13} /> {err}</div>}

        {/* ── KPI strip — siempre visible, es el resumen para mostrar en reunión ── */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <KpiCard label="Total de productos" value={String(stock.length)} color="var(--text-primary)" />
          <KpiCard
            label="Productos críticos"
            value={String(criticos.length)}
            color={criticos.length > 0 ? "var(--danger)" : "var(--success)"}
            onClick={() => setMostrarCriticos(v => !v)}
            active={mostrarCriticos}
          />
          <KpiCard label="Valor invertido en stock" value={fmtGs(valorTotal)} color="var(--warning)" />
          <KpiCard label="Movimientos esta semana" value={String(movimientosSemana)} color="var(--info)" />
        </div>

        {/* ── Detalle de críticos — se abre al clickear el KPI ─────────────── */}
        {mostrarCriticos && (
          <div style={{ background: "var(--danger-subtle)", border: "0.5px solid var(--danger-border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            <div style={{ padding: "9px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "0.5px solid var(--danger-border)" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--danger-text)", display: "flex", alignItems: "center", gap: 6 }}>
                <IconAlertCircle size={13} /> Qué falta, cuánto falta y cuántos días quedan
              </span>
              <button onClick={() => setMostrarCriticos(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger-text)", display: "flex" }}>
                <IconX size={14} />
              </button>
            </div>
            {criticos.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "var(--success)" }}>Sin productos críticos ahora mismo. ✓</div>
            ) : (
              <table className="kp-table">
                <thead>
                  <tr>
                    <th>Producto</th><th>Categoría</th>
                    <th style={{ textAlign: "right" }}>Stock</th>
                    <th style={{ textAlign: "right" }}>Falta</th>
                    <th style={{ textAlign: "right" }}>Días</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {criticos.map(c => {
                    const dias = c.diasHastaAgotamiento;
                    const diasColor = dias == null ? "var(--text-muted)" : dias < 3 ? "var(--danger)" : dias < 7 ? "var(--warning)" : "var(--success)";
                    return (
                      <tr key={c.productoId}>
                        <td style={{ fontWeight: 500 }}>{c.codigo && `${c.codigo} — `}{c.nombre}</td>
                        <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{CATEGORIA_LABEL[c.categoria] ?? c.categoria}</td>
                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.stockNoVencido} {UNIDAD_LABEL[c.unidadMedida] ?? ""}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: "var(--danger)", fontVariantNumeric: "tabular-nums" }}>{Math.round(c.faltante)}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, color: diasColor, fontVariantNumeric: "tabular-nums" }}>{dias ?? "—"}</td>
                        <td style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          {canEdit && (
                            <button className="btn btn-primary" style={{ height: 24, fontSize: 10, padding: "0 8px" }} onClick={() => iniciarCompra(c.productoId)}>
                              Comprar
                            </button>
                          )}
                          <a href={`/marketplace?categoria=${CATEGORIA_A_MARKETPLACE[c.categoria] ?? "OTRO"}&q=${encodeURIComponent(c.nombre)}`} className="btn" style={{ height: 24, fontSize: 10, padding: "0 8px", textDecoration: "none" }}>
                            <IconExternalLink size={10} /> Mercado
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <IconLoader2 size={24} style={{ color: "var(--text-muted)", animation: "spin 1s linear infinite" }} />
          </div>
        ) : tab === "analisis" ? (
          <CentralAnalisisLogistica onComprar={iniciarCompra} stock={stock} />
        ) : tab === "inventario" ? (
          <>
            {canEdit && (
              <form ref={formRef} onSubmit={submitCompra} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 10 }}>Registrar compra</div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, alignItems: "end", marginBottom: 10 }}>
                  <div>
                    <label className="kp-label">Producto *</label>
                    <select className="kp-input" style={{ appearance: "auto" }} value={form.productoId} onChange={e => setForm(f => ({ ...f, productoId: e.target.value }))}>
                      <option value="">— Seleccionar —</option>
                      {stock.map(s => <option key={s.productoId} value={s.productoId}>{s.codigo ? `${s.codigo} — ` : ""}{s.nombre} ({CATEGORIA_LABEL[s.categoria]})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="kp-label">Cantidad{productoSeleccionado ? ` (${UNIDAD_LABEL[productoSeleccionado.unidadMedida] ?? "u."})` : ""} *</label>
                    <input type="number" min="1" step="1" className="kp-input" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} />
                  </div>
                  <div>
                    <label className="kp-label">N° de lote *</label>
                    <input className="kp-input" value={form.numeroLote} onChange={e => setForm(f => ({ ...f, numeroLote: e.target.value }))} />
                  </div>
                  <div>
                    <label className="kp-label">Vencimiento</label>
                    <input type="date" className="kp-input" value={form.fechaVencimiento} onChange={e => setForm(f => ({ ...f, fechaVencimiento: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10, alignItems: "end" }}>
                  <div>
                    <label className="kp-label">Proveedor</label>
                    <input className="kp-input" value={form.proveedor} onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))} />
                  </div>
                  <div>
                    <label className="kp-label">Costo unitario (₲)</label>
                    <input type="number" min="0" step="1" className="kp-input" placeholder={productoSeleccionado ? `por ${UNIDAD_LABEL[productoSeleccionado.unidadMedida] ?? "unidad"}` : "opcional"} value={form.costoUnitario} onChange={e => setForm(f => ({ ...f, costoUnitario: e.target.value }))} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: 32, fontSize: 12 }}>
                      {saving ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <IconPlus size={13} />}
                      {saving ? "Registrando…" : "Registrar compra"}
                    </button>
                  </div>
                </div>


                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 10.5, color: "var(--text-muted)", cursor: "pointer" }}>¿En qué unidad cargo cada categoría?</summary>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                    {UNIDAD_POR_CATEGORIA.map(u => (
                      <span key={u.categoria} style={{ fontSize: 10.5, color: "var(--text-muted)", background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)", borderRadius: 4, padding: "2px 8px" }}>
                        {u.categoria}: <strong style={{ color: "var(--text-secondary)" }}>{u.unidad}</strong>
                      </span>
                    ))}
                  </div>
                </details>
              </form>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 320 }}>
                <IconSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input
                  className="kp-input" placeholder="Buscar por nombre, enfermedad o código…"
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  style={{ paddingLeft: 28, fontSize: 12, height: 32 }}
                />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {FILTROS.map(f => (
                  <button key={f} onClick={() => setFiltro(f)} className="btn" style={{
                    fontSize: 11, height: 28, padding: "0 12px",
                    background: filtro === f ? "var(--accent)" : undefined,
                    color: filtro === f ? "#fff" : undefined,
                    border: filtro === f ? "0.5px solid var(--accent)" : undefined,
                  }}>
                    {f === "TODOS" ? `Todos (${stock.length})` : `${CATEGORIA_LABEL[f]} (${stock.filter(s => s.categoria === f).length})`}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
              {filtrado.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center" }}>
                  <IconPackage size={28} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 8px" }} />
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sin productos que coincidan con la búsqueda</div>
                </div>
              ) : filtrado.map(s => (
                <div key={s.productoId} style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                      {s.codigo && <span style={{ fontFamily: "monospace", fontSize: 10, color: "var(--accent)", background: "var(--accent-subtle)", border: "0.5px solid var(--accent-border)", borderRadius: 4, padding: "1px 5px" }}>{s.codigo}</span>}
                      {s.nombre}
                      {s.alertaStock && <span style={{ fontSize: 9, background: "var(--danger)", color: "#fff", borderRadius: 3, padding: "1px 4px" }}>CRÍTICO</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {CATEGORIA_LABEL[s.categoria] ?? s.categoria}
                      {s.demandaProyectada != null && s.demandaProyectada > 0 && ` · necesita ${s.demandaProyectada.toFixed(0)} en ${s.ventanaDias}d`}
                      {s.diasHastaAgotamiento != null && ` · ~${s.diasHastaAgotamiento}d de stock`}
                      {s.stockMinimo != null && ` · mínimo ${s.stockMinimo}`}
                      {s.costoUnitarioPromedio != null && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}> · <IconCoin size={10} /> {fmtGs(s.costoUnitarioPromedio)}/{UNIDAD_LABEL[s.unidadMedida] ?? "u."}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: s.alertaStock ? "var(--danger)" : "var(--success)" }}>
                      {s.stockNoVencido} <span style={{ fontSize: 10, fontWeight: 400, color: "var(--text-muted)" }}>{UNIDAD_LABEL[s.unidadMedida] ?? "u."}</span>
                    </div>
                    {s.valorInvertido > 0 && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{fmtGs(s.valorInvertido)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            {movimientos.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <IconHistory size={28} style={{ color: "var(--text-muted)", display: "block", margin: "0 auto 8px" }} />
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Sin movimientos registrados todavía</div>
              </div>
            ) : (
              <table className="kp-table">
                <thead>
                  <tr>
                    <th>Fecha</th><th>Producto</th><th>Tipo</th><th>Origen</th>
                    <th style={{ textAlign: "right" }}>Cantidad</th><th>Lote</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map(m => (
                    <tr key={m.id}>
                      <td style={{ fontSize: 11 }}>{new Date(m.fecha).toLocaleString("es-PY")}</td>
                      <td style={{ fontSize: 11 }}>{m.producto.codigo && `${m.producto.codigo} — `}{m.producto.nombre}</td>
                      <td><span style={{ fontSize: 10, fontWeight: 600, color: TIPO_COLOR[m.tipo] }}>{m.tipo}</span></td>
                      <td style={{ fontSize: 11 }}>{ORIGEN_LABEL[m.origen] ?? m.origen}</td>
                      <td style={{ textAlign: "right", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                        {m.tipo === "SALIDA" ? "-" : "+"}{m.cantidad} {UNIDAD_LABEL[m.producto.unidadMedida] ?? ""}
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{m.numeroLote ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </>
  );
}
