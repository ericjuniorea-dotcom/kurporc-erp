"use client";
// Finanzas · Costos por etapa (costeo por etapa, Fase 6). Indicadores de costo, costo de cada etapa por categoría
// (directo o con apoyo y estructura) y, al tocar una etapa, lo que la compone. Pensado para el celular.
import { useCallback, useEffect, useState } from "react";
import { IconAlertTriangle, IconChevronDown, IconChevronUp, IconLoader2 } from "@tabler/icons-react";
import { AyudaIndicador, ComoSeCalcula } from "@/components/indicadores/ayuda";
import { formatear, indicador, type ClaveIndicador } from "@/lib/indicadores/catalogo";

type Matriz = Record<string, Record<string, number>>;
type Datos = { desde: number; hasta: number; meses: number; etapas: { codigo: string; nombre: string; tipo: string }[]; categorias: { codigo: string; nombre: string }[];
  directo: Matriz; conApoyo: Matriz; indicadores: Record<ClaveIndicador, number | null>;
  bases: { destetados: number; kgDestetados: number; cerdasProm: number; gesMat: number; totalProductivo: number; totalGeneral: number };
  pendientes: { cmp: number; sinEtapa: number; estimadoGs: number }; financieros: number;
  detalle: Record<string, { texto: string; categoria: string; fuente: string; gs: number }[]> };

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const gs = (v: number) => `₲ ${Math.round(v).toLocaleString("es-PY")}`;
const KPIS: ClaveIndicador[] = ["costo_lechon_destetado", "costo_kg_destetado", "costo_cerda_anio", "peso_alimentacion", "peso_estructura"];
const PRODUCTIVAS = ["GES", "MAT", "DES", "ENG"];
// Colores suaves por categoría (texto siempre en tinta, nunca en el color)
const COLOR_CAT: Record<string, string> = { ALI: "#86b49a", SAN: "#8fb3d9", GEN: "#c4a4d6", ANI: "#d9b38f", MOB: "#e3c27a", ENE: "#9fc7c4", INS: "#b8b8a0", LOG: "#c9a9a6", EST: "#a9b4c2", COM: "#d6a6b8", FIN: "#b0a6c9", OTR: "#c8c8c8" };

const mesActual = () => { const d = new Date(); return d.getFullYear() * 100 + d.getMonth() + 1; };
const restar = (m: number, n: number) => { let a = Math.floor(m / 100), x = m % 100 - n; while (x < 1) { x += 12; a--; } return a * 100 + x; };
const PERIODOS = [
  { k: "mes", t: "Este mes", r: () => [mesActual(), mesActual()] },
  { k: "3", t: "Últimos 3 meses", r: () => [restar(mesActual(), 2), mesActual()] },
  { k: "12", t: "Últimos 12 meses", r: () => [restar(mesActual(), 11), mesActual()] },
  { k: "anio", t: "Este año", r: () => [Math.floor(mesActual() / 100) * 100 + 1, mesActual()] },
] as const;

