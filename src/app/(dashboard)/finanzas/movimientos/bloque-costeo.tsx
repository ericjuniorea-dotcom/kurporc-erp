"use client";
// Cargar movimiento · costeo por etapa (Fase 3): subcategoría (qué es), etapa (dónde se consumió) o «Dividir entre
// etapas» con porcentajes que suman 100 %, y proyecto si es inversión. Se precarga según la categoría elegida.
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { InputNumero } from "@/components/ui/input-numero";

export type SubCosteo = { id: string; codigo: string; nombre: string; modo: string; etapaCodigo: string | null; nombresAnteriores: string[]; categoria: string };
export type CatalogoCosteo = { subcategorias: SubCosteo[]; etapas: { codigo: string; nombre: string }[]; proyectos: { id: string; nombre: string }[];
  compras: { id: string; texto: string }[] }; // compras recientes que entraron al inventario (para el flete)
export type ValorCosteo = { subId: string; etapa: string; proyectoId: string; dividir: boolean; filas: { etapa: string; pct: string }[]; fleteDe?: string };

export const COSTEO_VACIO: ValorCosteo = { subId: "", etapa: "", proyectoId: "", dividir: false, filas: [] };
const num = (v: string) => Number((v || "0").replace(",", "."));
export const sumaDivision = (filas: ValorCosteo["filas"]) => Math.round(filas.reduce((s, f) => s + num(f.pct), 0) * 100) / 100;

/** Lo que va al servidor. */
export function costeoParaGuardar(v: ValorCosteo) {
  return {
    subcategoriaGastoId: v.subId, etapaCodigo: v.dividir || v.fleteDe ? "" : v.etapa, proyectoId: v.proyectoId, fleteRecepcionId: v.fleteDe ?? "",
    division: v.dividir ? v.filas.map(f => ({ etapaCodigo: f.etapa, porcentaje: num(f.pct) })) : [],
  };
}

const kpLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: "1 1 180px" };

