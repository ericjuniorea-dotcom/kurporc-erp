"use client";
// Finanzas · Revisión de la clasificación (costeo por etapa, Fase 2). Lista paginada de gastos e inversiones con
// qué son (subcategoría) y dónde se consumieron (etapa) o para qué proyecto. Se eligen varios y se les asigna lo mismo.
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconAlertTriangle, IconCheck, IconLoader2, IconSearch } from "@tabler/icons-react";
import { Paginador, usePaginas } from "@/components/ui/paginador";

type Mov = { id: string; fecha: string; tipo: string; concepto: string; montoGs: string; subcategoriaGastoId: string | null; etapaCodigo: string | null;
  proyectoId: string | null; revisionPendiente: boolean; motivoRevision: string | null; categoriaAnterior: string; division: { etapaCodigo: string; porcentaje: number }[] };
type Sub = { id: string; codigo: string; nombre: string; modo: string; etapaCodigo: string | null; activa: boolean };
type Etapa = { codigo: string; nombre: string; tipo: string; activa: boolean };
type Datos = { movimientos: Mov[]; sinClasificar: number; subcategorias: Sub[]; etapas: Etapa[]; proyectos: { id: string; nombre: string; activo: boolean }[]; puedeEditar: boolean };
type Vista = "revisar" | "todos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const etiqueta: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-secondary)", minWidth: 0, flex: "1 1 180px" };
const gs = (v: string) => `₲ ${Number(v).toLocaleString("es-PY")}`;
const fechaCorta = (f: string) => { const [a, m, d] = f.split("-"); return `${d}/${m}/${a}`; };