export function PanelCostosEtapa() {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["k"]>("12");
  const [vista, setVista] = useState<"directo" | "conApoyo">("conApoyo");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const cargar = useCallback(() => {
    const [d, h] = PERIODOS.find(p => p.k === periodo)!.r();
    setDatos(null); setError(null);
    fetch(`/api/finanzas/costos-etapa?desde=${d}&hasta=${h}`, { cache: "no-store" }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setDatos(j); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar."));
  }, [periodo]);
  useEffect(() => { cargar(); }, [cargar]);

  const m = datos ? datos[vista] : {};
  const total = (e: string) => Object.values(m[e] ?? {}).reduce((s, v) => s + v, 0);
  const visibles = datos ? datos.etapas.filter(e => Math.round(total(e.codigo)) !== 0 && e.codigo !== "INV" && e.codigo !== "CMP" && (vista === "directo" || !["MAN", "VER", "BIO", "EST"].includes(e.codigo))) : [];
  const totalVista = visibles.reduce((s, e) => s + total(e.codigo), 0);
  const nombreCat = (c: string) => datos?.categorias.find(x => x.codigo === c)?.nombre ?? c;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>Costos por etapa</h2>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Cuánto cuesta cada etapa y en qué se va la plata. Los insumos cuentan cuando se consumen, no cuando se compran.</p>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select className="kp-input" value={periodo} onChange={e => setPeriodo(e.target.value as typeof periodo)} style={{ flex: "1 1 170px", maxWidth: 240 }} aria-label="Período">
          {PERIODOS.map(p => <option key={p.k} value={p.k}>{p.t}</option>)}
        </select>
        <div role="radiogroup" aria-label="Vista" style={{ display: "flex", gap: 2, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)" }}>
          {([["conApoyo", "Con apoyo y estructura"], ["directo", "Costo directo"]] as const).map(([v, t]) => (
            <button key={v} type="button" role="radio" aria-checked={vista === v} onClick={() => setVista(v)}
              style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 6, border: "none", cursor: "pointer", background: vista === v ? "var(--bg-surface)" : "transparent", color: vista === v ? "var(--text-primary)" : "var(--text-muted)", fontWeight: vista === v ? 500 : 400 }}>{t}</button>
          ))}
        </div>
      </div>

      {error && <div className="kp-alert kp-alert-danger" style={{ fontSize: 13 }}>{error}</div>}
      {!datos && !error && <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}><IconLoader2 size={15} className="animate-spin" /> Calculando…</div>}

      {datos && (
        <>
          {/* Indicadores */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            {KPIS.map(k => (
              <div key={k} style={{ ...tarjeta, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}><AyudaIndicador clave={k}>{indicador(k).nombre}</AyudaIndicador></div>
                <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{formatear(datos.indicadores[k], indicador(k))}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {k === "costo_lechon_destetado" ? `${datos.bases.destetados.toLocaleString("es-PY")} destetados`
                    : k === "costo_kg_destetado" ? (datos.bases.kgDestetados ? `${Math.round(datos.bases.kgDestetados).toLocaleString("es-PY")} kg destetados` : "Sin pesos al destete cargados")
                    : k === "costo_cerda_anio" ? `${datos.bases.cerdasProm.toLocaleString("es-PY", { maximumFractionDigits: 1 })} cerdas promedio` : "del costo"}
                </div>
              </div>
            ))}
          </div>

          {(datos.pendientes.cmp > 0 || datos.pendientes.sinEtapa > 0 || datos.pendientes.estimadoGs > 0) && (
            <div className="kp-alert kp-alert-warning" style={{ fontSize: 12.5, display: "flex", gap: 8 }}>
              <IconAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden />
              <span>
                {datos.pendientes.estimadoGs > 0 && <>{gs(datos.pendientes.estimadoGs)} de gastos compartidos de meses sin cerrar se muestran con el <strong>reparto estimado</strong>. </>}
                {datos.pendientes.cmp > 0 && <>{gs(datos.pendientes.cmp)} todavía no se pueden repartir (revisá las reglas en Cierre de mes). </>}
                {datos.pendientes.sinEtapa > 0 && <>{gs(datos.pendientes.sinEtapa)} no tienen etapa: asignala en <a href="/finanzas/clasificacion">Revisión de la clasificación</a>.</>}
              </span>
            </div>
          )}

          {/* Etapas */}
          <section style={{ ...tarjeta, overflow: "hidden" }} aria-label="Costo por etapa">
            <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>{vista === "directo" ? "Costo directo por etapa" : "Costo por etapa con apoyo y estructura"}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{gs(totalVista)}</span>
            </div>
            {visibles.length === 0 && <div style={{ padding: 14, fontSize: 13, color: "var(--text-muted)" }}>No hay costos en este período.</div>}
            {visibles.map(e => {
              const t = total(e.codigo);
              const cats = Object.entries(m[e.codigo] ?? {}).filter(([, v]) => Math.round(v) !== 0).sort((a, b) => b[1] - a[1]);
              const abiertaEsta = abierta === e.codigo;
              return (
                <div key={e.codigo} style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                  <button type="button" onClick={() => setAbierta(abiertaEsta ? null : e.codigo)} aria-expanded={abiertaEsta}
                    style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "12px 14px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 13.5, color: "var(--text-primary)", fontWeight: 500 }}>
                        {e.nombre}{!PRODUCTIVAS.includes(e.codigo) && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}> · {e.tipo === "ESTRUCTURA" ? "estructura" : e.tipo === "FINANCIERA" ? "financiero" : "apoyo"}</span>}
                      </span>
                      <span style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13.5, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                        {gs(t)} <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{totalVista ? Math.round((t / totalVista) * 100) : 0} %</span>
                        {abiertaEsta ? <IconChevronUp size={14} aria-hidden /> : <IconChevronDown size={14} aria-hidden />}
                      </span>
                    </div>
                    {/* Barra apilada por categoría, con 2px de separación */}
                    <div style={{ display: "flex", gap: 2, height: 8 }}>
                      {cats.filter(([, v]) => v > 0).map(([c, v]) => <div key={c} title={`${nombreCat(c)}: ${gs(v)}`} style={{ flex: `${v} 0 0`, background: COLOR_CAT[c] ?? "#c8c8c8", borderRadius: 4, minWidth: 2 }} />)}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11.5, color: "var(--text-secondary)" }}>
                      {cats.slice(0, 4).map(([c, v]) => (
                        <span key={c} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: COLOR_CAT[c] ?? "#c8c8c8" }} />{nombreCat(c)} {t ? Math.round((v / t) * 100) : 0} %
                        </span>
                      ))}
                    </div>
                  </button>
                  {abiertaEsta && (
                    <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                      {cats.map(([c, v]) => (
                        <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", borderBottom: "0.5px dashed var(--border-default)" }}>
                          <span>{nombreCat(c)}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{gs(v)}</span>
                        </div>
                      ))}
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>Lo que más pesa:</div>
                      {(datos.detalle[e.codigo] ?? []).filter(d => vista === "directo" ? d.fuente !== "APOYO" : true).slice(0, 15).map((d, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                          <span style={{ color: "var(--text-secondary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{d.texto}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{gs(d.gs)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {datos.financieros > 0 && (
              <div style={{ padding: "10px 14px", fontSize: 12.5, display: "flex", justifyContent: "space-between", color: "var(--text-secondary)" }}>
                <span>Gastos financieros (no se reparten)</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{gs(datos.financieros)}</span>
              </div>
            )}
          </section>

          <ComoSeCalcula claves={KPIS} />
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
            Costo de una etapa = gastos del libro con esa etapa (o su parte si se dividió) + su parte de los gastos compartidos repartidos al cerrar el mes + insumos que salieron del inventario hacia esa etapa × costo promedio.
            Las compras de insumos que entraron al inventario no se cuentan al comprarlas (se cuentan al consumirse); las inversiones van a su proyecto.
            «Con apoyo y estructura»: Mantenimiento, Áreas verdes, Bioseguridad y Estructura se reparten cada mes entre las etapas productivas según los animales presentes a fin de mes.
          </p>
        </>
      )}
    </div>
  );
}
