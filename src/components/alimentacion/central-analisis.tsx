"use client";
import { useState, useEffect, useCallback } from "react";
import { IconLoader2, IconTrendingDown } from "@tabler/icons-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, Cell,
} from "recharts";
import { AnalisisGallery, RecomendacionesPanel, type GalleryCard, type Recomendacion } from "@/components/shared/analisis-gallery";

const TOOLTIP_STYLE = {
  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
  borderRadius: 8, fontSize: 11, color: "var(--text-primary)",
};

const FEED_COLORS: Record<string, string> = {
  GESTATION:   "#1D9E75",
  LACTATION:   "#A31621",
  PRE_STARTER: "#D4537E",
  PHASE_1:     "#378ADD",
  PHASE_2:     "#185FA5",
  GROWING:     "#639922",
};

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

const PERIOD_OPTS = [
  { key: "semana",    days: 7,   label: "Semana"    },
  { key: "mes",       days: 30,  label: "Mes"       },
  { key: "trimestre", days: 90,  label: "Trimestre" },
  { key: "año",       days: 365, label: "Año"       },
];

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", padding: "14px 16px",
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function PeriodFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", width: "fit-content", background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 2, border: "0.5px solid var(--border-default)", marginBottom: 14 }}>
      {PERIOD_OPTS.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
          background: value === o.key ? "var(--warning)" : "transparent",
          color:      value === o.key ? "#fff"           : "var(--text-muted)",
          fontWeight: value === o.key ? 600 : 400,
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 8 }}>
      <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando...</span>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function useAnalisis(periodo: string) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    const days = PERIOD_OPTS.find(p => p.key === periodo)?.days ?? 90;
    const desde = fmtDate(addDays(new Date(), -days));
    const hasta  = fmtDate(new Date());
    setLoading(true);
    fetch(`/api/alimentacion/analisis?desde=${desde}&hasta=${hasta}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [periodo]);

  useEffect(() => { load(); }, [load]);
  return { data, loading };
}

// ═══ ANÁLISIS 1 — Consumo semanal ════════════════════════════════════════════
function ConsumoSemanal({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading }     = useAnalisis(periodo);

  function recs(): Recomendacion[] {
    if (!data?.kpis) return [];
    const r: Recomendacion[] = [];
    const prom = data.kpis.promSemanal;
    const arr: any[] = data.consumoSemanal ?? [];
    if (arr.length < 2) return r;
    const last  = arr[arr.length - 1]?.totalKg ?? 0;
    const prev  = arr[arr.length - 2]?.totalKg ?? 0;
    const delta = prev > 0 ? ((last - prev) / prev) * 100 : 0;
    if (delta < -10) {
      r.push({ nivel: "warning", titulo: `Consumo cayó ${Math.abs(delta).toFixed(0)}% vs semana anterior`, descripcion: "Una caída brusca puede indicar animales enfermos, errores en el registro o reducción no planificada de stock.", accion: "Verificá que todos los operarios hayan completado sus registros. Revisá si algún lote fue cerrado o tiene baja de animales." });
    } else if (delta > 15) {
      r.push({ nivel: "info", titulo: `Consumo subió ${delta.toFixed(0)}% vs semana anterior`, descripcion: "Un aumento significativo puede ser normal si ingresaron lotes nuevos. Si no, revisá los registros por duplicación." });
    } else {
      r.push({ nivel: "success", titulo: "Consumo semanal estable", descripcion: `Promedio: ${prom.toLocaleString("es-PY")} kg/semana. La variación semana a semana es normal. ✓` });
    }
    return r;
  }

  if (loading) return <Spinner />;
  if (!data || (data.consumoSemanal ?? []).length === 0) return <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin datos en el período</div>;

  const { kpis, consumoSemanal } = data;
  const max = Math.max(...consumoSemanal.map((s: any) => s.totalKg));
  const current = consumoSemanal[consumoSemanal.length - 1]?.semana;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "Consumo total período", value: `${(kpis.totalConsumo / 1000).toFixed(2)} t` },
          { label: "Promedio semanal",      value: `${kpis.promSemanal.toLocaleString("es-PY")} kg` },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "12px 16px", flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      <ChartPanel title="Consumo semanal total (kg)" subtitle={`Semana con mayor consumo: ${consumoSemanal.reduce((a: any, b: any) => b.totalKg > a.totalKg ? b : a, consumoSemanal[0])?.semana ?? "—"}`}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={consumoSemanal} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis dataKey="semana" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v.toLocaleString("es-PY")} kg`]} />
            <Bar dataKey="totalKg" name="kg totales" radius={[3, 3, 0, 0]}>
              {consumoSemanal.map((s: any) => (
                <Cell key={s.semana} fill={s.semana === current ? "var(--warning)" : "#EF9F2799"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <RecomendacionesPanel recomendaciones={recs()} />
    </div>
  );
}

// ═══ ANÁLISIS 2 — Distribución por fase ══════════════════════════════════════
function DistribucionFase({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading }     = useAnalisis(periodo);

  function recs(): Recomendacion[] {
    if (!data?.distribucion) return [];
    const r: Recomendacion[] = [];
    const dist: any[] = data.distribucion;
    const top = dist[0];
    if (top) {
      r.push({ nivel: "info", titulo: `${top.name} representa el ${top.pct}% del consumo total`, descripcion: `Con ${top.kg.toLocaleString("es-PY")} kg es el alimento de mayor consumo en el período.` });
    }
    const engorde = dist.find((d: any) => d.phase === "GROWING");
    if (engorde && engorde.pct < 30) {
      r.push({ nivel: "info", titulo: "Baja proporción de engorde en el consumo", descripcion: "Si hay lotes de engorde activos, esto puede indicar sub-registro. El engorde normalmente es el 40-60% del consumo total.", accion: "Verificá que los operarios de engorde estén completando sus registros diariamente." });
    }
    return r;
  }

  if (loading) return <Spinner />;
  if (!data || (data.distribucion ?? []).length === 0) return <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin datos</div>;

  const { distribucion } = data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      <ChartPanel title="Distribución del consumo por fase">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {distribucion.map((d: any) => (
            <div key={d.phase} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 160, flexShrink: 0 }}>{d.name}</span>
              <div style={{ flex: 1, height: 10, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${d.pct}%`, background: FEED_COLORS[d.phase] ?? "var(--warning)", borderRadius: 99, transition: "width 0.6s" }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, minWidth: 44, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{d.pct}%</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 80, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.kg.toLocaleString("es-PY")} kg</span>
            </div>
          ))}
        </div>
      </ChartPanel>
      <RecomendacionesPanel recomendaciones={recs()} />
    </div>
  );
}

// ═══ ANÁLISIS 3 — Conversión alimenticia (Engorde) ════════════════════════════
function ConversionAlimenticia({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading }     = useAnalisis(periodo);
  const META = 2.35;

  function recs(): Recomendacion[] {
    if (!data?.kpis) return [];
    const r: Recomendacion[] = [];
    const conv = data.kpis.conversionGlobal;
    if (conv === 0) {
      r.push({ nivel: "info", titulo: "Sin datos de conversión", descripcion: "No hay lotes de engorde activos o sin pesajes registrados para calcular la conversión." });
      return r;
    }
    if (conv <= META) {
      r.push({ nivel: "success", titulo: `Conversión óptima (${conv})`, descripcion: `La conversión alimenticia de ${conv} está dentro o por debajo de la meta de ${META}. ✓` });
    } else if (conv <= 2.5) {
      r.push({ nivel: "warning", titulo: `Conversión por encima de la meta (${conv} vs meta ${META})`, descripcion: "Una conversión elevada incrementa el costo de producción por kg de carne. Puede deberse a formulación del alimento, genética, temperatura ambiental o estado sanitario.", accion: "Revisá el protocolo de alimentación, la densidad de los corrales y el estado sanitario del lote." });
    } else {
      r.push({ nivel: "danger", titulo: `Conversión crítica (${conv})`, descripcion: "Una conversión mayor a 2.5 es una señal de alerta grave. El lote está consumiendo demasiado alimento por kg de ganancia.", accion: "Auditá urgente: formulación, pesajes, registro de muertes, temperatura de los galpones y estado sanitario." });
    }
    return r;
  }

  if (loading) return <Spinner />;
  const conv: any[] = data?.conversionSemanal ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      <div style={{
        display: "flex", gap: 6, alignItems: "center", padding: "8px 12px",
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--text-muted)",
      }}>
        <IconTrendingDown size={14} />
        En conversión alimenticia, <strong style={{ color: "var(--text-primary)", margin: "0 4px" }}>menor es mejor</strong> — la meta es ≤ {META}
      </div>

      {conv.length > 0 ? (
        <ChartPanel title="Conversión alimenticia semanal (Engorde)" subtitle={`Mejor: ${Math.min(...conv.map((c: any) => c.conv)).toFixed(2)} · Peor: ${Math.max(...conv.map((c: any) => c.conv)).toFixed(2)}`}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={conv} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="semana" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toFixed(2)]} />
              <ReferenceLine y={META} stroke="var(--success)" strokeDasharray="4 2" label={{ value: `meta ${META}`, position: "right", fill: "var(--success)", fontSize: 9 }} />
              <Bar dataKey="conv" name="Conversión" radius={[3, 3, 0, 0]}>
                {conv.map((c: any) => (
                  <Cell key={c.semana} fill={c.conv <= META ? "var(--success)" : c.conv <= 2.5 ? "var(--warning)" : "var(--danger)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      ) : (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin lotes de engorde con datos suficientes</div>
      )}
      <RecomendacionesPanel recomendaciones={recs()} />
    </div>
  );
}

// ═══ ANÁLISIS 4 — Proyección de stock ════════════════════════════════════════
function ProyeccionStock({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("mes");
  const { data, loading }     = useAnalisis(periodo);

  function recs(): Recomendacion[] {
    if (!data?.proyeccion) return [];
    const r: Recomendacion[] = [];
    const urgentes = (data.proyeccion as any[]).filter(p => p.diasRestantes < 3);
    const bajos    = (data.proyeccion as any[]).filter(p => p.diasRestantes >= 3 && p.diasRestantes < 7);
    if (urgentes.length > 0) {
      r.push({ nivel: "danger", titulo: `${urgentes.length} tipo${urgentes.length > 1 ? "s" : ""} de alimento con stock crítico`, descripcion: `${urgentes.map((u: any) => u.feedTypeName).join(", ")} — menos de 3 días de stock.`, accion: "Iniciá producción de urgencia hoy. Notificá al encargado de BAL y al jefe de producción." });
    }
    if (bajos.length > 0) {
      r.push({ nivel: "warning", titulo: `${bajos.length} tipo${bajos.length > 1 ? "s" : ""} de alimento bajo mínimo`, descripcion: `${bajos.map((b: any) => b.feedTypeName).join(", ")} — entre 3 y 7 días de stock.`, accion: "Programá producción para esta semana." });
    }
    if (urgentes.length === 0 && bajos.length === 0) {
      r.push({ nivel: "success", titulo: "Stock de todos los alimentos por encima del mínimo", descripcion: "Todos los tipos de alimento tienen stock para más de 7 días. ✓ Mantené el ritmo de producción." });
    }
    return r;
  }

  if (loading) return <Spinner />;
  const proy: any[] = data?.proyeccion ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />

      <div style={{
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
      }}>
        <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", background: "var(--bg-overlay)" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Proyección de stock — próximos 30 días
          </span>
        </div>
        {proy.length === 0 ? (
          <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin stock registrado</div>
        ) : (
          <table className="kp-table">
            <thead>
              <tr>
                <th>Alimento</th>
                <th style={{ textAlign: "right" }}>Stock actual</th>
                <th style={{ textAlign: "right" }}>Consumo/día</th>
                <th style={{ textAlign: "right" }}>Días restantes</th>
                <th>¿Necesita producción?</th>
              </tr>
            </thead>
            <tbody>
              {proy.map(p => {
                const diasColor = p.diasRestantes >= 7 ? "var(--success)" : p.diasRestantes >= 5 ? "var(--warning)" : "var(--danger)";
                return (
                  <tr key={p.feedTypeId}>
                    <td style={{ fontWeight: 500 }}>{p.feedTypeName}</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.stockKg.toLocaleString("es-PY")} kg</td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.consumoDiario > 0 ? `${p.consumoDiario} kg` : "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: diasColor, fontVariantNumeric: "tabular-nums" }}>
                      {p.diasRestantes >= 999 ? "∞" : p.diasRestantes}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600,
                        background: p.urgencia === "success" ? "var(--success-subtle)" : p.urgencia === "warning" ? "var(--warning-subtle)" : "var(--danger-subtle)",
                        color:      p.urgencia === "success" ? "var(--success)"        : p.urgencia === "warning" ? "var(--warning)"        : "var(--danger)",
                        border:     `0.5px solid ${p.urgencia === "success" ? "var(--success-border)" : p.urgencia === "warning" ? "var(--warning-border)" : "var(--danger-border)"}`,
                      }}>
                        {p.necesita}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <RecomendacionesPanel recomendaciones={recs()} />
    </div>
  );
}

// ─── Galería ───────────────────────────────────────────────────────────────────
const CARDS: GalleryCard[] = [
  {
    id: "consumo",
    titulo: "Consumo semanal",
    descripcion: "Visualice la evolución del consumo total de alimento por semana. Detecte semanas con consumo atípico y reciba alertas ante variaciones bruscas.",
    tags: ["Consumo", "Semanas", "Tendencia", "Total"],
    categoria: "desempeño",
    color: "var(--warning)",
    component: ConsumoSemanal,
  },
  {
    id: "distribucion",
    titulo: "Distribución por fase",
    descripcion: "Vea qué tipo de alimento representa el mayor porcentaje del consumo total. Identifique desbalances entre fases y asegure que cada sector esté registrando correctamente.",
    tags: ["Fases", "Distribución", "Porcentaje", "Tipos"],
    categoria: "analisis",
    color: "var(--info)",
    component: DistribucionFase,
  },
  {
    id: "conversion",
    titulo: "Conversión alimenticia",
    descripcion: "Analice la eficiencia de conversión del lote de engorde. Menor es mejor — la meta es ≤2.35. Detecte semanas con conversión elevada y reciba recomendaciones para mejorarla.",
    tags: ["Engorde", "Conversión", "Eficiencia", "GDP"],
    categoria: "analisis",
    color: "var(--success)",
    component: ConversionAlimenticia,
  },
  {
    id: "proyeccion",
    titulo: "Proyección de stock",
    descripcion: "Proyecte cuántos días de stock de cada tipo de alimento quedan según el consumo actual. Reciba alertas cuando algún alimento esté próximo al mínimo y actúe antes del quiebre.",
    tags: ["Stock", "Proyección", "BAL", "Producción"],
    categoria: "listado",
    color: "var(--danger)",
    component: ProyeccionStock,
  },
];

export function CentralAnalisisAlimentacion() {
  return <AnalisisGallery cards={CARDS} />;
}
