"use client";
// Gestación · distribución de gestantes por día de gestación (se baja aparte)
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function GraficoDistribucion({ distribucion }: { distribucion: { rango: string; cantidad: number }[] }) {
  return (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distribucion} margin={{ top: 4, right: 12, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis
                dataKey="rango"
                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false} tickLine={false} width={28}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "0.5px solid var(--border-default)",
                  borderRadius: 8, fontSize: 11,
                }}
                labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                itemStyle={{ color: "var(--text-secondary)" }}
                formatter={(v: number) => [v, "Cerdas"]}
                cursor={{ fill: "var(--bg-overlay)" }}
              />
              <Bar dataKey="cantidad" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={100} />
            </BarChart>
          </ResponsiveContainer>
  );
}