export function BloqueCosteo({ tipo, catalogo, valor, onCambio }: { tipo: string; catalogo: CatalogoCosteo; valor: ValorCosteo; onCambio: (v: ValorCosteo) => void }) {
  const set = (p: Partial<ValorCosteo>) => onCambio({ ...valor, ...p });
  const sub = catalogo.subcategorias.find(s => s.id === valor.subId);
  const opciones = catalogo.subcategorias.filter(s => (tipo === "INVERSION") === (s.modo === "INVERSION"));
  const grupos = [...new Set(opciones.map(s => s.categoria))];
  const esFlete = sub?.codigo === "LOG-02";
  const conEtapa = sub && (sub.modo === "DIRECTO" || sub.modo === "REPARTO") && !(esFlete && valor.fleteDe);
  const suma = sumaDivision(valor.filas);
  const usadas = new Set(valor.filas.map(f => f.etapa));

  function elegirSub(id: string) {
    const s = catalogo.subcategorias.find(x => x.id === id);
    onCambio({ ...valor, subId: id, etapa: s && (s.modo === "DIRECTO" || s.modo === "REPARTO") ? (s.etapaCodigo ?? (s.modo === "REPARTO" ? "CMP" : "")) : "", dividir: false, filas: [], fleteDe: undefined });
  }
  function activarDivision() {
    const primera = valor.etapa && valor.etapa !== "CMP" ? valor.etapa : "";
    set({ dividir: true, filas: [{ etapa: primera, pct: "50" }, { etapa: "", pct: "50" }] });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, borderRadius: "var(--radius-md)", background: "var(--bg-base)", border: "0.5px solid var(--border-default)" }}>
      <div style={{ fontSize: 12.5, color: "var(--text-primary)", fontWeight: 500 }}>
        Costeo <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>· qué es y {tipo === "INVERSION" ? "a qué proyecto va" : "en qué etapa se consumió"}</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <label style={kpLabel}>
          <span className="kp-label">Subcategoría de costo</span>
          <select className="kp-input" value={valor.subId} onChange={e => elegirSub(e.target.value)} required>
            <option value="">Elegí…</option>
            {grupos.map(g => (
              <optgroup key={g} label={g}>{opciones.filter(s => s.categoria === g).map(s => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}</optgroup>
            ))}
          </select>
        </label>
        {sub?.modo === "INVERSION" && (
          <label style={kpLabel}>
            <span className="kp-label">Proyecto</span>
            <select className="kp-input" value={valor.proyectoId} onChange={e => set({ proyectoId: e.target.value })} required>
              <option value="">Elegí…</option>
              {catalogo.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
        )}
        {conEtapa && !valor.dividir && (
          <label style={kpLabel}>
            <span className="kp-label">Etapa</span>
            <select className="kp-input" value={valor.etapa} onChange={e => set({ etapa: e.target.value })} required>
              <option value="">Elegí…</option>
              {catalogo.etapas.map(x => <option key={x.codigo} value={x.codigo}>{x.codigo === "CMP" ? "A repartir al cerrar el mes" : x.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      {esFlete && (
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="kp-label">¿De qué compra es el flete?</span>
          <select className="kp-input" value={valor.fleteDe ?? ""} onChange={e => set({ fleteDe: e.target.value, etapa: e.target.value ? "" : valor.etapa, dividir: false, filas: [] })}>
            <option value="">No es de una compra (elegí la etapa)</option>
            {catalogo.compras.map(c => <option key={c.id} value={c.id}>{c.texto}</option>)}
          </select>
          {valor.fleteDe && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>El flete se suma al costo de ese producto en el inventario (y de ahí a la etapa que lo consume).</span>}
        </label>
      )}
      {sub?.modo === "INVENTARIO" && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Va al inventario: el costo pasa a la etapa recién cuando se consume (marcá «Entra al inventario»).</div>
      )}
      {sub?.modo === "INVERSION" && catalogo.proyectos.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--warning-text)" }}>Todavía no hay proyectos: crealo en Finanzas → Catálogos de costos → Proyectos.</div>
      )}

      {conEtapa && !valor.dividir && (
        <button type="button" onClick={activarDivision} style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: "var(--accent-text)", fontSize: 12.5, cursor: "pointer" }}>
          Dividir entre etapas
        </button>
      )}

      {conEtapa && valor.dividir && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {valor.filas.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select className="kp-input" style={{ flex: 1, minWidth: 0 }} value={f.etapa} aria-label={`Etapa ${i + 1}`}
                onChange={e => set({ filas: valor.filas.map((x, j) => j === i ? { ...x, etapa: e.target.value } : x) })} required>
                <option value="">Etapa…</option>
                {catalogo.etapas.filter(x => x.codigo !== "CMP" && (x.codigo === f.etapa || !usadas.has(x.codigo))).map(x => <option key={x.codigo} value={x.codigo}>{x.nombre}</option>)}
              </select>
              <div style={{ position: "relative", width: 92, flex: "0 0 auto" }}>
                <InputNumero className="kp-input" inputMode="decimal" value={f.pct} aria-label={`Porcentaje ${i + 1}`} style={{ paddingRight: 22, textAlign: "right" }}
                  onChange={e => set({ filas: valor.filas.map((x, j) => j === i ? { ...x, pct: e.target.value } : x) })} />
                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text-muted)" }}>%</span>
              </div>
              <button type="button" aria-label="Quitar etapa" disabled={valor.filas.length <= 2}
                onClick={() => set({ filas: valor.filas.filter((_, j) => j !== i) })}
                style={{ background: "none", border: "none", cursor: valor.filas.length <= 2 ? "default" : "pointer", color: "var(--text-muted)", opacity: valor.filas.length <= 2 ? 0.35 : 1, padding: 4 }}>
                <IconTrash size={15} />
              </button>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={() => set({ filas: [...valor.filas, { etapa: "", pct: "" }] })} disabled={valor.filas.length >= catalogo.etapas.length - 1}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, color: "var(--accent-text)", fontSize: 12.5, cursor: "pointer" }}>
                <IconPlus size={13} /> Agregar etapa
              </button>
              <button type="button" onClick={() => set({ dividir: false, filas: [] })}
                style={{ background: "none", border: "none", padding: 0, color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer" }}>
                No dividir
              </button>
            </div>
            <span role="status" style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", fontWeight: 500, color: suma === 100 ? "var(--success-text)" : "var(--danger-text)" }}>
              Suma {suma.toLocaleString("es-PY")} %{suma === 100 ? " ✓" : suma < 100 ? ` · faltan ${(Math.round((100 - suma) * 100) / 100).toLocaleString("es-PY")} %` : ` · sobran ${(Math.round((suma - 100) * 100) / 100).toLocaleString("es-PY")} %`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
