"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import {
  IconLayoutDashboard, IconPig, IconHeartPlus, IconBuildingWarehouse,
  IconShield, IconAlertTriangle, IconBell,
  IconTrendingUp, IconTrendingDown, IconMinus, IconRefresh,
} from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";

interface KPIs {
  activeSows:             number;
  activeFarrowings:       number;
  activeNurseryBatches:   number;
  pendingHealthTasks:     number;
  overdueHealthTasks:     number;
  unreadAlerts:           number;
  farrowings30d:          number;
  weanings30d:            number;
  totalWeaned30d:         number;
  birthLossRate:          string | null;
  avgLactDays:            number | null;
  avgWeanWeight:          string | null;
  avgGdpGday:             string | null;
  paritionRate:           number | null;
}

interface ChartPoint {
  month:          string;
  partos:         number;
  bornAlive:      number;
  destetes:       number;
  lechDestetados: number;
  avgWeanWeight:  number | null;
  lossRate:       number;
}

function KpiCard({
  label, value, sub, icon: Icon, iconColor, href, delta,
}: {
  label:      string;
  value:      string | number | null;
  sub?:       string;
  icon:       React.ElementType;
  iconColor?: string;
  href?:      string;
  delta?:     "up" | "down" | "neutral";
}) {
  const card = (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 14px",
        cursor: href ? "pointer" : "default",
        transition: "border-color 0.1s",
      }}
      onMouseEnter={(e) => { if (href) e.currentTarget.style.borderColor = "var(--border-strong)"; }}
      onMouseLeave={(e) => { if (href) e.currentTarget.style.borderColor = "var(--border-default)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 5 }}>
          <Icon size={13} style={{ color: iconColor ?? "var(--text-muted)" }} aria-hidden />
          {label}
        </span>
        {delta && (
          <span>
            {delta === "up"      && <IconTrendingUp  size={12} style={{ color: "var(--success)" }} />}
            {delta === "down"    && <IconTrendingDown size={12} style={{ color: "var(--danger)" }} />}
            {delta === "neutral" && <IconMinus       size={12} style={{ color: "var(--text-muted)" }} />}
          </span>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1 }}>
        {value ?? "—"}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{card}</Link> : card;
}

function SkeletonCard() {
  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)",
      padding: "12px 14px",
      height: 92,
    }}>
      <div style={{ height: 10, width: 80, background: "var(--bg-overlay)", borderRadius: 4, marginBottom: 10 }} />
      <div style={{ height: 22, width: 50, background: "var(--bg-overlay)", borderRadius: 4, marginBottom: 8 }} />
      <div style={{ height: 8, width: 60, background: "var(--bg-overlay)", borderRadius: 4 }} />
    </div>
  );
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

