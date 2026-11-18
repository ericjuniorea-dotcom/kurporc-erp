"use client";
// Maternidad · distribución de lechones por edad (se baja aparte)
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function GraficoEdades({ datos }: { datos: { label: string; count: number }[] }) {
  return (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={datos} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
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
                  {datos.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.label === "22+ días" ? "var(--danger)" : "var(--info)"}
                      opacity={entry.label === "22+ días" ? 1 : 0.75 + i * 0.05}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
  );
}
