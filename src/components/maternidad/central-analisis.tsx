"use client";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { IconLoader2, IconChartLine } from "@tabler/icons-react";
import {
  AnalisisGallery, RecomendacionesPanel,
  type GalleryCard, type Recomendacion,
} from "@/components/shared/analisis-gallery";

// ─── API types ────────────────────────────────────────────────────────────────
interface Kpis {
  totalPartos: number; nacidosTotalesAvg: number; nacidosVivosAvg: number;
  perdidasPct: number; pesoMedioNacimiento: number; totalMuertes: number; mortalidadPct: number;
}
interface PeriodBucket {
  periodo: string; partos: number; nacidosTotales: number; nacidosVivos: number;
  pctMomificados: number; pctNacidosMuertos: number; pesoMedio: number;
}
interface AgeBucket   { label: string; count: number; pct: number }
interface CauseBucket { cause: string; label: string; count: number; pct: number }
interface WeanRecord  { weaningDate: string; pigletsWeaned: number; avgPigletWeightKg: number|null; lactationDays: number }

const TOOLTIP = {
  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
  borderRadius: 8, fontSize: 11, color: "var(--text-primary)",
};

// ─── shared helpers ────────────────────────────────────────────────────────────
function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", padding: "14px 16px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, unit, meta, inverse }: {
  label: string; value: number; unit?: string; meta?: number; inverse?: boolean;
}) {
  const onTarget = meta !== undefined ? (inverse ? value <= meta : value >= meta) : null;
  return (
    <div style={{
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", padding: "14px 16px", flex: 1,
    }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
          {value.toLocaleString("es-PY")}
        </span>
        {unit && <span style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{unit}</span>}
        {onTarget !== null && (
          <span style={{
            marginBottom: 3, fontSize: 11, fontWeight: 600,
            color: onTarget ? "var(--success)" : "var(--danger)",
          }}>
            {onTarget ? "✓" : "✗"}
          </span>
        )}
      </div>
      {meta !== undefined && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>Meta: {meta.toLocaleString("es-PY")}{unit}</div>
      )}
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

const PERIOD_OPTS = [
  { key: "SEMANA",    label: "Semana"    },
  { key: "MES",       label: "Mes"       },
  { key: "TRIMESTRE", label: "Trimestre" },
  { key: "AÑO",       label: "Año"       },
];

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

// ─── Hook para analytics ───────────────────────────────────────────────────────
function useAnalisis(periodo: string) {
  const [kpis,    setKpis]    = useState<Kpis | null>(null);
  const [metas,   setMetas]   = useState<Record<string, number>>({});
  const [serie,   setSerie]   = useState<PeriodBucket[]>([]);
  const [byAge,   setByAge]   = useState<AgeBucket[]>([]);
  const [byCause, setByCause] = useState<CauseBucket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/maternidad/analisis?periodo=${periodo}`)
      .then(r => r.json())
      .then(d => {
        setKpis(d.kpis ?? null);
        setMetas(d.metas ?? {});
        setSerie((d.serie ?? []).slice(-24));
        setByAge(d.byAge ?? []);
        setByCause(d.byCause ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [periodo]);

  useEffect(() => { load(); }, [load]);
  return { kpis, metas, serie, byAge, byCause, loading };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS 1 — Desempeño de partos
// ═══════════════════════════════════════════════════════════════════════════════
function DesempenoPartos({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("SEMANA");
  const { kpis, metas, serie, loading } = useAnalisis(periodo);

  function generarRecs(): Recomendacion[] {
    if (!kpis) return [];
    const recs: Recomendacion[] = [];

    const metaNV = metas.nacidosVivosAvg ?? 12;
    if (kpis.nacidosVivosAvg < metaNV) {
      recs.push({
        nivel: "warning",
        titulo: `Nacidos vivos por debajo de la meta`,
        descripcion: `El promedio actual es ${kpis.nacidosVivosAvg} lechones vivos/parto, contra la meta de ${metaNV}. Esto puede deberse a problemas nutricionales en gestación tardía, estrés calórico o exceso de ciclos reproductivos en las cerdas del plantel.`,
        accion: "Revisá la condición corporal al momento del parto (óptima: 3.0–3.5). Asegurate una ingesta mínima de 2.8 kg/día de alimento gestante en los últimos 30 días.",
      });
    } else {
      recs.push({ nivel: "success", titulo: "Nacidos vivos dentro de meta", descripcion: `Promedio actual: ${kpis.nacidosVivosAvg} lechones/parto. Meta: ${metaNV}. ✓` });
    }

    const metaPerd = metas.perdidasPct ?? 5;
    if (kpis.perdidasPct > metaPerd) {
      recs.push({
        nivel: "danger",
        titulo: `Pérdidas al nacimiento elevadas (${kpis.perdidasPct}%)`,
        descripcion: `Las pérdidas (nacidos muertos + momificados) superan la meta de ${metaPerd}%. El exceso de pérdidas en el nacimiento suele estar asociado a partos prolongados, asistencia insuficiente o camadas muy numerosas.`,
        accion: "Implementá un protocolo de asistencia al parto: presencia del encargado durante todo el proceso, oxitocina de rescate si supera 30 min entre lechones, secado y estimulación de lechones débiles.",
      });
    }

    if (kpis.pesoMedioNacimiento < 1.2) {
      recs.push({
        nivel: "danger",
        titulo: `Peso medio de nacimiento bajo (${kpis.pesoMedioNacimiento} kg)`,
        descripcion: `Los lechones con peso <1.0 kg tienen 3× más probabilidad de mortalidad y 20% menor GDP en engorde. Un peso ideal al nacimiento es >1.3 kg.`,
        accion: "Revisá la nutrición en el último trimestre de gestación: garantizá aporte adecuado de aminoácidos esenciales (lisina, treonina) y ácidos grasos omega-3. Controlá el número de cuerpos lúteos mediante ecografía.",
      });
    } else if (kpis.pesoMedioNacimiento >= 1.3) {
      recs.push({ nivel: "success", titulo: `Peso al nacimiento dentro del rango ideal (${kpis.pesoMedioNacimiento} kg)`, descripcion: "Un peso superior a 1.3 kg al nacimiento es indicativo de buena gestión nutricional en gestación. ✓" });
    }

    const metaNT = metas.nacidosTotalesAvg ?? 14;
    if (kpis.nacidosTotalesAvg < metaNT) {
      recs.push({
        nivel: "warning",
        titulo: `Nacidos totales por debajo de la meta (${kpis.nacidosTotalesAvg} vs meta ${metaNT})`,
        descripcion: "Un menor número de nacidos totales puede indicar baja tasa de ovulación o fallas en la detección de celo y el momento del servicio.",
        accion: "Verificá el protocolo de detección de celo (2× día), el timing de la inseminación (12-24h post-celo) y la calidad del semen. Considerá análisis genético del plantel.",
      });
    }

    return recs;
  }

  if (loading) return <Spinner />;
  if (!kpis || kpis.totalPartos === 0) return <EmptyAnalisis />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <KpiCard label="Total de partos"         value={kpis.totalPartos} />
        <KpiCard label="Nacidos totales (media)" value={kpis.nacidosTotalesAvg} meta={metas.nacidosTotalesAvg} />
        <KpiCard label="% Pérdidas nacimiento"   value={kpis.perdidasPct} unit="%" meta={metas.perdidasPct} inverse />
        <KpiCard label="Nacidos vivos (media)"   value={kpis.nacidosVivosAvg} meta={metas.nacidosVivosAvg} />
        <KpiCard label="Peso medio nacimiento"   value={kpis.pesoMedioNacimiento} unit=" kg" meta={metas.pesoMedioNacimiento} />
      </div>

      <ChartPanel title="Partos por período">
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={serie} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis dataKey="periodo" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "var(--bg-overlay)" }} />
            <Bar dataKey="partos" name="Partos" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ChartPanel title="Nacidos totales vs nacidos vivos">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={serie} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="periodo" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "var(--bg-overlay)" }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="nacidosTotales" name="Totales" fill="var(--accent)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="nacidosVivos"   name="Vivos"   fill="var(--success)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="% Pérdidas al nacimiento">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={serie} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="periodo" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => [`${v}%`]} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Line dataKey="pctMomificados"    name="% Momificados"    stroke="var(--danger)"  strokeWidth={2} dot={{ r: 2 }} />
              <Line dataKey="pctNacidosMuertos" name="% Nacidos muertos" stroke="var(--warning)" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <ChartPanel title="Peso medio al nacimiento (kg)">
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={serie} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis dataKey="periodo" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
            <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => [`${v} kg`]} />
            <Bar dataKey="pesoMedio" name="Peso medio (kg)" fill="var(--info)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <RecomendacionesPanel recomendaciones={generarRecs()} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS 2 — Mortalidad
// ═══════════════════════════════════════════════════════════════════════════════
function AnalisisMortalidad({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("SEMANA");
  const { kpis, metas, byAge, byCause, loading } = useAnalisis(periodo);

  function generarRecs(): Recomendacion[] {
    if (!kpis || kpis.totalMuertes === 0) return [];
    const recs: Recomendacion[] = [];
    const metaMort = metas.mortalidadPct ?? 12;

    if (kpis.mortalidadPct > metaMort) {
      recs.push({
        nivel: "danger",
        titulo: `Mortalidad por encima de la meta (${kpis.mortalidadPct}% vs meta ${metaMort}%)`,
        descripcion: `Se registraron ${kpis.totalMuertes} muertes en el período. Una tasa superior a ${metaMort}% indica problemas en el manejo neonatal que requieren atención inmediata.`,
        accion: "Auditá el protocolo de recepción de lechones: secado, temperatura de la sala (29–30 °C en la zona de lechones), acceso al calostro en las primeras 2 horas.",
      });
    } else {
      recs.push({ nivel: "success", titulo: `Mortalidad dentro de la meta (${kpis.mortalidadPct}%)`, descripcion: `La tasa de mortalidad es menor a la meta de ${metaMort}%. ✓ Mantené los protocolos actuales.` });
    }

    const topCause = byCause[0];
    if (topCause) {
      if (topCause.cause === "CRUSHING" && topCause.pct > 20) {
        recs.push({
          nivel: "warning",
          titulo: `Aplastamiento es la causa principal (${topCause.pct}% de las muertes)`,
          descripcion: "El aplastamiento generalmente ocurre en las primeras 72 horas. Está asociado al tamaño de la cerda, el diseño del corral y el exceso de lechones por camada.",
          accion: "Instalá barras anti-aplastamiento en todos los corrales. Supervisá especialmente las primeras 72 horas post-parto. Considerá reducir camadas a 12-13 lechones asignando el excedente a nodrizas.",
        });
      }
      if (topCause.cause === "WEAKNESS" && topCause.pct > 25) {
        recs.push({
          nivel: "warning",
          titulo: `Flaqueza es la causa principal (${topCause.pct}% de las muertes)`,
          descripcion: "La flaqueza neonatal suele estar asociada a bajo peso al nacimiento, baja producción láctea de la madre o competencia excesiva por pezones.",
          accion: "Identificá lechones <900 g al nacimiento y asignalos a cerdas nodrizas con alto potencial lácteo. Implementá el protocolo de calostro asistido: asegurate que cada lechón consuma al menos 200 ml en las primeras 4 horas.",
        });
      }
      if (topCause.cause === "DIARRHEA" && topCause.pct > 15) {
        recs.push({
          nivel: "danger",
          titulo: `Diarrea neonatal elevada (${topCause.pct}% de las muertes)`,
          descripcion: "La diarrea neonatal puede ser causada por E. coli, Clostridium o Rotavirus. Afecta principalmente lechones de 1-7 días.",
          accion: "Revisá el protocolo de vacunación de cerdas gestantes (vacuna E. coli / Clostridium en semana 4 y 2 antes del parto). Mejorá la limpieza y desinfección de corrales entre partos.",
        });
      }
    }

    const primeraEdad = byAge[0];
    if (primeraEdad && primeraEdad.pct > 60) {
      recs.push({
        nivel: "warning",
        titulo: `${primeraEdad.pct}% de las muertes ocurre en los primeros 5 días`,
        descripcion: "Una concentración tan alta de muertes en los primeros días indica problemas críticos en el período neonatal inmediato.",
        accion: "Establecé vigilancia intensiva (cada 2-3 horas) durante los primeros 5 días post-parto. Priorizá temperatura de la zona de lechones, acceso al calostro y separación de lechones débiles.",
      });
    }

    return recs;
  }

  if (loading) return <Spinner />;
  if (!kpis || kpis.totalPartos === 0) return <EmptyAnalisis />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />

      <div style={{ display: "flex", gap: 8 }}>
        <KpiCard label="Total de muertes" value={kpis.totalMuertes} />
        <KpiCard label="% Mortalidad" value={kpis.mortalidadPct} unit="%" meta={metas.mortalidadPct} inverse />
      </div>

      {byAge.length > 0 && (
        <ChartPanel title="Distribución por edad al momento de la muerte">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {byAge.map(b => (
              <div key={b.label} style={{
                background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: "10px 12px", textAlign: "center",
              }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>{b.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--danger)", lineHeight: 1 }}>{b.pct}%</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>{b.count} muertes</div>
              </div>
            ))}
          </div>
        </ChartPanel>
      )}

      {byCause.length > 0 && (
        <ChartPanel title="Muertes por causa">
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {byCause.map(c => (
              <div key={c.cause} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 160, flexShrink: 0 }}>{c.label}</span>
                <div style={{ flex: 1, height: 8, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${c.pct}%`, background: "var(--danger)", borderRadius: 99, transition: "width 0.6s ease" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--danger-text)", minWidth: 50, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {c.pct}%
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 40, textAlign: "right" }}>
                  ({c.count})
                </span>
              </div>
            ))}
          </div>
        </ChartPanel>
      )}

      <RecomendacionesPanel recomendaciones={generarRecs()} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS 3 — Rendimiento de destetes
