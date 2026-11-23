"use client";
// Finanzas · catálogos de costeo por etapa: etapas (centros de costo), categorías y subcategorías de gasto, ítems
// del inventario (subcategoría y etapa de consumo) y proyectos de inversión. Solo Administración edita; nada se borra.
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCheck, IconLoader2, IconPlus, IconX } from "@tabler/icons-react";
import { InputNumero } from "@/components/ui/input-numero";

type Etapa = { id: string; codigo: string; nombre: string; tipo: string; incluye: string; unidadCosteo: string; rolResponsable: string; activa: boolean };
type Sub = { id: string; codigo: string; nombre: string; modo: string; etapaRegla: string; etapaCodigo: string | null; notaControl: string | null; nombresAnteriores: string[]; activa: boolean };
type Cat = { id: string; codigo: string; nombre: string; activa: boolean; subcategorias: Sub[] };
type Item = { id: string; codigo: string | null; nombre: string; categoria: string; unidadMedida: string; subcategoriaGastoId: string | null; etapaConsumoCodigo: string | null };
type Proyecto = { id: string; nombre: string; granjaId: string | null; estado: string; presupuestoGs: string | null; fechaInicio: string; fechaFin: string | null; vidaUtilMeses: number | null; etapaCodigo: string | null; notas: string | null; activo: boolean };
type Datos = { etapas: Etapa[]; categorias: Cat[]; items: Item[]; proyectos: Proyecto[]; granjas: { id: string; nombre: string }[]; puedeEditar: boolean };

const TIPOS: Record<string, { t: string; color: string }> = {
  PRODUCTIVA: { t: "Productiva", color: "var(--success-subtle)" }, APOYO: { t: "Apoyo", color: "var(--info-subtle)" },
  ESTRUCTURA: { t: "Estructura", color: "var(--warning-subtle)" }, FINANCIERA: { t: "Financiero", color: "var(--bg-overlay)" },
  INVERSION: { t: "Inversión", color: "var(--accent-subtle)" }, PENDIENTE_REPARTO: { t: "Pendiente de reparto", color: "var(--danger-subtle)" },
};
const MODOS: Record<string, string> = { INVENTARIO: "Inventario (al consumirse)", DIRECTO: "Directo a la etapa", REPARTO: "Se reparte con regla", INVERSION: "Inversión (a proyecto)" };
const ESTADOS: Record<string, string> = { PLANIFICADO: "Planificado", EN_CURSO: "En curso", TERMINADO: "Terminado", CANCELADO: "Cancelado" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const etiqueta: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-secondary)", minWidth: 0 };
const gs = (v: string | null) => (v ? `₲ ${Number(v).toLocaleString("es-PY")}` : "—");

async function enviar(cuerpo: Record<string, unknown>): Promise<{ ok?: boolean; error?: string; aviso?: string }> {
  const r = await fetch("/api/finanzas/catalogos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
  return r.json().catch(() => ({ error: "No se pudo guardar." }));
}

export function PanelCatalogos() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [tab, setTab] = useState<"etapas" | "categorias" | "items" | "proyectos">("etapas");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const cargar = useCallback(() => {
    fetch("/api/finanzas/catalogos", { cache: "no-store" }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setDatos(j); })
      .catch((e: unknown) => setMsg({ ok: false, t: e instanceof Error ? e.message : "No se pudo cargar." }));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const guardar = async (cuerpo: Record<string, unknown>, okTxt = "Guardado") => {
    setMsg(null);
    const r = await enviar(cuerpo);
    if (r.error) { setMsg({ ok: false, t: r.error }); return false; }
    setMsg({ ok: true, t: r.aviso ?? okTxt }); cargar(); return true;
  };

  if (!datos) return <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>{msg ? <span style={{ color: "var(--danger-text)" }}>{msg.t}</span> : <><IconLoader2 size={15} className="animate-spin" /> Cargando…</>}</div>;
  const ed = datos.puedeEditar;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>Catálogos de costos</h2>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)", maxWidth: 720 }}>
            Cada gasto responde tres preguntas: <strong style={{ fontWeight: 500 }}>qué es</strong> (categoría y subcategoría), <strong style={{ fontWeight: 500 }}>dónde se consumió</strong> (etapa) y, si es inversión, <strong style={{ fontWeight: 500 }}>para qué proyecto</strong>.
            {!ed && " Solo Administración puede editarlos."}
          </p>
        </div>
        {ed && <button type="button" className="btn" onClick={() => guardar({ op: "sembrar" })}>Completar con el catálogo sugerido</button>}
      </div>
      {msg && <div role="status" className={msg.ok ? "kp-alert kp-alert-ok" : "kp-alert kp-alert-danger"} style={{ fontSize: 13 }}>{msg.t}</div>}
      <div role="tablist" style={{ display: "flex", gap: 2, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)", alignSelf: "flex-start", flexWrap: "wrap" }}>
        {([["etapas", `Etapas (${datos.etapas.length})`], ["categorias", "Categorías y subcategorías"], ["items", `Ítems del inventario (${datos.items.length})`], ["proyectos", `Proyectos (${datos.proyectos.length})`]] as const).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            style={{ fontSize: 12.5, padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: tab === k ? "var(--bg-surface)" : "transparent", color: tab === k ? "var(--text-primary)" : "var(--text-muted)", fontWeight: tab === k ? 500 : 400 }}>{t}</button>
        ))}
      </div>
      {tab === "etapas" && <Etapas datos={datos} ed={ed} guardar={guardar} />}
      {tab === "categorias" && <Categorias datos={datos} ed={ed} guardar={guardar} />}
      {tab === "items" && <Items datos={datos} ed={ed} guardar={guardar} />}
      {tab === "proyectos" && <Proyectos datos={datos} ed={ed} guardar={guardar} />}
    </div>
  );
}

