"use client";
// Dashboard · gráficos de los últimos 12 meses (se bajan aparte para que la pantalla abra antes)
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

export interface ChartPoint {
  month:          string;
  partos:         number;
  bornAlive:      number;
  destetes:       number;
  lechDestetados: number;
  avgWeanWeight:  number | null;
  lossRate:       number;
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      padding: 14,
    }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{title}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: {name:string; value:number; color:string}[]; label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "0.5px solid var(--border-strong)",
      borderRadius: "var(--radius-md)",
      padding: "8px 12px",
      fontSize: 11,
    }}>
      <div style={{ color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-primary)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const CHART_AXIS = { fontSize: 10, fill: "var(--text-muted)" };

export function GraficosDashboard({ chart }: { chart: ChartPoint[] }) {
  return (
    <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <ChartCard title="Partos y nacidos vivos" sub="Últimos 12 meses">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chart} margin={{ top:0, right:0, left:-24, bottom:0 }} barGap={3}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border-default)" />
            <XAxis dataKey="month" tick={CHART_AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_AXIS} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="partos"    name="Partos"        fill="var(--accent)"   radius={[3,3,0,0]} maxBarSize={28} />
            <Bar dataKey="bornAlive" name="Nacidos vivos" fill="var(--danger-subtle)" radius={[3,3,0,0]} maxBarSize={28}
              style={{ stroke: "var(--danger)", strokeWidth: 0.5 }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Lechones destetados" sub="Por mes">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chart} margin={{ top:0, right:0, left:-24, bottom:0 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border-default)" />
            <XAxis dataKey="month" tick={CHART_AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_AXIS} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="lechDestetados" name="Destetados" fill="var(--info)" radius={[3,3,0,0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Peso medio al destete" sub="En kg">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chart} margin={{ top:0, right:0, left:-24, bottom:0 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border-default)" />
            <XAxis dataKey="month" tick={CHART_AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_AXIS} axisLine={false} tickLine={false} domain={[4, 10]} />
            <Tooltip content={<ChartTooltip />} formatter={(v: number) => [`${v} kg`, "Peso"]} />
            <Line type="monotone" dataKey="avgWeanWeight" name="Peso" stroke="var(--success)" strokeWidth={1.5} dot={{ r: 2, fill: "var(--success)" }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="% Pérdidas al nacimiento" sub="Muertos + momificados">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chart} margin={{ top:0, right:0, left:-24, bottom:0 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border-default)" />
            <XAxis dataKey="month" tick={CHART_AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={CHART_AXIS} axisLine={false} tickLine={false} unit="%" />
            <Tooltip content={<ChartTooltip />} formatter={(v: number) => [`${v}%`, "Pérdidas"]} />
            <Line type="monotone" dataKey="lossRate" name="% pérdidas" stroke="var(--warning)" strokeWidth={1.5} dot={{ r: 2, fill: "var(--warning)" }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