// ═══════════════════════════════════════════════════════════════════════════════
function RendimientoDestetes({ onBack: _ }: { onBack: () => void }) {
  const [records, setRecords] = useState<WeanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/farrowing-events?active=false")
      .then(r => r.json())
      .then((d: Array<{ weaning?: WeanRecord | null }>) => {
        setRecords(d.filter(f => f.weaning).map(f => f.weaning as WeanRecord));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function groupByMonth(recs: WeanRecord[]) {
    const map = new Map<string, { count: number; days: number; weight: number; wc: number; piglets: number }>();
    for (const r of recs) {
      const k = r.weaningDate.slice(0, 7);
      const c = map.get(k) ?? { count: 0, days: 0, weight: 0, wc: 0, piglets: 0 };
      c.count++; c.days += r.lactationDays; c.piglets += r.pigletsWeaned;
      if (r.avgPigletWeightKg) { c.weight += r.avgPigletWeightKg; c.wc++; }
      map.set(k, c);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      mes:         `${k.slice(5)}/${k.slice(2, 4)}`,
      diasProm:    v.count > 0 ? +(v.days   / v.count).toFixed(1) : 0,
      pesoProm:    v.wc    > 0 ? +(v.weight / v.wc).toFixed(2)    : 0,
      destetados:  v.count > 0 ? +(v.piglets / v.count).toFixed(1) : 0,
      cantidad:    v.count,
    }));
  }

  function generarRecs(): Recomendacion[] {
    if (records.length === 0) return [];
    const recs: Recomendacion[] = [];
    const avgDays   = records.reduce((s, r) => s + r.lactationDays, 0) / records.length;
    const wRecs     = records.filter(r => r.avgPigletWeightKg != null);
    const avgWeight = wRecs.length > 0 ? wRecs.reduce((s, r) => s + Number(r.avgPigletWeightKg!), 0) / wRecs.length : 0;
    const avgPiglets = records.reduce((s, r) => s + r.pigletsWeaned, 0) / records.length;

    if (avgDays < 21) {
      recs.push({
        nivel: "warning",
        titulo: `Lactancia promedio corta (${avgDays.toFixed(1)} días)`,
        descripcion: "La lactancia óptima es de 21-28 días. Una lactancia corta reduce el desarrollo del sistema inmune del lechón y puede afectar el retorno al celo de la cerda.",
        accion: "Evaluá si el destete temprano está justificado por necesidad de espacio. Si no, extendé la lactancia al menos hasta los 21 días para mejorar inmunidad neonatal y BI (intervalo destete-celo).",
      });
    } else {
      recs.push({ nivel: "success", titulo: `Duración de lactancia adecuada (${avgDays.toFixed(1)} días)`, descripcion: "El promedio de lactancia es igual o superior a 21 días. ✓" });
    }

    if (avgWeight > 0 && avgWeight < 6.5) {
      recs.push({
        nivel: "warning",
        titulo: `Peso promedio al destete bajo (${avgWeight.toFixed(2)} kg)`,
        descripcion: "El peso óptimo al destete es de 6.5-8.0 kg. Un peso menor aumenta la mortalidad en iniciación y reduce los pesos finales al faene.",
        accion: "Mejorá la producción láctea de las madres: asegurate una ingesta de 6-8 kg/día de alimento lactante. Implantá creep feeding a partir del día 7 para estimular el desarrollo del aparato digestivo.",
      });
    } else if (avgWeight >= 6.5) {
      recs.push({ nivel: "success", titulo: `Peso al destete dentro del rango ideal (${avgWeight.toFixed(2)} kg)`, descripcion: "El peso promedio al destete supera los 6.5 kg recomendados. ✓" });
    }

    if (avgPiglets < 10) {
      recs.push({
        nivel: "info",
        titulo: `Promedio de lechones destetados por camada (${avgPiglets.toFixed(1)})`,
        descripcion: "Un promedio inferior a 10 lechones destetados puede indicar alta mortalidad en maternidad o camadas iniciales pequeñas.",
        accion: "Revisá el análisis de mortalidad para identificar las causas. Optimizá el uso de cerdas nodrizas para uniformizar y maximizar las camadas.",
      });
    }

    return recs;
  }

  if (loading) return <Spinner />;
  const byMonth = groupByMonth(records);
  if (byMonth.length === 0) return <EmptyAnalisis msg="Sin destetes registrados aún" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "Total destetes",       value: records.length },
          { label: "Días lactancia prom.",  value: +(records.reduce((s, r) => s + r.lactationDays, 0) / records.length).toFixed(1) },
          { label: "Peso prom. (kg)",       value: records.filter(r => r.avgPigletWeightKg).length > 0
              ? +(records.filter(r => r.avgPigletWeightKg).reduce((s, r) => s + Number(r.avgPigletWeightKg!), 0)
                / records.filter(r => r.avgPigletWeightKg).length).toFixed(2)
              : 0 },
          { label: "Lechones destetados Ø", value: +(records.reduce((s, r) => s + r.pigletsWeaned, 0) / records.length).toFixed(1) },
        ].map(k => (
          <div key={k.label} style={{
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: "14px 16px", flex: 1,
          }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ChartPanel title="Días promedio de lactancia por mes">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={byMonth} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
              <Tooltip contentStyle={TOOLTIP} />
              <Line dataKey="diasProm" name="Días lactancia" stroke="var(--info)" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Peso promedio al destete (kg/lechón)">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={byMonth} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => [`${v} kg`]} />
              <Bar dataKey="pesoProm" name="kg/lechón" fill="var(--success)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <ChartPanel title="Destetes registrados por mes">
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={byMonth} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
            <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP} />
            <Bar dataKey="cantidad" name="Destetes" fill="var(--accent)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPanel>

      <RecomendacionesPanel recomendaciones={generarRecs()} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANÁLISIS 4 — Comparativo vs metas
// ═══════════════════════════════════════════════════════════════════════════════
function ComparativoMetas({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("MES");
  const { kpis, metas, loading } = useAnalisis(periodo);

  function generarRecs(): Recomendacion[] {
    if (!kpis) return [];
    const problemas = [];
    if (kpis.nacidosVivosAvg < (metas.nacidosVivosAvg ?? 12)) problemas.push("nacidos vivos");
    if (kpis.perdidasPct > (metas.perdidasPct ?? 5)) problemas.push("pérdidas al nacimiento");
    if (kpis.pesoMedioNacimiento < (metas.pesoMedioNacimiento ?? 1.3)) problemas.push("peso medio nacimiento");
    if (kpis.mortalidadPct > (metas.mortalidadPct ?? 12)) problemas.push("mortalidad");

    if (problemas.length === 0) return [{ nivel: "success", titulo: "Todos los índices dentro de las metas", descripcion: "El módulo de Maternidad está operando dentro de los parámetros establecidos. Mantené los protocolos actuales. ✓" }];

    return [{
      nivel: "warning",
      titulo: `${problemas.length} indicador${problemas.length > 1 ? "es" : ""} fuera de meta`,
      descripcion: `Los siguientes indicadores requieren atención: ${problemas.join(", ")}. Abrí los análisis específicos para ver recomendaciones detalladas.`,
      accion: "Revisá el análisis de Desempeño de partos y Análisis de mortalidad para un diagnóstico más profundo.",
    }];
  }

  const INDICADORES = [
    { label: "Nacidos totales (media)", actual: kpis?.nacidosTotalesAvg, meta: metas.nacidosTotalesAvg, unit: "", inverse: false },
    { label: "Nacidos vivos (media)",   actual: kpis?.nacidosVivosAvg,   meta: metas.nacidosVivosAvg,   unit: "", inverse: false },
    { label: "% Pérdidas nacimiento",   actual: kpis?.perdidasPct,       meta: metas.perdidasPct,       unit: "%", inverse: true },
    { label: "Peso medio nacimiento",   actual: kpis?.pesoMedioNacimiento, meta: metas.pesoMedioNacimiento, unit: " kg", inverse: false },
    { label: "% Mortalidad",            actual: kpis?.mortalidadPct,      meta: metas.mortalidadPct,      unit: "%", inverse: true },
  ];

  if (loading) return <Spinner />;
  if (!kpis || kpis.totalPartos === 0) return <EmptyAnalisis />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />

      <div style={{
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
      }}>
        <div style={{ padding: "12px 16px", borderBottom: "0.5px solid var(--border-default)", background: "var(--bg-overlay)" }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Scorecard — {kpis.totalPartos} partos registrados
          </span>
        </div>
        {INDICADORES.map((ind, i) => {
          const onTarget = ind.actual !== undefined && ind.meta !== undefined
            ? (ind.inverse ? ind.actual <= ind.meta : ind.actual >= ind.meta)
            : null;
          const pct = ind.actual !== undefined && ind.meta !== undefined && ind.meta !== 0
            ? Math.min((ind.actual / ind.meta) * 100, 200)
            : 0;
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "200px 1fr 120px 80px",
              gap: 12, alignItems: "center", padding: "12px 16px",
              borderBottom: i < INDICADORES.length - 1 ? "0.5px solid var(--border-default)" : "none",
            }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ind.label}</span>
              <div style={{ height: 8, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(pct, 100)}%`,
                  background: onTarget === true ? "var(--success)" : onTarget === false ? "var(--danger)" : "var(--info)",
                  borderRadius: 99,
                }} />
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  {ind.actual !== undefined ? `${ind.actual}${ind.unit}` : "—"}
                </span>
                {ind.meta !== undefined && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>meta: {ind.meta}{ind.unit}</span>
                )}
              </div>
              <div style={{ textAlign: "center" }}>
                {onTarget !== null && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 4,
                    background: onTarget ? "var(--success-subtle)" : "var(--danger-subtle)",
                    color:      onTarget ? "var(--success-text)"   : "var(--danger-text)",
                    border:     `0.5px solid ${onTarget ? "var(--success-border)" : "var(--danger-border)"}`,
                  }}>
                    {onTarget ? "✓ Meta" : "✗ Meta"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <RecomendacionesPanel recomendaciones={generarRecs()} />
    </div>
  );
}

// ─── empty state helper ───────────────────────────────────────────────────────
function EmptyAnalisis({ msg = "Sin datos aún" }: { msg?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "60px 0", textAlign: "center",
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
    }}>
      <IconChartLine size={32} style={{ color: "var(--text-muted)", marginBottom: 8 }} />
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{msg}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GALERÍA
// ═══════════════════════════════════════════════════════════════════════════════
const CARDS: GalleryCard[] = [
  {
    id:          "partos",
    titulo:      "Desempeño de partos",
    descripcion: "Analice las tendencias de partos por período: nacidos vivos, pérdidas al nacimiento y peso medio. Identifique las semanas con mejor y peor rendimiento y reciba recomendaciones para mejorar sus índices reproductivos.",
    tags:        ["Partos", "Nacimientos", "Pérdidas", "Peso medio"],
    categoria:   "desempeño",
    color:       "var(--accent)",
    component:   DesempenoPartos,
  },
  {
    id:          "mortalidad",
    titulo:      "Análisis de mortalidad",
    descripcion: "Identifique las causas principales de mortalidad neonatal y la distribución por edad. Detecte patrones que permitan reducir las pérdidas y mejore el protocolo de manejo neonatal.",
    tags:        ["Mortalidad", "Causa", "Edad", "Tendencia"],
    categoria:   "analisis",
    color:       "var(--danger)",
    component:   AnalisisMortalidad,
  },
  {
    id:          "destetes",
    titulo:      "Rendimiento de destetes",
    descripcion: "Evalúe los índices de destete: días promedio de lactancia, peso promedio al destete y lechones destetados por camada. Detecte oportunidades de mejora en la producción láctea y la gestión de la lactancia.",
    tags:        ["Destete", "Lactancia", "Peso", "Lechones"],
    categoria:   "desempeño",
    color:       "var(--success)",
    component:   RendimientoDestetes,
  },
  {
    id:          "metas",
    titulo:      "Comparativo vs. metas",
    descripcion: "Compare todos los índices clave de maternidad contra las metas configuradas para su granja. Visualice rápidamente qué indicadores están fuera de rango y reciba un diagnóstico global.",
    tags:        ["Metas", "KPIs", "Scorecard", "Comparativo"],
    categoria:   "analisis",
    color:       "var(--info)",
    component:   ComparativoMetas,
  },
];

export function CentralAnalisisMaternidad() {
  return <AnalisisGallery cards={CARDS} />;
}
