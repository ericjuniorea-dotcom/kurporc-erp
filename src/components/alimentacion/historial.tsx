"use client";
import { useState, useEffect, useCallback } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

// Paleta de colores para las barras (por índice, ya que los nombres vienen del DB)
const PALETTE = ["#1D9E75", "#E07C2E", "#378ADD", "#A31621", "#185FA5", "#639922", "#D4537E", "#8E44AD"];

const TOOLTIP_STYLE = {
  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
  borderRadius: 8, fontSize: 11, color: "var(--text-primary)",
};

const PERIODO_OPTS = [
  { key: "semana",    days: 7,   label: "Semana"    },
  { key: "mes",       days: 30,  label: "Mes"       },
  { key: "trimestre", days: 90,  label: "Trimestre" },
];

const FASE_OPTS = [
  { key: "",           label: "Todas las fases" },
  { key: "gestacion",  label: "Gestación"       },
  { key: "maternidad", label: "Maternidad"      },
  { key: "iniciacion", label: "Iniciación"       },
  { key: "engorde",    label: "Engorde"         },
];

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", padding: "14px 16px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function Historial() {
  const [records,       setRecords]       = useState<any[]>([]);
  const [consumo,       setConsumo]       = useState<any[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [periodo,       setPeriodo]       = useState("mes");
  const [faseFilter,    setFaseFilter]    = useState("");
  const [feedTypeNames, setFeedTypeNames] = useState<string[]>([]);

  const [desde, setDesde] = useState(() => fmtDate(addDays(new Date(), -30)));
  const [hasta, setHasta] = useState(() => fmtDate(new Date()));

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams({ desde, hasta });
    if (faseFilter) p.set("fase", faseFilter);
    fetch(`/api/alimentacion/historial?${p}`)
      .then(r => r.json())
      .then(d => {
        setRecords(d.records ?? []);
        setConsumo(d.consumoSemanal ?? []);
        // extract all feedType names from the data
        const names = new Set<string>();
        (d.consumoSemanal ?? []).forEach((row: any) => {
          Object.keys(row).filter(k => k !== "semana" && k !== "total").forEach(k => names.add(k));
        });
        setFeedTypeNames(Array.from(names));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [desde, hasta, faseFilter]);

  useEffect(() => { load(); }, [load]);

  function setPeriodoPreset(p: string) {
    const days = PERIODO_OPTS.find(o => o.key === p)?.days ?? 30;
    setDesde(fmtDate(addDays(new Date(), -days)));
    setHasta(fmtDate(new Date()));
    setPeriodo(p);
  }

  // Empleados
  const empleadoMap = new Map<string, { count: number; kgTotal: number }>();
  for (const r of records) {
    if (r.empleadoId) {
      const cur = empleadoMap.get(r.empleadoId) ?? { count: 0, kgTotal: 0 };
      cur.count++;
      cur.kgTotal += r.quantityKg;
      empleadoMap.set(r.empleadoId, cur);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filtros */}
      <div style={{
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", padding: "12px 14px",
        display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
      }}>
        <div style={{
          display: "flex", background: "var(--bg-overlay)", borderRadius: "var(--radius-md)",
          padding: 2, border: "0.5px solid var(--border-default)", gap: 2,
        }}>
          {PERIODO_OPTS.map(o => (
            <button key={o.key} onClick={() => setPeriodoPreset(o.key)} style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
              background: periodo === o.key ? "var(--bg-surface)" : "transparent",
              color:      periodo === o.key ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: periodo === o.key ? 500 : 400,
            }}>{o.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="kp-input" style={{ fontSize: 11, height: 28, width: 130 }} />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="kp-input" style={{ fontSize: 11, height: 28, width: 130 }} />
        </div>

        <select
          value={faseFilter}
          onChange={e => setFaseFilter(e.target.value)}
          className="kp-input" style={{ fontSize: 11, height: 28 }}
        >
          {FASE_OPTS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>

        <button className="btn" onClick={load} style={{ fontSize: 11 }}>Filtrar</button>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 8 }}>
          <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando...</span>
        </div>
      ) : (
        <>
          {/* Gráfico consumo semanal */}
          {consumo.length > 0 && (
            <ChartPanel title="Consumo semanal por tipo de alimento (kg)">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={consumo} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="semana" tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "var(--bg-overlay)" }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  {feedTypeNames.map((name, idx) => (
                    <Bar key={name} dataKey={name} stackId="a" fill={PALETTE[idx % PALETTE.length]} radius={[0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          )}

          {/* Tabla */}
          <div style={{
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", overflow: "hidden",
          }}>
            <div style={{ padding: "10px 14px", borderBottom: "0.5px solid var(--border-default)", background: "var(--bg-overlay)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Registros ({records.length})
              </span>
            </div>
            {records.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                Sin registros en el período seleccionado
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="kp-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Animal / Lote</th>
                      <th>Tipo alimento</th>
                      <th style={{ textAlign: "right" }}>Kg entregados</th>
                      <th>Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.recordDate}</td>
                        <td style={{ fontWeight: 500 }}>{r.label}</td>
                        <td>
                          <span style={{
                            fontSize: 10, padding: "2px 6px", borderRadius: 4,
                            background: "var(--bg-overlay)", color: "var(--text-muted)",
                            border: "0.5px solid var(--border-default)",
                          }}>
                            {r.feedTypeName}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                          {r.quantityKg.toLocaleString("es-PY")} kg
                        </td>
                        <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {new Date(r.createdAt).toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
