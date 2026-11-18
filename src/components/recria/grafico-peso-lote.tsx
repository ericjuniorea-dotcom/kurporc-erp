"use client";
// Iniciación · evolución del peso promedio del lote (se baja al expandir la tarjeta)
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export function GraficoPesoLote({ datos }: { datos: { date: string; avgWeightKg: number }[] }) {
  return (
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={datos}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-surface)",
                        border: "0.5px solid var(--border-strong)",
                        borderRadius: "var(--radius-md)",
                        fontSize: 11,
                      }}
                      formatter={(v: number) => [`${v.toFixed(2)} kg`, "Peso medio"]}
                    />
                    <Line type="monotone" dataKey="avgWeightKg" stroke="var(--accent)" strokeWidth={1.5} dot={{ r: 2, fill: "var(--accent)" }} />
                  </LineChart>
                </ResponsiveContainer>
  );
}