export function PanelClasificacion() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [vista, setVista] = useState<Vista>("revisar");
  const [buscar, setBuscar] = useState("");
  const [anterior, setAnterior] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sub, setSub] = useState("");
  const [etapa, setEtapa] = useState("");
  const [proyecto, setProyecto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(() => {
    fetch("/api/finanzas/clasificacion", { cache: "no-store" }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setDatos(j); })
      .catch((e: unknown) => setMsg({ ok: false, t: e instanceof Error ? e.message : "No se pudo cargar." }));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const subs = useMemo(() => new Map((datos?.subcategorias ?? []).map(s => [s.id, s])), [datos]);
  const etapas = useMemo(() => new Map((datos?.etapas ?? []).map(e => [e.codigo, e])), [datos]);
  const proyectos = useMemo(() => new Map((datos?.proyectos ?? []).map(p => [p.id, p])), [datos]);
  const anteriores = useMemo(() => [...new Set((datos?.movimientos ?? []).map(m => m.categoriaAnterior))].sort((a, b) => a.localeCompare(b, "es")), [datos]);
  const porRevisar = (m: Mov) => m.revisionPendiente || !m.subcategoriaGastoId;
  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return (datos?.movimientos ?? []).filter(m => (vista === "todos" || porRevisar(m)) && (!anterior || m.categoriaAnterior === anterior)
      && (!q || m.concepto.toLowerCase().includes(q) || m.categoriaAnterior.toLowerCase().includes(q)));
  }, [datos, vista, anterior, buscar]);
  const pag = usePaginas(lista, 10);
  const nRevisar = (datos?.movimientos ?? []).filter(porRevisar).length;

  const subElegida = subs.get(sub);
  const necesitaEtapa = subElegida && (subElegida.modo === "DIRECTO" || subElegida.modo === "REPARTO");
  useEffect(() => { if (subElegida) { setEtapa(subElegida.modo === "DIRECTO" || subElegida.modo === "REPARTO" ? (subElegida.etapaCodigo ?? "") : ""); } }, [subElegida]);

  const enviar = async (cuerpo: Record<string, unknown>) => {
    setEnviando(true); setMsg(null);
    try {
      const r = await fetch("/api/finanzas/clasificacion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(cuerpo) });
      const j = await r.json().catch(() => ({ error: "No se pudo guardar." }));
      if (!r.ok || j.error) { setMsg({ ok: false, t: j.error ?? "No se pudo guardar." }); return; }
      setMsg({ ok: true, t: j.aviso ?? "Guardado" }); setSel(new Set()); cargar();
    } finally { setEnviando(false); }
  };

  if (!datos) return <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}>{msg ? <span style={{ color: "var(--danger-text)" }}>{msg.t}</span> : <><IconLoader2 size={15} className="animate-spin" /> Cargando…</>}</div>;
  const ed = datos.puedeEditar;
  const todosPagina = pag.visibles.length > 0 && pag.visibles.every(m => sel.has(m.id));
  const alternar = (id: string) => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>Revisión de la clasificación</h2>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)", maxWidth: 720 }}>
          Cada gasto dice <strong style={{ fontWeight: 500 }}>qué es</strong> y <strong style={{ fontWeight: 500 }}>en qué etapa se consumió</strong>; cada inversión, <strong style={{ fontWeight: 500 }}>a qué proyecto va</strong>.
          La categoría anterior se conserva. Elegí uno o varios y asignales la clasificación.
        </p>
      </div>

      {msg && <div role="status" style={{ fontSize: 13, padding: "8px 12px", borderRadius: "var(--radius-md)", background: msg.ok ? "var(--success-subtle)" : "var(--danger-subtle)", color: msg.ok ? "var(--success-text)" : "var(--danger-text)" }}>{msg.t}</div>}

      {ed && datos.sinClasificar > 0 && (
        <div style={{ ...tarjeta, padding: 14, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Hay <strong style={{ fontWeight: 500 }}>{datos.sinClasificar.toLocaleString("es-PY")}</strong> gastos o inversiones sin clasificar. Se les puede asignar la clasificación sugerida según su categoría anterior.
          </span>
          <button type="button" className="btn btn-primary" disabled={enviando} onClick={() => enviar({ op: "migrar" })}>Clasificar con la sugerencia</button>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {([["revisar", `Para revisar (${nRevisar.toLocaleString("es-PY")})`], ["todos", `Todos (${datos.movimientos.length.toLocaleString("es-PY")})`]] as [Vista, string][]).map(([v, t]) => (
          <button key={v} type="button" onClick={() => { setVista(v); pag.setPagina(0); }} className="btn"
            style={{ background: vista === v ? "var(--accent-subtle)" : undefined, borderColor: vista === v ? "var(--accent)" : undefined, color: vista === v ? "var(--accent-text)" : undefined }}>{t}</button>
        ))}
        <select value={anterior} onChange={e => { setAnterior(e.target.value); pag.setPagina(0); }} style={{ flex: "1 1 160px", maxWidth: 260 }} aria-label="Categoría anterior">
          <option value="">Todas las categorías anteriores</option>
          {anteriores.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <label style={{ position: "relative", flex: "1 1 160px", maxWidth: 260 }}>
          <IconSearch size={14} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} aria-hidden />
          <input value={buscar} onChange={e => { setBuscar(e.target.value); pag.setPagina(0); }} placeholder="Buscar concepto" style={{ width: "100%", paddingLeft: 28 }} />
        </label>
      </div>

      {/* Asignar a los elegidos */}
      {ed && (
        <div style={{ ...tarjeta, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>Asignar a {sel.size.toLocaleString("es-PY")} {sel.size === 1 ? "elegido" : "elegidos"}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={etiqueta}>Subcategoría (qué es)
              <select value={sub} onChange={e => setSub(e.target.value)}>
                <option value="">Elegí…</option>
                {datos.subcategorias.filter(s => s.activa).map(s => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}
              </select>
            </label>
            {necesitaEtapa && (
              <label style={etiqueta}>Etapa (dónde se consumió)
                <select value={etapa} onChange={e => setEtapa(e.target.value)}>
                  <option value="">Elegí…</option>
                  {datos.etapas.filter(e => e.activa && e.codigo !== "INV").map(e => <option key={e.codigo} value={e.codigo}>{e.nombre}</option>)}
                </select>
              </label>
            )}
            {subElegida?.modo === "INVERSION" && (
              <label style={etiqueta}>Proyecto
                <select value={proyecto} onChange={e => setProyecto(e.target.value)}>
                  <option value="">Elegí…</option>
                  {datos.proyectos.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
            )}
            {subElegida?.modo === "INVENTARIO" && <span style={{ fontSize: 12, color: "var(--text-muted)", flex: "1 1 180px" }}>Va al inventario: el costo lo toma la etapa que lo consume.</span>}
            <button type="button" className="btn btn-primary" style={{ flex: "0 0 auto" }}
              disabled={enviando || sel.size === 0 || !sub || (necesitaEtapa && !etapa) || (subElegida?.modo === "INVERSION" && !proyecto)}
              onClick={() => enviar({ op: "asignar", ids: [...sel], subcategoriaGastoId: sub, etapaCodigo: necesitaEtapa ? etapa : null, proyectoId: subElegida?.modo === "INVERSION" ? proyecto : null })}>
              {enviando ? <IconLoader2 size={14} className="animate-spin" /> : <IconCheck size={14} />} Aplicar
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={{ ...tarjeta, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {ed && pag.visibles.length > 0 && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", borderBottom: "0.5px solid var(--border-default)", cursor: "pointer" }}>
            <input type="checkbox" checked={todosPagina} onChange={() => setSel(s => { const n = new Set(s); pag.visibles.forEach(m => todosPagina ? n.delete(m.id) : n.add(m.id)); return n; })} />
            Elegir los de esta página
            {sel.size > 0 && <button type="button" onClick={e => { e.preventDefault(); setSel(new Set()); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--accent-text)", fontSize: 12, cursor: "pointer" }}>Quitar selección</button>}
          </label>
        )}
        {pag.visibles.length === 0 && <div style={{ padding: 18, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>{vista === "revisar" ? "No hay nada para revisar. Todo está clasificado." : "No hay movimientos con ese filtro."}</div>}
        {pag.visibles.map(m => {
          const s = m.subcategoriaGastoId ? subs.get(m.subcategoriaGastoId) : null;
          const destino = s?.modo === "INVENTARIO" ? (m.etapaCodigo ? `${etapas.get(m.etapaCodigo)?.nombre ?? m.etapaCodigo} (vía inventario)` : "Inventario") : s?.modo === "INVERSION" ? (m.proyectoId ? proyectos.get(m.proyectoId)?.nombre ?? "Proyecto" : "Sin proyecto")
            : m.division.length ? `Dividido: ${m.division.map(x => `${etapas.get(x.etapaCodigo)?.nombre ?? x.etapaCodigo} ${x.porcentaje.toLocaleString("es-PY")} %`).join(" · ")}`
            : m.etapaCodigo ? (m.etapaCodigo === "CMP" ? "A repartir al cerrar el mes" : etapas.get(m.etapaCodigo)?.nombre ?? m.etapaCodigo) : "Sin etapa";
          return (
            <label key={m.id} style={{ display: "flex", gap: 10, padding: "12px 14px", borderBottom: "0.5px solid var(--border-default)", cursor: ed ? "pointer" : "default",
              background: sel.has(m.id) ? "var(--accent-subtle)" : undefined }}>
              {ed && <input type="checkbox" checked={sel.has(m.id)} onChange={() => alternar(m.id)} style={{ marginTop: 3, flex: "0 0 auto" }} />}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.concepto}</span>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{gs(m.montoGs)}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span>{fechaCorta(m.fecha)}</span><span>·</span><span>Antes: {m.categoriaAnterior}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {s ? <span style={{ padding: "1px 7px", borderRadius: 999, background: "var(--bg-overlay)" }}>{s.codigo} · {s.nombre}</span> : <span style={{ color: "var(--warning-text)" }}>Sin clasificar</span>}
                  {s && <span>→ {destino}</span>}
                </div>
                {m.revisionPendiente && (
                  <div style={{ fontSize: 11.5, color: "var(--warning-text)", display: "flex", gap: 5, alignItems: "center" }}>
                    <IconAlertTriangle size={13} aria-hidden /> {m.motivoRevision ?? "Pendiente de revisión"}
                  </div>
                )}
              </div>
            </label>
          );
        })}
        <Paginador {...pag} />
      </div>
    </div>
  );
}
