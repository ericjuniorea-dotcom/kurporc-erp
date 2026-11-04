"use client";
import { useState, useEffect, useCallback } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  ReferenceLine, Cell,
} from "recharts";
import { AnalisisGallery, RecomendacionesPanel, type GalleryCard, type Recomendacion } from "@/components/shared/analisis-gallery";

const TOOLTIP_STYLE = {
  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
  borderRadius: 8, fontSize: 11, color: "var(--text-primary)",
};

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

const PERIOD_OPTS = [
  { key: "mes",       days: 30,  label: "Mes"       },
  { key: "trimestre", days: 90,  label: "Trimestre" },
  { key: "semestre",  days: 180, label: "Semestre"  },
  { key: "año",       days: 365, label: "Año"       },
];

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
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
          background: value === o.key ? "var(--info)" : "transparent",
          color:      value === o.key ? "#fff"        : "var(--text-muted)",
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
    const hasta = fmtDate(new Date());
    setLoading(true);
    fetch(`/api/sanidad/analisis?desde=${desde}&hasta=${hasta}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [periodo]);

  useEffect(() => { load(); }, [load]);
  return { data, loading };
}

// ═══ ANÁLISIS 1 — Cumplimiento del calendario ════════════════════════════════
function CumplimientoCalendario({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading }     = useAnalisis(periodo);
  const META = 90;

  function recs(): Recomendacion[] {
    if (!data?.kpis) return [];
    const r: Recomendacion[] = [];
    const c = data.kpis.cumplimientoPromedio;
    if (c >= META) {
      r.push({ nivel: "success", titulo: `Cumplimiento óptimo (${c}%)`, descripcion: `El calendario de vacunación se está cumpliendo dentro de la meta de ${META}%. ✓` });
    } else if (c >= 75) {
      r.push({ nivel: "warning", titulo: `Cumplimiento por debajo de la meta (${c}% vs ${META}%)`, descripcion: "Hay aplicaciones que se están registrando tarde respecto a la fecha programada.", accion: "Revisá el flujo de Visión General todos los días y priorizá las tareas retrasadas." });
    } else {
      r.push({ nivel: "danger", titulo: `Cumplimiento crítico (${c}%)`, descripcion: "Una gran parte del calendario de vacunación se aplica fuera de fecha, lo que puede dejar animales sin protección efectiva.", accion: "Auditá el proceso de registro diario y confirmá que haya suficiente stock disponible para no atrasar aplicaciones." });
    }
    if (data.kpis.tasaRetraso > 15) {
      r.push({ nivel: "warning", titulo: `${data.kpis.tasaRetraso}% de los eventos del período están retrasados`, descripcion: "Una tasa de retraso alta suele estar asociada a falta de stock o de personal disponible en el momento de aplicar." });
    }
    return r;
  }

  if (loading) return <Spinner />;
  const semanal: any[] = data?.cumplimientoSemanal ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: "Aplicaciones en el período", value: `${data?.kpis?.totalAplicaciones ?? 0}` },
          { label: "Cumplimiento promedio",       value: `${data?.kpis?.cumplimientoPromedio ?? 100}%` },
          { label: "Tasa de retraso",             value: `${data?.kpis?.tasaRetraso ?? 0}%` },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "12px 16px", flex: 1 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {semanal.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin eventos programados en el período</div>
      ) : (
        <ChartPanel title="Cumplimiento semanal (%)" subtitle={`Meta: ≥${META}%`}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={semanal} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
              <XAxis dataKey="semana" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [`${v}%`]} />
              <ReferenceLine y={META} stroke="var(--success)" strokeDasharray="4 2" label={{ value: `meta ${META}%`, position: "right", fill: "var(--success)", fontSize: 9 }} />
              <Bar dataKey="pct" name="Cumplimiento" radius={[3, 3, 0, 0]}>
                {semanal.map((s: any) => (
                  <Cell key={s.semana} fill={s.pct >= META ? "var(--success)" : s.pct >= 75 ? "var(--warning)" : "var(--danger)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      )}
      <RecomendacionesPanel recomendaciones={recs()} />
    </div>
  );
}

// ═══ ANÁLISIS 2 — Distribución por sector ════════════════════════════════════
function DistribucionSector({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading }     = useAnalisis(periodo);

  function recs(): Recomendacion[] {
    if (!data?.distribucionSector?.length) return [];
    const top = data.distribucionSector[0];
    return [{ nivel: "info", titulo: `${top.label} concentra el ${top.pct}% de las aplicaciones`, descripcion: `Con ${top.dosis} dosis aplicadas es el sector con mayor actividad sanitaria en el período.` }];
  }

  if (loading) return <Spinner />;
  const dist: any[] = data?.distribucionSector ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      {dist.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin aplicaciones registradas en el período</div>
      ) : (
        <ChartPanel title="Dosis aplicadas por sector">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dist.map((d: any) => (
              <div key={d.sector} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 160, flexShrink: 0 }}>{d.label}</span>
                <div style={{ flex: 1, height: 10, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${d.pct}%`, background: "var(--info)", borderRadius: 99, transition: "width 0.6s" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, minWidth: 44, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{d.pct}%</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 70, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{d.dosis} dosis</span>
              </div>
            ))}
          </div>
        </ChartPanel>
      )}
      <RecomendacionesPanel recomendaciones={recs()} />
    </div>
  );
}

