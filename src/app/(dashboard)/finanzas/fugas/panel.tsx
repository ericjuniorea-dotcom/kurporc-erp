"use client";
// Finanzas · Fugas (costeo por etapa, Fase 7): lista de alertas con los guaraníes en juego, cómo se calcula cada una
// y a dónde ir a corregirla. Pensada para el celular.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconAlertTriangle, IconChevronRight, IconCircleCheck, IconInfoCircle, IconLoader2 } from "@tabler/icons-react";

type Fuga = { clave: string; titulo: string; gs: number; detalle: string; como: string; href: string; accion: string; nivel: "alta" | "media" | "info" };
type Datos = { fugas: Fuga[]; totalGs: number; umbralOtros: number; sinConsumos: boolean };

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const gs = (v: number) => `₲ ${Math.round(v).toLocaleString("es-PY")}`;
const mesActual = () => { const d = new Date(); return d.getFullYear() * 100 + d.getMonth() + 1; };
const restar = (m: number, n: number) => { let a = Math.floor(m / 100), x = m % 100 - n; while (x < 1) { x += 12; a--; } return a * 100 + x; };
const PERIODOS = [
  { k: "mes", t: "Este mes", r: () => [mesActual(), mesActual()] },
  { k: "3", t: "Últimos 3 meses", r: () => [restar(mesActual(), 2), mesActual()] },
  { k: "12", t: "Últimos 12 meses", r: () => [restar(mesActual(), 11), mesActual()] },
] as const;
const NIVEL = {
  alta: { t: "Importante", fondo: "var(--danger-subtle)", color: "var(--danger-text)", icono: IconAlertTriangle },
  media: { t: "Atención", fondo: "var(--warning-subtle)", color: "var(--warning-text)", icono: IconAlertTriangle },
  info: { t: "Para revisar", fondo: "var(--info-subtle)", color: "var(--info-text)", icono: IconInfoCircle },
} as const;

export function PanelFugas() {
  const [periodo, setPeriodo] = useState<(typeof PERIODOS)[number]["k"]>("3");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(() => {
    const [d, h] = PERIODOS.find(p => p.k === periodo)!.r();
    setDatos(null); setError(null);
    fetch(`/api/finanzas/fugas?desde=${d}&hasta=${h}`, { cache: "no-store" }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setDatos(j); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar."));
  }, [periodo]);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "var(--text-primary)" }}>Fugas</h2>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Dónde se está yendo plata, cuánto hay en juego y dónde corregirlo.</p>
      </div>
      <select className="kp-input" value={periodo} onChange={e => setPeriodo(e.target.value as typeof periodo)} style={{ maxWidth: 240 }} aria-label="Período">
        {PERIODOS.map(p => <option key={p.k} value={p.k}>{p.t}</option>)}
      </select>
      {error && <div className="kp-alert kp-alert-danger" style={{ fontSize: 13 }}>{error}</div>}
      {!datos && !error && <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 13 }}><IconLoader2 size={15} className="animate-spin" /> Buscando fugas…</div>}
      {datos && (
        <>
          <div style={{ ...tarjeta, padding: 14 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>En juego</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: datos.totalGs ? "var(--danger-text)" : "var(--success-text)", fontVariantNumeric: "tabular-nums" }}>{gs(datos.totalGs)}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>suma de las fugas del período (sin contar «Para revisar»)</div>
          </div>
          {datos.fugas.length === 0 && (
            <div style={{ ...tarjeta, padding: 14, display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--success-text)" }}><IconCircleCheck size={16} aria-hidden /> No se encontraron fugas en este período.</div>
          )}
          {datos.fugas.map(f => {
            const nv = NIVEL[f.nivel];
            const Icono = nv.icono;
            return (
              <article key={f.clave} style={{ ...tarjeta, padding: 14, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", minWidth: 0 }}>
                    <Icono size={16} style={{ color: nv.color, flexShrink: 0, marginTop: 2 }} aria-hidden />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-primary)" }}>{f.titulo}</div>
                      <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 999, background: nv.fondo, color: nv.color }}>{nv.t}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)", whiteSpace: "nowrap" }}>{gs(f.gs)}</div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{f.detalle}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Cómo se calcula: {f.como}</div>
                <Link href={f.href} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12.5, color: "var(--accent-text)" }}>{f.accion} <IconChevronRight size={13} aria-hidden /></Link>
              </article>
            );
          })}
          {datos.sinConsumos && (
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>No hay consumos de balanceado de cerdas cargados en el período: el desvío de alimento se calcula cuando Nutrición registra las entregas.</div>
          )}
          <p style={{ margin: 0, fontSize: 11.5, color: "var(--text-muted)" }}>
            Se revisan: desvío de alimento de las cerdas, faltantes del conteo de inventario, subas de precio de más de 10 %, cerdas paradas, mortalidad valorizada,
            «Otros gastos» por encima del {Math.round(datos.umbralOtros * 1000) / 10} % (Finanzas → Parámetros) y gastos que no llegan a ninguna etapa.
          </p>
        </>
      )}
    </div>
  );
}
