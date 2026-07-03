"use client";
import { useState, useEffect, useCallback } from "react";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface AnalisisData {
  kpis: { gdpPromedio: number | null; mortalidadPct: number; pesosActuales: number[] };
  gdpSemanal: { semana: string; gdp: number }[];
  mortalidadSemanal: { semana: string; count: number }[];
  causasMortalidad: { causa: string; count: number }[];
  curvaPeso: {
    batchCode: string; sitio: string | null;
    pesoActual: number; targetKg: number; pctProgreso: number;
    gdp: number | null; gdpStatus: "ok" | "warn" | "bad" | null;
  }[];
  rendimientoLotes: {
    batchCode: string; sitio: string | null;
    currentCount: number; diasAlojamiento: number;
    pesoActual: number; gdp: number | null; mortalidadPct: number;
    estimatedExitDate: string | null;
    gdpStatus: "ok" | "warn" | "bad" | null;
  }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function gdpColor(s: "ok" | "warn" | "bad" | null) {
  if (s === "ok")  return "var(--engorde-accent)";
  if (s === "warn") return "var(--warning)";
  if (s === "bad")  return "var(--danger)";
  return "var(--text-muted)";
}
function mortColor(pct: number) {
  if (pct <= 1.0) return "var(--engorde-accent)";
  if (pct <= 1.5) return "var(--warning)";
  return "var(--danger)";
}
function formatFecha(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── BarChart simple ────────────────────────────────────────────────────────
function BarChart({
  items, colorFn, meta, metaLabel, unit = "", height = 100,
}: {
  items: { label: string; value: number }[];
  colorFn: (v: number, i: number) => string;
  meta?: number; metaLabel?: string; unit?: string; height?: number;
}) {
  if (!items.length) return (
    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "24px 0", textAlign: "center" }}>Sin datos</div>
  );
  const maxV = Math.max(...items.map(i => i.value), meta ?? 0, 1);
  const metaPct = meta != null ? (meta / maxV) * 100 : null;

  return (
    <div style={{ position: "relative", paddingBottom: 22 }}>
      {metaPct != null && (
        <>
          <div style={{ position: "absolute", bottom: `calc(22px + ${metaPct}%)`, left: 0, right: 0, height: 1, borderTop: "1.5px dashed var(--border-strong)", zIndex: 1 }} />
          <span style={{ position: "absolute", bottom: `calc(22px + ${metaPct}% + 3px)`, right: 0, fontSize: 9, color: "var(--text-muted)" }}>
            {metaLabel ?? `meta ${meta}`}
          </span>
        </>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height }}>
        {items.map((item, i) => {
          const pct = (item.value / maxV) * 100;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2 }}>{item.value}</div>
              <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                <div style={{ width: "100%", height: `${pct}%`, minHeight: 3, background: colorFn(item.value, i), borderRadius: "3px 3px 0 0", transition: "height 0.3s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {items.map((item, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Barra horizontal ─────────────────────────────────────────────────────
function HBarChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  if (!items.length) return <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "12px 0" }}>Sin datos</div>;
  const maxV = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 160, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
          <div style={{ flex: 1, height: 12, background: "var(--bg-overlay)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(item.value / maxV) * 100}%`, background: item.color, borderRadius: 3, transition: "width 0.3s" }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--text-muted)", width: 24, textAlign: "right", flexShrink: 0 }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── KPI card pequeña ───────────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 120, padding: "10px 14px",
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
    }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: color ?? "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export function CentralAnalisisEngorde() {
  const today = new Date().toISOString().split("T")[0];
  const defDesde = new Date(); defDesde.setDate(defDesde.getDate() - 90);

  const [desde, setDesde] = useState(defDesde.toISOString().split("T")[0]);
  const [hasta, setHasta] = useState(today);
  const [data, setData] = useState<AnalisisData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string, h: string) => {
    setLoading(true);
    const r = await fetch(`/api/engorde/analisis?desde=${d}&hasta=${h}`);
    if (r.ok) setData(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(desde, hasta); }, [load, desde, hasta]);

  function setPeriodo(dias: number) {
    const h = new Date().toISOString().split("T")[0];
    const d = new Date(); d.setDate(d.getDate() - dias);
    setDesde(d.toISOString().split("T")[0]);
    setHasta(h);
  }

  const causaColor = (i: number) => i === 0 ? "rgba(226,75,74,0.7)" : i <= 2 ? "rgba(239,159,39,0.7)" : "var(--bg-overlay)";
  const CAUSA_LABELS: Record<string, string> = {
    RESPIRATORY: "Resp.", DIGESTIVE: "Digest.", ACCIDENT: "Accidente",
    RENAL_URINARY: "Renal/urin.", MULBERRY_HEART: "Mulberry", OTHER: "Otra",
  };

  if (loading) return <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 12 }}>Cargando análisis...</div>;
  if (!data)   return null;

  return (
    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Filtro sticky */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 10,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          padding: "10px 0 10px",
          background: "var(--bg-base)",
          borderBottom: "0.5px solid var(--border-default)",
        }}
      >
        {[["7d", 7], ["30d", 30], ["90d", 90], ["365d", 365]].map(([label, dias]) => (
          <button key={label}
            className="btn"
            style={{ fontSize: 11, padding: "0 10px", height: 28 }}
            onClick={() => setPeriodo(Number(dias))}
          >
            {label}
          </button>
        ))}
        <input className="kp-input" type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 130, height: 28 }} />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
        <input className="kp-input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 130, height: 28 }} />
      </div>

      {/* KPIs */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <KpiCard label="GDP promedio período" value={data.kpis.gdpPromedio != null ? `${data.kpis.gdpPromedio} g/día` : "—"}
          color={data.kpis.gdpPromedio != null ? (data.kpis.gdpPromedio >= 800 ? "var(--success)" : data.kpis.gdpPromedio >= 700 ? "var(--warning)" : "var(--danger)") : undefined} />
        <KpiCard label="Mortalidad %" value={`${data.kpis.mortalidadPct.toFixed(2)}%`}
          color={mortColor(data.kpis.mortalidadPct)} />
        <KpiCard label="Peso medio actual" value={
          data.kpis.pesosActuales.length > 0
            ? `${(data.kpis.pesosActuales.reduce((a, b) => a + b, 0) / data.kpis.pesosActuales.length).toFixed(1)} kg`
            : "—"
        } />
      </div>

      {/* Gráficos fila 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* GDP semanal */}
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>GDP semanal (g/día)</div>
          <BarChart
            items={data.gdpSemanal.map(s => ({ label: s.semana, value: s.gdp }))}
            colorFn={v => v >= 800 ? "var(--engorde-accent)" : v >= 700 ? "var(--warning)" : "var(--danger)"}
            meta={800} metaLabel="meta 800 g" height={110}
          />
        </div>

        {/* Mortalidad semanal */}
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Mortalidad semanal (animales)</div>
          <BarChart
            items={data.mortalidadSemanal.map(s => ({ label: s.semana, value: s.count }))}
            colorFn={v => v === 0 ? "var(--bg-overlay)" : v <= 3 ? "var(--warning)" : "var(--danger)"}
            height={110}
          />
        </div>
      </div>

      {/* Gráficos fila 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Causas de mortalidad */}
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Causas de mortalidad</div>
          <HBarChart
            items={data.causasMortalidad.map((c, i) => ({
              label: CAUSA_LABELS[c.causa] ?? c.causa,
              value: c.count,
              color: causaColor(i),
            }))}
          />
        </div>

        {/* Curva de peso */}
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>Peso actual vs objetivo por lote</div>
          {!data.curvaPeso.length ? (
            <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "12px 0" }}>Sin lotes activos</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.curvaPeso.map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 70, flexShrink: 0 }}>{l.batchCode}</span>
                  <div style={{ flex: 1, height: 12, background: "var(--bg-overlay)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                    <div style={{ height: "100%", width: `${l.pctProgreso}%`, background: gdpColor(l.gdpStatus), borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", width: 36, textAlign: "right", flexShrink: 0 }}>
                    {l.pesoActual}/{l.targetKg}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla rendimiento */}
      <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
          Rendimiento por lote — comparativo
        </div>
        {!data.rendimientoLotes.length ? (
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Sin lotes activos en el período</div>
        ) : (
          <table className="kp-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th style={{ textAlign: "right" }}>Animales</th>
                <th style={{ textAlign: "right" }}>Días aloj.</th>
                <th style={{ textAlign: "right" }}>Peso actual</th>
                <th style={{ textAlign: "right" }}>GDP</th>
                <th style={{ textAlign: "right" }}>Mortalidad</th>
                <th>Salida estimada</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.rendimientoLotes.map((l, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{l.batchCode}</td>
                  <td style={{ textAlign: "right", fontSize: 12 }}>{l.currentCount.toLocaleString("es-PY")}</td>
                  <td style={{ textAlign: "right", fontSize: 12 }}>{l.diasAlojamiento}</td>
                  <td style={{ textAlign: "right", fontSize: 12 }}>{l.pesoActual > 0 ? `${l.pesoActual} kg` : "—"}</td>
                  <td style={{ textAlign: "right", fontSize: 12, fontWeight: 600, color: gdpColor(l.gdpStatus) }}>
                    {l.gdp != null ? `${l.gdp} g` : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontSize: 12, color: mortColor(l.mortalidadPct) }}>
                    {l.mortalidadPct.toFixed(2)}%
                  </td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatFecha(l.estimatedExitDate)}</td>
                  <td>
                    {l.gdpStatus === "bad"  && <span className="badge badge-danger"  style={{ fontSize: 10 }}>GDP baja</span>}
                    {l.gdpStatus === "warn" && <span className="badge badge-warning" style={{ fontSize: 10 }}>GDP lenta</span>}
                    {l.gdpStatus === "ok"   && <span className="badge badge-success" style={{ fontSize: 10 }}>OK</span>}
                    {l.gdpStatus == null    && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Sin pesaje</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