type G = (c: Record<string, unknown>, ok?: string) => Promise<boolean>;

function Activa({ activa, onCambio, ed }: { activa: boolean; onCambio: (v: boolean) => void; ed: boolean }) {
  return (
    <button type="button" disabled={!ed} onClick={() => onCambio(!activa)} className={activa ? "badge badge-ok" : "badge"} style={{ cursor: ed ? "pointer" : "default", minHeight: 0, fontSize: 11 }}
      title={ed ? (activa ? "Desactivar (no se borra)" : "Activar") : undefined}>{activa ? "Activa" : "Inactiva"}</button>
  );
}

function Etapas({ datos, ed, guardar }: { datos: Datos; ed: boolean; guardar: G }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [f, setF] = useState<Partial<Etapa>>({});
  return (
    <section style={{ ...tarjeta, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 760 }}>
          <thead><tr><th>Código</th><th>Etapa</th><th>Tipo</th><th>Qué incluye</th><th>Unidad de costeo</th><th>Responsable</th><th>Estado</th>{ed && <th />}</tr></thead>
          <tbody>
            {datos.etapas.map(e => editando === e.id ? (
              <tr key={e.id}>
                <td><strong>{e.codigo}</strong></td>
                <td><input className="kp-input" value={f.nombre ?? ""} onChange={x => setF(v => ({ ...v, nombre: x.target.value }))} /></td>
                <td>{TIPOS[e.tipo]?.t}</td>
                <td><input className="kp-input" value={f.incluye ?? ""} onChange={x => setF(v => ({ ...v, incluye: x.target.value }))} /></td>
                <td><input className="kp-input" value={f.unidadCosteo ?? ""} onChange={x => setF(v => ({ ...v, unidadCosteo: x.target.value }))} /></td>
                <td><input className="kp-input" value={f.rolResponsable ?? ""} onChange={x => setF(v => ({ ...v, rolResponsable: x.target.value }))} /></td>
                <td />
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="btn btn-primary" onClick={async () => { if (await guardar({ op: "etapa", id: e.id, nombre: f.nombre, incluye: f.incluye, unidadCosteo: f.unidadCosteo, rolResponsable: f.rolResponsable, activa: e.activa })) setEditando(null); }}><IconCheck size={14} /></button>{" "}
                  <button type="button" className="btn" onClick={() => setEditando(null)}><IconX size={14} /></button>
                </td>
              </tr>
            ) : (
              <tr key={e.id} style={{ opacity: e.activa ? 1 : 0.55 }}>
                <td><strong>{e.codigo}</strong></td><td>{e.nombre}</td>
                <td><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: TIPOS[e.tipo]?.color, whiteSpace: "nowrap" }}>{TIPOS[e.tipo]?.t ?? e.tipo}</span></td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "normal", minWidth: 220 }}>{e.incluye}</td>
                <td style={{ fontSize: 12 }}>{e.unidadCosteo}</td><td style={{ fontSize: 12 }}>{e.rolResponsable}</td>
                <td><Activa activa={e.activa} ed={ed && e.codigo !== "CMP"} onCambio={v => guardar({ op: "etapa", id: e.id, nombre: e.nombre, incluye: e.incluye, unidadCosteo: e.unidadCosteo, rolResponsable: e.rolResponsable, activa: v })} /></td>
                {ed && <td><button type="button" className="btn" onClick={() => { setEditando(e.id); setF(e); }}>Editar</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: 0, padding: "8px 14px", fontSize: 11.5, color: "var(--text-muted)", borderTop: "0.5px solid var(--border-default)" }}>
        «Compartido a repartir» (CMP) es transitoria: ningún gasto puede quedar ahí al cerrar el mes. Logística no tiene etapa propia: los fletes van a la etapa del animal o insumo transportado.
      </p>
    </section>
  );
}

