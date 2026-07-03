"use client";
import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  IconHeartPlus, IconAlertTriangle, IconLoader2, IconRefresh, IconBabyCarriage,
} from "@tabler/icons-react";

interface KpiData {
  hembras:         number;
  lechones:        number;
  mortalidad:      number;
  ageDistribution: { label: string; count: number }[];
  inconsistencias: {
    farrowingId:         string;
    sowCode:             string;
    location:            string | null;
    pen:                 string | null;
    dias:                number;
    expectedWeaningDate: string;
  }[];
}

function KpiCard({
  label, value, sub, color,
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background:   "var(--bg-surface)",
      border:       "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      padding:      "16px 20px",
      flex:         1,
      minWidth:     0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color ?? "var(--text-primary)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

export function VisionGeneralMaternidad() {
  const [data,    setData]    = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/maternidad/kpis")
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 8 }}>
        <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando datos...</span>
      </div>
    );
  }

  if (!data) return null;

  const mortalidadColor = data.mortalidad > 10 ? "var(--danger)" : data.mortalidad > 5 ? "var(--warning)" : "var(--success)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* KPI strip */}
      <div style={{ display: "flex", gap: 12 }}>
        <KpiCard
          label="Hembras en maternidad"
          value={data.hembras}
          sub="partos activos"
          color="var(--accent)"
        />
        <KpiCard
          label="Lechones activos"
          value={data.lechones.toLocaleString("es-PY")}
          sub="en lactancia"
          color="var(--info)"
        />
        <KpiCard
          label="Mortalidad lactante"
          value={`${data.mortalidad}%`}
          sub={data.mortalidad > 10 ? "⚠ Por encima del umbral" : "Dentro del objetivo"}
          color={mortalidadColor}
        />
      </div>

      {/* Gráfico + Inconsistencias */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

        {/* Distribución por edad */}
        <div style={{
          background:   "var(--bg-surface)",
          border:       "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          padding:      "16px",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
            Distribución de lechones por edad
          </div>
          {data.ageDistribution.every(d => d.count === 0) ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: "var(--text-muted)", fontSize: 12 }}>
              <IconBabyCarriage size={24} style={{ marginRight: 8 }} />
              Sin lechones activos
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.ageDistribution} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background:   "var(--bg-surface)",
                    border:       "0.5px solid var(--border-default)",
                    borderRadius: 8,
                    fontSize:     12,
                    color:        "var(--text-primary)",
                  }}
                  cursor={{ fill: "var(--bg-overlay)" }}
                />
                <Bar dataKey="count" name="Lechones" radius={[4, 4, 0, 0]}>
                  {data.ageDistribution.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.label === "22+ días" ? "var(--danger)" : "var(--info)"}
                      opacity={entry.label === "22+ días" ? 1 : 0.75 + i * 0.05}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Inconsistencias */}
        <div style={{
          background:   "var(--bg-surface)",
          border:       "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
          overflow:     "hidden",
        }}>
          <div style={{
            padding:      "12px 16px",
            borderBottom: "0.5px solid var(--border-default)",
            display:      "flex",
            alignItems:   "center",
            gap:          8,
          }}>
            <IconAlertTriangle size={14} style={{ color: "var(--warning)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Inconsistencias
            </span>
            {data.inconsistencias.length > 0 && (
              <span style={{
                marginLeft: "auto",
                background: "var(--warning-subtle)",
                color:      "var(--warning-text)",
                border:     "0.5px solid var(--warning)",
                borderRadius: 99,
                fontSize:   10,
                padding:    "1px 8px",
                fontWeight: 500,
              }}>
                {data.inconsistencias.length}
              </span>
            )}
          </div>

          {data.inconsistencias.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin inconsistencias detectadas</div>
            </div>
          ) : (
            <div style={{ overflowY: "auto", maxHeight: 260 }}>
              <table className="kp-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Cerda</th>
                    <th>Ubicación</th>
                    <th>Días</th>
                    <th>Problema</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inconsistencias.map((inc) => (
                    <tr key={inc.farrowingId}>
                      <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{inc.sowCode}</td>
                      <td style={{ color: "var(--text-muted)" }}>
                        {inc.location ?? "—"}{inc.pen ? ` C.${inc.pen}` : ""}
                      </td>
                      <td>
                        <span style={{
                          background:   "var(--warning-subtle)",
                          color:        "var(--warning-text)",
                          border:       "0.5px solid var(--warning)",
                          borderRadius: 4,
                          padding:      "1px 6px",
                          fontSize:     11,
                          fontWeight:   500,
                        }}>
                          {inc.dias}d
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--warning-text)" }}>
                        Lechones con {inc.dias} días de edad
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Botón actualizar */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn" onClick={load} style={{ fontSize: 11 }}>
          <IconRefresh size={12} />
          Actualizar datos
        </button>
      </div>
    </div>
  );
}