// ═══ ANÁLISIS 3 — Ranking de productos aplicados ═════════════════════════════
function RankingProductos({ onBack: _ }: { onBack: () => void }) {
  const [periodo, setPeriodo] = useState("trimestre");
  const { data, loading }     = useAnalisis(periodo);

  if (loading) return <Spinner />;
  const ranking: any[] = data?.rankingVacunas ?? [];
  const max = Math.max(1, ...ranking.map((r: any) => r.dosis));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PeriodFilter value={periodo} onChange={setPeriodo} />
      {ranking.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>Sin aplicaciones registradas en el período</div>
      ) : (
        <ChartPanel title="Productos más aplicados" subtitle="Top 10 por dosis en el período">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ranking.map((r: any) => (
              <div key={r.vacunaId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 180, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  {r.codigo && <span style={{ fontFamily: "monospace", fontSize: 9, color: "var(--accent)" }}>{r.codigo}</span>}
                  {r.nombre}
                </span>
                <div style={{ flex: 1, height: 10, background: "var(--bg-overlay)", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(r.dosis / max) * 100}%`, background: "var(--accent)", borderRadius: 99, transition: "width 0.6s" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, minWidth: 60, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{r.dosis} dosis</span>
              </div>
            ))}
          </div>
        </ChartPanel>
      )}
    </div>
  );
}

// ─── Galería ───────────────────────────────────────────────────────────────────
const CARDS: GalleryCard[] = [
  {
    id: "cumplimiento",
    titulo: "Cumplimiento del calendario",
    descripcion: "Vea la evolución semanal del % de vacunaciones aplicadas a tiempo respecto a lo programado. Detecte caídas de cumplimiento antes de que se conviertan en un problema sanitario.",
    tags: ["Cumplimiento", "Calendario", "Tendencia"],
    categoria: "desempeño",
    color: "var(--info)",
    component: CumplimientoCalendario,
  },
  {
    id: "sector",
    titulo: "Distribución por sector",
    descripcion: "Vea qué sector (Plantel, Gestación, Maternidad, Iniciación) concentra la mayor actividad sanitaria del período.",
    tags: ["Sectores", "Distribución", "Dosis"],
    categoria: "analisis",
    color: "var(--accent)",
    component: DistribucionSector,
  },
  {
    id: "ranking",
    titulo: "Productos más aplicados",
    descripcion: "Ranking de vacunas, suplementos y medicamentos por dosis aplicadas en el período — útil para anticipar reposición.",
    tags: ["Ranking", "Productos", "Dosis"],
    categoria: "listado",
    color: "var(--success)",
    component: RankingProductos,
  },
];

export function CentralAnalisisSanidad() {
  return <AnalisisGallery cards={CARDS} />;
}