function Categorias({ datos, ed, guardar }: { datos: Datos; ed: boolean; guardar: G }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [f, setF] = useState<Partial<Sub> & { categoriaId?: string }>({});
  const [nueva, setNueva] = useState<string | null>(null);
  const etapas = datos.etapas.filter(e => e.activa);
  const fila = (s: Partial<Sub> & { categoriaId?: string }, alGuardar: () => Promise<boolean>, cancelar: () => void, conCodigo: boolean) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8, padding: 10, background: "var(--bg-elevated)", borderRadius: "var(--radius-md)" }}>
      {conCodigo && <label style={etiqueta}>Código<input className="kp-input" value={s.codigo ?? ""} onChange={x => setF(v => ({ ...v, codigo: x.target.value.toUpperCase() }))} placeholder="ALI-02" /></label>}
      <label style={etiqueta}>Subcategoría<input className="kp-input" value={s.nombre ?? ""} onChange={x => setF(v => ({ ...v, nombre: x.target.value }))} /></label>
      <label style={etiqueta}>Modo<select className="kp-input" value={s.modo ?? "DIRECTO"} onChange={x => setF(v => ({ ...v, modo: x.target.value }))}>{Object.entries(MODOS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
      <label style={etiqueta}>Etapa por defecto<select className="kp-input" value={s.etapaCodigo ?? ""} onChange={x => setF(v => ({ ...v, etapaCodigo: x.target.value || null }))}><option value="">— según el caso —</option>{etapas.map(e => <option key={e.codigo} value={e.codigo}>{e.codigo} · {e.nombre}</option>)}</select></label>
      <label style={{ ...etiqueta, gridColumn: "1 / -1" }}>Cómo se imputa<input className="kp-input" value={s.etapaRegla ?? ""} onChange={x => setF(v => ({ ...v, etapaRegla: x.target.value }))} /></label>
      <div style={{ display: "flex", gap: 6, gridColumn: "1 / -1" }}>
        <button type="button" className="btn btn-primary" onClick={async () => { if (await alGuardar()) cancelar(); }}><IconCheck size={14} /> Guardar</button>
        <button type="button" className="btn" onClick={cancelar}>Cancelar</button>
      </div>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {datos.categorias.map(c => (
        <section key={c.id} style={{ ...tarjeta, overflow: "hidden", opacity: c.activa ? 1 : 0.6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "var(--bg-elevated)", borderBottom: "0.5px solid var(--border-default)", flexWrap: "wrap" }}>
            <strong style={{ fontWeight: 500, fontSize: 13.5 }}>{c.codigo} · {c.nombre}</strong>
            <Activa activa={c.activa} ed={ed} onCambio={v => guardar({ op: "categoria", id: c.id, nombre: c.nombre, activa: v })} />
            {ed && <button type="button" className="btn" style={{ marginLeft: "auto", fontSize: 12 }} onClick={() => { setNueva(c.id); setF({ categoriaId: c.id, codigo: `${c.codigo}-`, modo: "DIRECTO" }); }}><IconPlus size={13} /> Subcategoría</button>}
          </div>
          <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {nueva === c.id && fila(f, () => guardar({ op: "subcategoria", categoriaId: c.id, codigo: f.codigo, nombre: f.nombre, modo: f.modo, etapaRegla: f.etapaRegla ?? "", etapaCodigo: f.etapaCodigo ?? null }), () => setNueva(null), true)}
            {c.subcategorias.map(s => editando === s.id ? <div key={s.id}>{fila(f, () => guardar({ op: "subcategoria", id: s.id, nombre: f.nombre, modo: f.modo, etapaRegla: f.etapaRegla ?? "", etapaCodigo: f.etapaCodigo ?? null, notaControl: s.notaControl, activa: s.activa }), () => setEditando(null), false)}</div> : (
              <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "6px 8px", borderRadius: "var(--radius-md)", opacity: s.activa ? 1 : 0.55 }}>
                <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500, minWidth: 56 }}>{s.codigo}</span>
                <span style={{ flex: "1 1 220px", minWidth: 0 }}>{s.nombre}
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>{MODOS[s.modo]} · {s.etapaRegla}{s.etapaCodigo ? ` (${s.etapaCodigo})` : ""}{s.nombresAnteriores.length ? ` · antes: ${s.nombresAnteriores.join(", ")}` : ""}</span>
                </span>
                <Activa activa={s.activa} ed={ed} onCambio={v => guardar({ op: "subcategoria", id: s.id, nombre: s.nombre, modo: s.modo, etapaRegla: s.etapaRegla, etapaCodigo: s.etapaCodigo, notaControl: s.notaControl, activa: v })} />
                {ed && <button type="button" className="btn" style={{ fontSize: 12 }} onClick={() => { setEditando(s.id); setF(s); }}>Editar</button>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Items({ datos, ed, guardar }: { datos: Datos; ed: boolean; guardar: G }) {
  const subs = useMemo(() => datos.categorias.flatMap(c => c.subcategorias.filter(s => s.activa && s.modo === "INVENTARIO").map(s => ({ ...s, cat: c.nombre }))), [datos]);
  const etapas = datos.etapas.filter(e => e.activa && e.tipo !== "INVERSION" && e.tipo !== "FINANCIERA");
  return (
    <section style={{ ...tarjeta, overflow: "hidden" }}>
      <p style={{ margin: 0, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", borderBottom: "0.5px solid var(--border-default)" }}>
        Lo que se almacena entra al inventario y recién se imputa a una etapa cuando se consume. Acá se define su subcategoría y la etapa que se propone al darle salida.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 640 }}>
          <thead><tr><th>Código</th><th>Ítem</th><th>Unidad</th><th>Subcategoría</th><th>Etapa de consumo</th></tr></thead>
          <tbody>
            {datos.items.map(i => (
              <tr key={i.id}>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{i.codigo ?? "—"}</td><td>{i.nombre}</td><td style={{ fontSize: 12 }}>{i.unidadMedida.toLowerCase()}</td>
                <td>{ed ? <select className="kp-input" value={i.subcategoriaGastoId ?? ""} onChange={e => guardar({ op: "item", id: i.id, subcategoriaGastoId: e.target.value || null, etapaConsumoCodigo: i.etapaConsumoCodigo })} style={{ minWidth: 200 }}>
                  <option value="">— sin asignar —</option>{subs.map(s => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}</select>
                  : (subs.find(s => s.id === i.subcategoriaGastoId)?.codigo ?? "—")}</td>
                <td>{ed ? <select className="kp-input" value={i.etapaConsumoCodigo ?? ""} onChange={e => guardar({ op: "item", id: i.id, subcategoriaGastoId: i.subcategoriaGastoId, etapaConsumoCodigo: e.target.value || null })} style={{ minWidth: 170 }}>
                  <option value="">La etapa donde se usa</option>{etapas.map(e => <option key={e.codigo} value={e.codigo}>{e.codigo} · {e.nombre}</option>)}</select>
                  : (i.etapaConsumoCodigo ?? "La etapa donde se usa")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Proyectos({ datos, ed, guardar }: { datos: Datos; ed: boolean; guardar: G }) {
  const vacio = { nombre: "", granjaId: datos.granjas[0]?.id ?? "", estado: "PLANIFICADO", presupuestoGs: "", fechaInicio: new Date().toISOString().slice(0, 10), fechaFin: "", vidaUtilMeses: "", etapaCodigo: "", notas: "" };
  const [f, setF] = useState<typeof vacio & { id?: string; activo?: boolean }>(vacio);
  const [abierto, setAbierto] = useState(false);
  const etapas = datos.etapas.filter(e => e.activa && e.tipo !== "FINANCIERA");
  const guardarP = async () => {
    const ok = await guardar({ op: "proyecto", id: f.id, nombre: f.nombre, granjaId: f.granjaId || null, estado: f.estado, presupuestoGs: f.presupuestoGs || null,
      fechaInicio: f.fechaInicio, fechaFin: f.fechaFin || null, vidaUtilMeses: f.vidaUtilMeses ? Number(f.vidaUtilMeses) : null, etapaCodigo: f.etapaCodigo || null, notas: f.notas || null, activo: f.activo ?? true });
    if (ok) { setAbierto(false); setF(vacio); }
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>Las inversiones van a un proyecto: no entran al costo del mes y se deprecian según su vida útil (Fase 8).</p>
      {ed && !abierto && <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => { setF(vacio); setAbierto(true); }}><IconPlus size={14} /> Nuevo proyecto</button>}
      {abierto && (
        <section style={{ ...tarjeta, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          <label style={{ ...etiqueta, gridColumn: "1 / -1" }}>Proyecto<input className="kp-input" value={f.nombre} onChange={e => setF(v => ({ ...v, nombre: e.target.value }))} placeholder="Ej.: Ampliación de maternidad" /></label>
          <label style={etiqueta}>Granja<select className="kp-input" value={f.granjaId} onChange={e => setF(v => ({ ...v, granjaId: e.target.value }))}>{datos.granjas.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}</select></label>
          <label style={etiqueta}>Estado<select className="kp-input" value={f.estado} onChange={e => setF(v => ({ ...v, estado: e.target.value }))}>{Object.entries(ESTADOS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
          <label style={etiqueta}>Presupuesto (₲)<InputNumero className="kp-input" inputMode="numeric" value={f.presupuestoGs} onChange={e => setF(v => ({ ...v, presupuestoGs: e.target.value }))} /></label>
          <label style={etiqueta}>Inicio<input type="date" className="kp-input" value={f.fechaInicio} onChange={e => setF(v => ({ ...v, fechaInicio: e.target.value }))} /></label>
          <label style={etiqueta}>Fin (opcional)<input type="date" className="kp-input" value={f.fechaFin} onChange={e => setF(v => ({ ...v, fechaFin: e.target.value }))} /></label>
          <label style={etiqueta}>Vida útil (meses)<InputNumero className="kp-input" inputMode="numeric" value={f.vidaUtilMeses} onChange={e => setF(v => ({ ...v, vidaUtilMeses: e.target.value }))} placeholder="Ej.: 120" /></label>
          <label style={etiqueta}>Etapa donde se usa<select className="kp-input" value={f.etapaCodigo} onChange={e => setF(v => ({ ...v, etapaCodigo: e.target.value }))}><option value="">—</option>{etapas.map(e => <option key={e.codigo} value={e.codigo}>{e.codigo} · {e.nombre}</option>)}</select></label>
          <label style={{ ...etiqueta, gridColumn: "1 / -1" }}>Notas<input className="kp-input" value={f.notas} onChange={e => setF(v => ({ ...v, notas: e.target.value }))} /></label>
          <div style={{ display: "flex", gap: 6, gridColumn: "1 / -1" }}>
            <button type="button" className="btn btn-primary" onClick={guardarP}><IconCheck size={14} /> Guardar proyecto</button>
            <button type="button" className="btn" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </section>
      )}
      {datos.proyectos.length === 0 ? <div style={{ ...tarjeta, padding: 14, fontSize: 13, color: "var(--text-muted)" }}>Todavía no hay proyectos.</div> : (
        <section style={{ ...tarjeta, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="kp-table" style={{ minWidth: 640 }}>
              <thead><tr><th>Proyecto</th><th>Estado</th><th style={{ textAlign: "right" }}>Presupuesto</th><th>Inicio</th><th>Vida útil</th><th>Etapa</th>{ed && <th />}</tr></thead>
              <tbody>{datos.proyectos.map(p => (
                <tr key={p.id} style={{ opacity: p.activo ? 1 : 0.55 }}>
                  <td>{p.nombre}</td><td>{ESTADOS[p.estado] ?? p.estado}</td><td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(p.presupuestoGs)}</td>
                  <td>{p.fechaInicio.split("-").reverse().join("/")}</td><td>{p.vidaUtilMeses ? `${p.vidaUtilMeses} meses` : "—"}</td><td>{p.etapaCodigo ?? "—"}</td>
                  {ed && <td><button type="button" className="btn" onClick={() => { setF({ id: p.id, activo: p.activo, nombre: p.nombre, granjaId: p.granjaId ?? "", estado: p.estado, presupuestoGs: p.presupuestoGs ?? "", fechaInicio: p.fechaInicio, fechaFin: p.fechaFin ?? "", vidaUtilMeses: p.vidaUtilMeses ? String(p.vidaUtilMeses) : "", etapaCodigo: p.etapaCodigo ?? "", notas: p.notas ?? "" }); setAbierto(true); }}>Editar</button></td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