export default function DashboardPage() {
  const [kpis,     setKpis]     = useState<KPIs | null>(null);
  const [chart,    setChart]    = useState<ChartPoint[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [tab,      setTab]      = useState("overview");

  function load() {
    setLoading(true); setError(false);
    Promise.all([
      fetch("/api/dashboard/kpis").then((r) => { if (!r.ok) throw 0; return r.json(); }),
      fetch("/api/dashboard/chart-data").then((r) => { if (!r.ok) throw 0; return r.json(); }),
    ])
      .then(([k, c]) => { setKpis(k); setChart(c); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const paritionDelta =
    !kpis?.paritionRate     ? "neutral" :
    kpis.paritionRate >= 80 ? "up"      :
    kpis.paritionRate >= 65 ? "neutral" : "down";

  const gdpDelta =
    !kpis?.avgGdpGday               ? "neutral" :
    Number(kpis.avgGdpGday) >= 300  ? "up"      :
    Number(kpis.avgGdpGday) >= 200  ? "neutral" : "down";

  return (
    <>
      <Topbar
        title="Dashboard"
        icon={IconLayoutDashboard}
        iconColor="var(--accent)"
        tabs={[
          { key: "overview", label: "Visión general" },
          { key: "charts",   label: "Gráficos" },
        ]}
        activeTab={tab}
        onTabChange={setTab}
        actions={
          <button className="btn" onClick={load} title="Actualizar">
            <IconRefresh size={13} aria-hidden />
            Actualizar
          </button>
        }
      />

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Alertas críticas */}
        {kpis && (kpis.overdueHealthTasks > 0 ||kpis.unreadAlerts > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {kpis.overdueHealthTasks > 0 && (
              <Link href="/sanidad" style={{ textDecoration: "none" }}>
                <div className="kp-alert kp-alert-danger" style={{ fontSize: 11 }}>
                  <IconAlertTriangle size={13} aria-hidden />
                  {kpis.overdueHealthTasks} tarea{kpis.overdueHealthTasks > 1 ? "s" : ""} vencida{kpis.overdueHealthTasks > 1 ? "s" : ""}
                </div>
              </Link>
            )}
            {kpis.unreadAlerts > 0 && (
              <div className="kp-alert kp-alert-info" style={{ fontSize: 11 }}>
                <IconBell size={13} aria-hidden />
                {kpis.unreadAlerts} alerta{kpis.unreadAlerts > 1 ? "s" : ""} sin leer
              </div>
            )}
          </div>
        )}

        {/* KPI inventario */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Inventario actual
          </div>
          <div className="kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {loading ? Array.from({length:4}).map((_,i) => <SkeletonCard key={i} />) : (
              <>
                <KpiCard label="Cerdas activas"     value={kpis?.activeSows ?? null}           icon={IconPig}              iconColor="var(--success)"  href="/gestacion"  />
                <KpiCard label="En maternidad"       value={kpis?.activeFarrowings ?? null}     icon={IconHeartPlus}        iconColor="var(--accent)"   href="/maternidad" />
                <KpiCard label="Lotes iniciación"     value={kpis?.activeNurseryBatches ?? null} icon={IconBuildingWarehouse} iconColor="var(--info)"    href="/recria"     />
                <KpiCard
                  label="Tareas sanitarias"
                  value={kpis?.pendingHealthTasks ?? null}
                  sub={kpis && kpis.overdueHealthTasks > 0 ? `${kpis.overdueHealthTasks} vencidas` : undefined}
                  icon={IconShield}
                  iconColor={kpis && kpis.overdueHealthTasks > 0 ? "var(--danger)" : "var(--text-muted)"}
                  href="/sanidad"
                />
              </>
            )}
          </div>
        </div>

        {/* KPI performance */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Performance · últimos 30 días
          </div>
          <div className="kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {loading ? Array.from({length:4}).map((_,i) => <SkeletonCard key={i} />) : (
              <>
                <KpiCard
                  label="Tasa de parición"
                  value={kpis?.paritionRate != null ? `${kpis.paritionRate}%` : "—"}
                  icon={IconTrendingUp}
                  iconColor={paritionDelta === "up" ? "var(--success)" : paritionDelta === "down" ? "var(--danger)" : "var(--warning)"}
                  delta={paritionDelta as "up" | "down" | "neutral"}
                />
                <KpiCard
                  label="Destetados"
                  value={kpis?.totalWeaned30d ?? null}
                  sub={`${kpis?.weanings30d ?? 0} destetes`}
                  icon={IconHeartPlus}
                  iconColor="var(--accent)"
                  href="/maternidad"
                />
                <KpiCard
                  label="Peso medio destete"
                  value={kpis?.avgWeanWeight ? `${kpis.avgWeanWeight} kg` : "—"}
                  sub={kpis?.avgLactDays ? `${kpis.avgLactDays}d lactancia` : undefined}
                  icon={IconTrendingUp}
                  iconColor="var(--text-muted)"
                  delta={kpis?.avgWeanWeight && Number(kpis.avgWeanWeight) >= 6.5 ? "up" : "neutral"}
                />
                <KpiCard
                  label="GDP recría"
                  value={kpis?.avgGdpGday ? `${kpis.avgGdpGday} g/d` : "—"}
                  icon={IconBuildingWarehouse}
                  iconColor={gdpDelta === "up" ? "var(--success)" : gdpDelta === "down" ? "var(--danger)" : "var(--warning)"}
                  href="/recria"
                  delta={gdpDelta as "up" | "down" | "neutral"}
                />
              </>
            )}
          </div>
        </div>

        {/* Gráficos */}
        {error && (
          <div className="kp-alert kp-alert-danger">
            <IconAlertTriangle size={13} />
            Error cargando datos. <button onClick={load} style={{ marginLeft: 4, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "inherit" }}>Reintentar</button>
          </div>
        )}

        {!loading && !error && chart.length > 0 && (
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
        )}
      </div>
    </>
  );
}
