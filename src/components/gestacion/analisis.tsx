"use client";
import { useState, useEffect, useCallback } from "react";
import { IconLoader2, IconAlertTriangle, IconChartBar } from "@tabler/icons-react";
import {
  AnalisisGallery, RecomendacionesPanel,
  type GalleryCard, type Recomendacion,
} from "@/components/shared/analisis-gallery";

// ─── API types ─────────────────────────────────────────────────────────────────
interface Kpis {
  totalServicios: number; tasaParicion: number;
  diasGestacionPromedio: number | null; totalRepeticiones: number;
  tasaRepeticion: number; totalAbortos: number;
}
interface AnalisisData {
  kpis:                  Kpis;
  paricionPorLote:       { lote: string; servicios: number; partos: number; tasa: number }[];
  serviciosPorSemana:    { semana: string; count: number }[];
  tasaVerracos:          { identCode: string; servicios: number; partos: number; tasa: number }[];
  diagnosticos:          { positivos: number; negativos: number; recheck: number; sinDiagnostico: number; total: number };
  ciclos:                { ciclo: string; count: number }[];
  repeticionesPorSemana: { semana: string; count: number; tasa: number }[];
  abortosPorSemana:      { semana: string; count: number; tasa: number }[];
  diasGestacionPorSemana:{ semana: string; promedio: number }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function semLabel(s: string) { return s.replace(/^\d{4}-/, ""); }
function fmtDate(d: Date)    { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function colorParicion(v: number)  { return v >= 80 ? "var(--success)" : v >= 75 ? "var(--warning)" : "var(--danger)"; }
function colorRepeticion(v: number){ return v <= 3  ? "var(--success)" : v <= 6  ? "var(--warning)" : "var(--danger)"; }
function colorAbortos(v: number)   { return v === 0 ? "var(--bg-overlay)" : v <= 2 ? "var(--warning)" : "var(--danger)"; }
function colorGestacion(v: number) { return v >= 110 && v <= 118 ? "var(--info)" : v > 118 ? "var(--warning)" : "var(--danger)"; }
function colorVerraco(v: number)   { return v >= 80 ? "var(--success)" : v >= 75 ? "var(--warning)" : "var(--danger)"; }
function colorCicloLabel(label: string) {
  const n = parseInt(label);
  return n <= 3 ? "var(--success)" : n <= 5 ? "var(--warning)" : "var(--danger)";
}

// ─── BarChart mini ─────────────────────────────────────────────────────────────
interface BarItem { label: string; value: number }
function MiniBarChart({
  items, colorFn, unit = "", meta, metaLabel, height = 80, formatVal,
}: {
  items: BarItem[]; colorFn: (v: number, item: BarItem, i: number) => string;
  unit?: string; meta?: number; metaLabel?: string; height?: number; formatVal?: (v: number) => string;
}) {
  if (!items.length) return <div style={{ color: "var(--text-muted)", fontSize: 11, padding: "24px 0", textAlign: "center" }}>Sin datos en el período</div>;
  const maxVal = Math.max(...items.map(i => i.value), meta ?? 0, 1);
  return (
    <div style={{ position: "relative" }}>
      {meta !== undefined && (
        <div style={{ position: "absolute", bottom: 20 + (meta / maxVal) * height, left: 0, right: 0, zIndex: 2, pointerEvents: "none" }}>
          <div style={{ borderTop: "1px dashed var(--accent)", position: "relative" }}>
            {metaLabel && <span style={{ position: "absolute", right: 0, top: -10, fontSize: 9, color: "var(--accent)", background: "var(--bg-surface)", paddingLeft: 2 }}>{metaLabel}</span>}
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: height + 20, paddingTop: 16 }}>
        {items.map((item, i) => {
          const pct    = item.value / maxVal;
          const barH   = Math.max(pct * height, 2);
          const color  = colorFn(item.value, item, i);
          const display = formatVal ? formatVal(item.value) : `${item.value}${unit}`;
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 20, maxWidth: 60 }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2, whiteSpace: "nowrap" }}>{display}</div>
              <div style={{ width: "100%", height: barH, background: color, borderRadius: "2px 2px 0 0", minHeight: 2 }} />
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{item.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({ positivos, negativos, recheck, sinDiagnostico, total }: {
  positivos: number; negativos: number; recheck: number; sinDiagnostico: number; total: number;
}) {
  const r = 34; const circ = 2 * Math.PI * r;
  const segs = total > 0 ? [
    { pct: positivos / total,        color: "var(--success)"    },
    { pct: negativos / total,        color: "var(--danger)"     },
    { pct: recheck / total,          color: "var(--warning)"    },
    { pct: sinDiagnostico / total,   color: "var(--bg-overlay)" },
  ] : [{ pct: 1, color: "var(--bg-overlay)" }];
  let cumulative = 0;
  const pct = total > 0 ? Math.round((positivos / total) * 100) : 0;
  return (
    <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
      <svg width="90" height="90" style={{ transform: "rotate(-90deg)" }}>
        {segs.map((s, i) => {
          const len = s.pct * circ; const gap = circ - len; const off = -(cumulative * circ);
          cumulative += s.pct;
          return <circle key={i} cx="45" cy="45" r={r} fill="none" stroke={s.color} strokeWidth="11" strokeDasharray={`${len} ${gap}`} strokeDashoffset={off} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 1 }}>positivos</span>
      </div>
    </div>
  );
}

// ─── ChartPanel ───────────────────────────────────────────────────────────────
function ChartPanel({ title, resumen, children }: { title: string; resumen?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>{title}</div>
      {children}
      {resumen && <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-secondary)", borderTop: "0.5px solid var(--border-default)", paddingTop: 8 }}>{resumen}</div>}
    </div>
  );
}

// ─── KpiStrip ─────────────────────────────────────────────────────────────────
function KpiStrip({ items }: { items: { label: string; value: string | number; sub?: string; color?: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 8 }}>
      {items.map((k, i) => (
        <div key={i} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "10px 14px" }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 22, fontWeight: 500, color: k.color ?? "var(--text-primary)", lineHeight: 1 }}>{k.value}</div>
          {k.sub && <div style={{ fontSize: 10, marginTop: 4, color: "var(--text-muted)" }}>{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── MiniBar (tabla verracos) ──────────────────────────────────────────────────
function MiniBar({ tasa, color }: { tasa: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: "var(--bg-overlay)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(tasa, 100)}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, color, minWidth: 36, textAlign: "right" }}>{tasa}%</span>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 8 }}>
      <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando...</span>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Shared data hook ──────────────────────────────────────────────────────────
const PERIOD_OPTS = [
  { key: "semana",    days: 7,   label: "Semana"    },
  { key: "mes",       days: 30,  label: "Mes"       },
  { key: "trimestre", days: 90,  label: "Trimestre" },
  { key: "año",       days: 365, label: "Año"       },
] as const;

function PeriodFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", width: "fit-content", background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 2, border: "0.5px solid var(--border-default)", marginBottom: 14 }}>
      {PERIOD_OPTS.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
          background: value === o.key ? "var(--bg-surface)" : "transparent",
          color:      value === o.key ? "var(--text-primary)" : "var(--text-muted)",
          fontWeight: value === o.key ? 500 : 400,
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function useAnalisis(periodo: string) {
  const [data,    setData]    = useState<AnalisisData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const days = PERIOD_OPTS.find(p => p.key === periodo)?.days ?? 90;
    const hasta = fmtDate(new Date());
    const desde = fmtDate(addDays(new Date(), -days));
    setLoading(true);
    fetch(`/api/gestacion/analisis?desde=${desde}&hasta=${hasta}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [periodo]);

  useEffect(() => { load(); }, [load]);
  return { data, loading };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS 1 — Tasa de parición
// ═══════════════════════════════════════════════════════════════════════════════
function TasaParicion({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading } = useAnalisis(periodo);

  function generarRecs(): Recomendacion[] {
    if (!data) return [];
    const { kpis, paricionPorLote } = data;
    const recs: Recomendacion[] = [];

    if (kpis.tasaParicion < 75) {
      recs.push({
        nivel: "danger",
        titulo: `Tasa de parición crítica (${kpis.tasaParicion}%)`,
        descripcion: "La tasa de parición está por debajo del mínimo recomendado del 75%. Esto puede deberse a problemas en el momento del servicio, calidad del semen, estado sanitario o manejo de la gestación temprana.",
        accion: "Revisá el protocolo de inseminación (timing respecto al celo), evaluá la calidad seminal de los últimos lotes utilizados y verificá si hay presión de enfermedades como PRRS o Parvovirus.",
      });
    } else if (kpis.tasaParicion < 80) {
      recs.push({
        nivel: "warning",
        titulo: `Tasa de parición por debajo del objetivo (${kpis.tasaParicion}%)`,
        descripcion: "La tasa está sobre el mínimo (75%) pero por debajo del objetivo óptimo (≥80%). Hay margen de mejora.",
        accion: "Auditá el protocolo de detección de celo y la técnica de inseminación. Asegurate de que el semen sea procesado y almacenado a 17°C y usado dentro de las 48 horas.",
      });
    } else {
      recs.push({ nivel: "success", titulo: `Tasa de parición óptima (${kpis.tasaParicion}%)`, descripcion: "La tasa de parición supera el objetivo del 80%. Mantené los protocolos actuales. ✓" });
    }

    const lotesFiltrados = paricionPorLote.filter(l => l.servicios >= 5);
    if (lotesFiltrados.length > 1) {
      const mejor = lotesFiltrados.reduce((a, b) => b.tasa > a.tasa ? b : a);
      const peor  = lotesFiltrados.reduce((a, b) => a.tasa < b.tasa ? a : b);
      if (peor.tasa < 70) {
        recs.push({
          nivel: "warning",
          titulo: `Lote ${semLabel(peor.lote)} con parición baja (${peor.tasa}%)`,
          descripcion: `Este lote muestra una tasa de parición significativamente inferior. Analizá si hubo cambios en el semen utilizado, condiciones ambientales o personal que realizó la inseminación.`,
          accion: `Compará el protocolo del lote ${semLabel(peor.lote)} vs el lote de mejor desempeño (${semLabel(mejor.lote)}, ${mejor.tasa}%) e identificá las diferencias.`,
        });
      }
    }

    return recs;
  }

  if (loading) return <Spinner />;
  if (!data || data.kpis.totalServicios === 0) return <EmptyAnalisis />;

  const { kpis, paricionPorLote } = data;
  const mejor = [...paricionPorLote].filter(l => l.servicios >= 5).sort((a, b) => b.tasa - a.tasa)[0];
  const peor  = [...paricionPorLote].filter(l => l.servicios >= 5).sort((a, b) => a.tasa - b.tasa)[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      <KpiStrip items={[
        { label: "Total servicios",   value: kpis.totalServicios },
        { label: "Tasa de parición",  value: `${kpis.tasaParicion}%`, sub: "meta ≥ 75%", color: colorParicion(kpis.tasaParicion) },
      ]} />
      <ChartPanel title="Tasa de parición por lote" resumen={
        <div style={{ display: "flex", gap: 16 }}>
          {mejor && <span>Mejor: <strong style={{ color: "var(--success)" }}>{semLabel(mejor.lote)}</strong> {mejor.tasa}%</span>}
          {peor && mejor?.lote !== peor.lote && <span>Peor: <strong style={{ color: "var(--danger)" }}>{semLabel(peor.lote)}</strong> {peor.tasa}%</span>}
        </div>
      }>
        <MiniBarChart
          items={paricionPorLote.map(l => ({ label: semLabel(l.lote), value: l.tasa }))}
          colorFn={(v) => colorParicion(v)} unit="%" meta={75} metaLabel="meta 75%"
          formatVal={v => `${v}%`}
        />
      </ChartPanel>
      <RecomendacionesPanel recomendaciones={generarRecs()} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS 2 — Análisis de servicios y diagnósticos
// ═══════════════════════════════════════════════════════════════════════════════
function AnalisisServicios({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading } = useAnalisis(periodo);

  function generarRecs(): Recomendacion[] {
    if (!data) return [];
    const { diagnosticos, serviciosPorSemana } = data;
    const recs: Recomendacion[] = [];
    const pctPositivos = diagnosticos.total > 0 ? Math.round((diagnosticos.positivos / diagnosticos.total) * 100) : 0;
    const pctSinDiag   = diagnosticos.total > 0 ? Math.round((diagnosticos.sinDiagnostico / diagnosticos.total) * 100) : 0;

    if (pctPositivos < 75) {
      recs.push({
        nivel: "warning",
        titulo: `Tasa de confirmación de preñez baja (${pctPositivos}% positivos)`,
        descripcion: "Menos del 75% de los servicios están siendo confirmados como gestantes. Esto puede indicar problemas en la inseminación, retorno al celo no detectado o pérdidas tempranas de gestación.",
        accion: "Realizá diagnóstico por ecografía a los 21-28 días post-servicio en todas las cerdas. Detectá retornos de celo a los 18-24 días post-servicio mediante macho entero.",
      });
    } else {
      recs.push({ nivel: "success", titulo: `Buena tasa de confirmación de preñez (${pctPositivos}% positivos)`, descripcion: "Más del 75% de los servicios resultan en gestación confirmada. ✓" });
    }

    if (pctSinDiag > 10) {
      recs.push({
        nivel: "info",
        titulo: `${pctSinDiag}% de servicios sin diagnóstico de preñez`,
        descripcion: "Un alto porcentaje de cerdas sin diagnóstico puede generar incertidumbre en la planificación de partos.",
        accion: "Completá los diagnósticos pendientes mediante ecografía. Establecé un protocolo fijo: ecografía entre los días 25 y 30 post-servicio para todas las cerdas.",
      });
    }

    if (serviciosPorSemana.length > 3) {
      const media = serviciosPorSemana.reduce((s, x) => s + x.count, 0) / serviciosPorSemana.length;
      const minVal = Math.min(...serviciosPorSemana.map(x => x.count));
      if (minVal < media * 0.5) {
        recs.push({
          nivel: "info",
          titulo: "Inconsistencia en el ritmo de servicios",
          descripcion: "Hay semanas con muy pocos servicios respecto al promedio, lo que puede generar brechas en la producción futura.",
          accion: "Verificá si las semanas con pocos servicios coinciden con ausencias de personal, problemas sanitarios o lotes de semen rechazados.",
        });
      }
    }

    return recs;
  }

  if (loading) return <Spinner />;
  if (!data || data.kpis.totalServicios === 0) return <EmptyAnalisis />;

  const { kpis, serviciosPorSemana, diagnosticos } = data;
  const media  = serviciosPorSemana.length > 0 ? Math.round(serviciosPorSemana.reduce((s, x) => s + x.count, 0) / serviciosPorSemana.length) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      <KpiStrip items={[
        { label: "Total servicios", value: kpis.totalServicios },
        { label: "Media semanal",   value: media },
      ]} />

      <ChartPanel title="Evolución semanal de servicios" resumen={
        <span>Total: <strong>{kpis.totalServicios}</strong> · Media semanal: <strong>{media}</strong></span>
      }>
        <MiniBarChart items={serviciosPorSemana.map(s => ({ label: semLabel(s.semana), value: s.count }))} colorFn={() => "var(--success)"} />
      </ChartPanel>

      <ChartPanel title="Diagnósticos de preñez">
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <DonutChart {...diagnosticos} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            {[
              { label: "Positivos (gestante)", count: diagnosticos.positivos, color: "var(--success)" },
              { label: "Negativos (vacía)",    count: diagnosticos.negativos, color: "var(--danger)"  },
              { label: "Re-chequear",          count: diagnosticos.recheck,   color: "var(--warning)" },
              { label: "Sin diagnóstico",      count: diagnosticos.sinDiagnostico, color: "var(--text-muted)" },
            ].map(seg => (
              <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1 }}>{seg.label}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{seg.count}</span>
              </div>
            ))}
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, borderTop: "0.5px solid var(--border-default)", paddingTop: 6 }}>
              Total: {diagnosticos.total} servicios
            </div>
          </div>
        </div>
      </ChartPanel>

      <RecomendacionesPanel recomendaciones={generarRecs()} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS 3 — Pérdida reproductiva (repeticiones + abortos)
// ═══════════════════════════════════════════════════════════════════════════════
function PerdidaReproductiva({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading } = useAnalisis(periodo);

  function generarRecs(): Recomendacion[] {
    if (!data) return [];
    const { kpis, repeticionesPorSemana, abortosPorSemana } = data;
    const recs: Recomendacion[] = [];

    if (kpis.tasaRepeticion > 6) {
      recs.push({
        nivel: "danger",
        titulo: `Tasa de repetición crítica (${kpis.tasaRepeticion}%)`,
        descripcion: `Se registraron ${kpis.totalRepeticiones} repeticiones de celo. Una tasa mayor al 6% indica fallas sistemáticas en la inseminación o detección de celo. Cada repetición equivale a ~21 días perdidos de productividad.`,
        accion: "Revisá la técnica de inseminación, el timing respecto al inicio del celo y la calidad del semen. Asegurate de que los operarios reciban capacitación práctica sobre inseminación artificial.",
      });
    } else if (kpis.tasaRepeticion > 3) {
      recs.push({
        nivel: "warning",
        titulo: `Tasa de repetición elevada (${kpis.tasaRepeticion}%)`,
        descripcion: `La tasa de repetición supera el objetivo óptimo (≤3%). Hay margen de mejora en el protocolo de servicio.`,
        accion: "Controlá el almacenamiento del semen (17°C, máx. 48h), revisá el protocolo de detección de celo y monitoreá si las repeticiones son regulares (18-24d) o irregulares (>25d), ya que tienen causas distintas.",
      });
    } else {
      recs.push({ nivel: "success", titulo: `Tasa de repetición óptima (${kpis.tasaRepeticion}%)`, descripcion: "La tasa de repetición está dentro del rango objetivo (≤3%). ✓" });
    }

    if (kpis.totalAbortos > 0) {
      const pctAbortos = kpis.totalServicios > 0 ? +(kpis.totalAbortos / kpis.totalServicios * 100).toFixed(1) : 0;
      const nivel: Recomendacion["nivel"] = pctAbortos > 2 ? "danger" : "warning";
      recs.push({
        nivel,
        titulo: `${kpis.totalAbortos} abortos registrados (${pctAbortos}%)`,
        descripcion: `Se registraron ${kpis.totalAbortos} abortos en el período. La tasa límite es el 2%. Los abortos pueden tener origen infeccioso (PRRS, Parvovirus, Leptospira), nutricional (micotoxinas) o por estrés calórico.`,
        accion: "Verificá el estatus sanitario del plantel, el historial de vacunaciones y si hubo cambios recientes en la dieta. Enviá muestras para diagnóstico diferencial si se agrupan en el tiempo.",
      });
    } else {
      recs.push({ nivel: "success", titulo: "Sin abortos registrados en el período", descripcion: "No se registraron abortos. ✓ Mantené el protocolo sanitario y nutricional." });
    }

    if (repeticionesPorSemana.length > 2) {
      const pico = [...repeticionesPorSemana].sort((a, b) => b.tasa - a.tasa)[0];
      if (pico && pico.tasa > 10) {
        recs.push({
          nivel: "warning",
          titulo: `Pico de repeticiones en la semana ${semLabel(pico.semana)} (${pico.tasa}%)`,
          descripcion: "Un pico concentrado de repeticiones sugiere un problema puntual: lote de semen defectuoso, problema sanitario específico o error en el proceso de inseminación esa semana.",
          accion: "Rastreá qué lotes de semen, qué reproductores y qué personal estuvo involucrado esa semana. Correlacioná con cambios de temperatura y eventos sanitarios.",
        });
      }
    }

    return recs;
  }

  if (loading) return <Spinner />;
  if (!data || data.kpis.totalServicios === 0) return <EmptyAnalisis />;

  const { kpis, repeticionesPorSemana, abortosPorSemana } = data;
  const promRep = repeticionesPorSemana.length > 0
    ? Math.round(repeticionesPorSemana.reduce((s, x) => s + x.tasa, 0) / repeticionesPorSemana.length * 10) / 10
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      <KpiStrip items={[
        { label: "Total repeticiones",  value: kpis.totalRepeticiones },
        { label: "Tasa de repetición",  value: `${kpis.tasaRepeticion}%`, sub: "meta ≤ 6%", color: colorRepeticion(kpis.tasaRepeticion) },
        { label: "Total abortos",       value: kpis.totalAbortos, color: kpis.totalAbortos > 0 ? "var(--danger)" : undefined },
      ]} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ChartPanel title="Tasa de repetición semanal" resumen={
          repeticionesPorSemana.length > 0 && (() => {
            const pico = [...repeticionesPorSemana].sort((a, b) => b.tasa - a.tasa)[0];
            return <span>Promedio: <strong style={{ color: colorRepeticion(promRep) }}>{promRep}%</strong> · Pico: <strong>{semLabel(pico.semana)}</strong> {pico.tasa}%</span>;
          })()
        }>
          <MiniBarChart
            items={repeticionesPorSemana.map(s => ({ label: semLabel(s.semana), value: s.tasa }))}
            colorFn={(v) => colorRepeticion(v)} unit="%" meta={6} metaLabel="límite 6%"
            formatVal={v => `${v}%`}
          />
          {repeticionesPorSemana.length === 0 && <div style={{ fontSize: 11, color: "var(--success)", padding: "12px 0" }}>Sin repeticiones en el período ✓</div>}
        </ChartPanel>

        <ChartPanel title="Abortos por semana" resumen={
          abortosPorSemana.length > 0 && (() => {
            const prom = Math.round(abortosPorSemana.reduce((s, x) => s + x.tasa, 0) / abortosPorSemana.length * 10) / 10;
            return <span>Promedio: <strong style={{ color: colorAbortos(prom) }}>{prom}%</strong> · Total: <strong>{kpis.totalAbortos}</strong></span>;
          })()
        }>
          <MiniBarChart
            items={abortosPorSemana.map(s => ({ label: semLabel(s.semana), value: s.tasa }))}
            colorFn={(v) => colorAbortos(v)} unit="%" meta={2} metaLabel="límite 2%"
            formatVal={v => `${v}%`}
          />
          {abortosPorSemana.length === 0 && <div style={{ fontSize: 11, color: "var(--success)", padding: "12px 0" }}>Sin abortos en el período ✓</div>}
        </ChartPanel>
      </div>

      <RecomendacionesPanel recomendaciones={generarRecs()} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS 4 — Desempeño de gestación (días + ciclos)
// ═══════════════════════════════════════════════════════════════════════════════
function DesempenoGestacion({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading } = useAnalisis(periodo);

  function generarRecs(): Recomendacion[] {
    if (!data) return [];
    const { kpis, ciclos } = data;
    const recs: Recomendacion[] = [];

    if (kpis.diasGestacionPromedio !== null) {
      if (kpis.diasGestacionPromedio < 110) {
        recs.push({
          nivel: "danger",
          titulo: `Duración de gestación muy corta (${kpis.diasGestacionPromedio} días)`,
          descripcion: "Gestaciones menores a 110 días generalmente resultan en partos prematuros con alta mortalidad neonatal.",
          accion: "Verificá el registro de las fechas de servicio. Si los datos son correctos, consultá con el veterinario sobre posibles causas reproductivas o sanitarias.",
        });
      } else if (kpis.diasGestacionPromedio > 118) {
        recs.push({
          nivel: "warning",
          titulo: `Duración de gestación larga (${kpis.diasGestacionPromedio} días)`,
          descripcion: "Gestaciones mayores a 118 días pueden resultar en lechones de mayor tamaño o partos complicados.",
          accion: "Considerá inducción del parto con prostaglandinas en cerdas que superen los 116 días de gestación.",
        });
      } else {
        recs.push({ nivel: "success", titulo: `Duración de gestación normal (${kpis.diasGestacionPromedio} días)`, descripcion: "El promedio de días de gestación está dentro del rango normal (110–118 días). ✓" });
      }
    }

    const total = ciclos.reduce((s, c) => s + c.count, 0);
    if (total > 0) {
      const jovenes = ciclos.filter(c => ["1", "2", "3"].includes(c.ciclo)).reduce((s, c) => s + c.count, 0);
      const viejos  = ciclos.find(c => c.ciclo === "7+")?.count ?? 0;
      const pctJovenes = Math.round((jovenes / total) * 100);
      const pctViejos  = Math.round((viejos  / total) * 100);

      if (pctJovenes < 50) {
        recs.push({
          nivel: "warning",
          titulo: `Plantel con bajo porcentaje de cerdas jóvenes (${pctJovenes}% en ciclos 1-3)`,
          descripcion: "Un plantel con menos del 50% de cerdas en ciclos 1-3 puede tener una productividad decreciente. Las cerdas de mayor edad tienen menor tasa de parición y más complicaciones al parto.",
          accion: "Incrementá la reposición: incorporá nulíparas para llegar al 65-70% de cerdas jóvenes. Planificá el descarte de cerdas en ciclo 7+ de forma gradual.",
        });
      } else if (pctJovenes >= 65) {
        recs.push({ nivel: "success", titulo: `Buena distribución de edad del plantel (${pctJovenes}% jóvenes)`, descripcion: "El plantel tiene una proporción adecuada de cerdas jóvenes (ciclos 1-3). ✓" });
      }

      if (pctViejos > 10) {
        recs.push({
          nivel: "warning",
          titulo: `Alto porcentaje de cerdas en ciclo 7+ (${pctViejos}%)`,
          descripcion: "Las cerdas con más de 6 ciclos productivos tienen mayor riesgo de complicaciones reproductivas y menor productividad.",
          accion: "Planificá el descarte sistemático de cerdas en ciclo 7+. Priorizá aquellas con antecedentes de repetición, abortos o camadas pequeñas.",
        });
      }
    }

    return recs;
  }

  if (loading) return <Spinner />;
  if (!data || data.kpis.totalServicios === 0) return <EmptyAnalisis />;

  const { kpis, diasGestacionPorSemana, ciclos } = data;
  const total3 = ciclos.reduce((s, c) => s + c.count, 0);
  const jovenes3 = ciclos.filter(c => ["1","2","3"].includes(c.ciclo)).reduce((s, c) => s + c.count, 0);
  const viejos3  = ciclos.find(c => c.ciclo === "7+")?.count ?? 0;
  const pctJov3  = total3 > 0 ? Math.round((jovenes3 / total3) * 100) : 0;
  const pctViej3 = total3 > 0 ? Math.round((viejos3  / total3) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      <KpiStrip items={[
        {
          label: "Días gestación prom.", value: kpis.diasGestacionPromedio ?? "—",
          sub: "rango normal 110–118",
          color: kpis.diasGestacionPromedio ? colorGestacion(kpis.diasGestacionPromedio) : undefined,
        },
      ]} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ChartPanel title="Días de gestación promedio semanal" resumen={
          <span>Media del período: <strong style={{ color: kpis.diasGestacionPromedio ? colorGestacion(kpis.diasGestacionPromedio) : undefined }}>{kpis.diasGestacionPromedio ?? "—"} días</strong> · rango normal: 110–118</span>
        }>
          <MiniBarChart
            items={diasGestacionPorSemana.map(s => ({ label: semLabel(s.semana), value: s.promedio }))}
            colorFn={(v) => colorGestacion(v)} meta={114} metaLabel="referencia 114d"
            formatVal={v => `${v}d`}
          />
        </ChartPanel>

        <ChartPanel title="Distribución por ciclos reproductivos" resumen={
          <div style={{ display: "flex", gap: 12 }}>
            <span>Jóvenes (1–3): <strong style={{ color: pctJov3 >= 65 ? "var(--success)" : "var(--warning)" }}>{pctJov3}%</strong></span>
            <span>Ciclo 7+: <strong style={{ color: pctViej3 > 5 ? "var(--danger)" : "var(--success)" }}>{pctViej3}%</strong></span>
          </div>
        }>
          <MiniBarChart
            items={ciclos.map(c => ({ label: `C${c.ciclo}`, value: c.count }))}
            colorFn={(_v, item) => colorCicloLabel(item.label.replace("C", ""))}
          />
        </ChartPanel>
      </div>

      <RecomendacionesPanel recomendaciones={generarRecs()} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS 5 — Rendimiento de reproductores
// ═══════════════════════════════════════════════════════════════════════════════
function RendimientoReproductores({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading } = useAnalisis(periodo);

  function generarRecs(): Recomendacion[] {
    if (!data) return [];
    const { tasaVerracos } = data;
    const recs: Recomendacion[] = [];
    const con5 = tasaVerracos.filter(v => v.servicios >= 5);

    if (con5.length === 0) return [{ nivel: "info", titulo: "Sin datos suficientes", descripcion: "No hay reproductores con suficientes servicios para análisis estadístico (mínimo 5 servicios)." }];

    const bajos  = con5.filter(v => v.tasa < 75);
    const buenos = con5.filter(v => v.tasa >= 80);

    if (bajos.length === 0) {
      recs.push({ nivel: "success", titulo: "Todos los reproductores dentro del rango aceptable", descripcion: `${con5.length} reproductor${con5.length > 1 ? "es" : ""} evaluado${con5.length > 1 ? "s" : ""} con tasa ≥75%. ✓` });
    } else {
      for (const v of bajos) {
        recs.push({
          nivel: v.tasa < 70 ? "danger" : "warning",
          titulo: `${v.identCode}: tasa de parición baja (${v.tasa}%)`,
          descripcion: `Este reproductor tiene ${v.servicios} servicios registrados con solo ${v.partos} partos confirmados. Una tasa inferior al 75% amerita evaluación de calidad seminal.`,
          accion: `Realizá un espermograma de ${v.identCode}. Si los parámetros seminales son correctos, revisá el manejo del semen post-colecta (dilución, temperatura, tiempo hasta inseminación).`,
        });
      }
    }

    if (buenos.length > 0 && bajos.length > 0) {
      const mejorVer = buenos.reduce((a, b) => b.tasa > a.tasa ? b : a);
      recs.push({
        nivel: "info",
        titulo: `Maximizá el uso de ${mejorVer.identCode} (${mejorVer.tasa}% tasa parición)`,
        descripcion: `El reproductor de mejor desempeño es ${mejorVer.identCode}. Priorizar su semen para las inseminaciones mientras se evalúan los reproductores con bajo rendimiento puede mejorar los resultados globales.`,
      });
    }

    return recs;
  }

  if (loading) return <Spinner />;
  if (!data || data.tasaVerracos.length === 0) return <EmptyAnalisis msg="Sin datos de monta natural en el período" />;

  const { tasaVerracos } = data;
  const verracosBajos = tasaVerracos.filter(v => v.servicios >= 5 && v.tasa < 75);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />

      <ChartPanel title="Tasa de parición por reproductor" resumen={
        verracosBajos.length > 0
          ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <IconAlertTriangle size={11} style={{ color: "var(--danger)" }} />
              {verracosBajos.map(v => `${v.identCode} (${v.tasa}%)`).join(", ")} — revisar calidad seminal
            </div>
          : "Todos los reproductores dentro del rango aceptable ✓"
      }>
        <table className="kp-table">
          <thead>
            <tr><th>Reproductor</th><th>Servicios</th><th>Partos</th><th>Tasa</th></tr>
          </thead>
          <tbody>
            {tasaVerracos.map(v => (
              <tr key={v.identCode}>
                <td style={{ fontWeight: 500 }}>{v.identCode}</td>
                <td>{v.servicios}</td>
                <td>{v.partos}</td>
                <td style={{ width: 140 }}><MiniBar tasa={v.tasa} color={colorVerraco(v.tasa)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartPanel>

      <RecomendacionesPanel recomendaciones={generarRecs()} />
    </div>
  );
}

// ─── empty state helper ───────────────────────────────────────────────────────
function EmptyAnalisis({ msg = "Sin datos en el período" }: { msg?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "60px 0", textAlign: "center",
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
    }}>
      <IconChartBar size={32} style={{ color: "var(--text-muted)", marginBottom: 8 }} />
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{msg}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GALERÍA
// ═══════════════════════════════════════════════════════════════════════════════
const CARDS: GalleryCard[] = [
  {
    id:          "paricion",
    titulo:      "Tasa de parición",
    descripcion: "Analice cuántas cerdas servidas llegan efectivamente al parto. Compare la tasa por lote, detecte los lotes con peor desempeño y reciba recomendaciones para mejorar la eficiencia reproductiva del plantel.",
    tags:        ["Parición", "Lotes", "Eficiencia", "Servicios"],
    categoria:   "desempeño",
    color:       "var(--success)",
    component:   TasaParicion,
  },
  {
    id:          "servicios",
    titulo:      "Análisis de servicios",
    descripcion: "Evalúe el ritmo semanal de servicios y la tasa de confirmación de preñez mediante diagnóstico ecográfico. Identifique semanas con bajo volumen y optimice el protocolo de inseminación y detección de celo.",
    tags:        ["Servicios", "IA", "Diagnóstico", "Preñez"],
    categoria:   "analisis",
    color:       "var(--accent)",
    component:   AnalisisServicios,
  },
  {
    id:          "perdida",
    titulo:      "Pérdida reproductiva",
    descripcion: "Monitoree las repeticiones de celo y los abortos. Detecte patrones temporales que indiquen problemas en la técnica de inseminación, calidad del semen o brotes sanitarios que estén afectando la gestación.",
    tags:        ["Repeticiones", "Abortos", "Pérdidas", "Tendencia"],
    categoria:   "analisis",
    color:       "var(--danger)",
    component:   PerdidaReproductiva,
  },
  {
    id:          "gestacion",
    titulo:      "Desempeño de gestación",
    descripcion: "Analice la duración de la gestación y la distribución del plantel por ciclos productivos. Detecte gestaciones anormalmente cortas o largas y evalúe la renovación del plantel.",
    tags:        ["Gestación", "Ciclos", "Duración", "Plantel"],
    categoria:   "desempeño",
    color:       "var(--info)",
    component:   DesempenoGestacion,
  },
  {
    id:          "reproductores",
    titulo:      "Rendimiento de reproductores",
    descripcion: "Compare la tasa de parición por verraco (monta natural o IA). Identifique reproductores con bajo rendimiento para evaluación seminal y optimice la asignación de machos en el programa reproductivo.",
    tags:        ["Verracos", "Semen", "Rendimiento", "Ranking"],
    categoria:   "listado",
    color:       "var(--warning)",
    component:   RendimientoReproductores,
  },
];

// ─── Export ────────────────────────────────────────────────────────────────────
export function CentralAnalisis({ tenantId: _ }: { tenantId: string }) {
  return <AnalisisGallery cards={CARDS} />;
}
