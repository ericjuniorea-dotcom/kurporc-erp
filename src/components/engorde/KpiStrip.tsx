"use client";
import { IconStack2, IconPig, IconSkull, IconTrendingUp, IconRefresh } from "@tabler/icons-react";

interface KpiStripProps {
  lotesAbiertos: number;
  stockTotal: number;
  hospitalCount: number;
  descartadosCount: number;
  mortalidadPct: number;
  gdpPromedio: number | null;
  loading?: boolean;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flex: 1,
        minWidth: 140,
      }}
    >
      <div
        style={{
          width: 32, height: 32, borderRadius: "var(--radius-md)",
          background: "var(--engorde-subtle)",
          border: "0.5px solid var(--engorde-border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={16} style={{ color: "var(--engorde-text)" }} />
      </div>
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: color ?? "var(--text-primary)", lineHeight: 1.2 }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

export function KpiStrip({ lotesAbiertos, stockTotal, hospitalCount, descartadosCount, mortalidadPct, gdpPromedio, loading }: KpiStripProps) {
  if (loading) {
    return (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ flex: 1, minWidth: 140, height: 62, background: "var(--bg-overlay)", borderRadius: "var(--radius-lg)", animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
    );
  }

  const mortColor = mortalidadPct <= 1.5 ? "var(--success)" : mortalidadPct <= 3 ? "var(--warning)" : "var(--danger)";
  const gdpColor = gdpPromedio == null ? "var(--text-muted)" : gdpPromedio >= 800 ? "var(--success)" : gdpPromedio >= 700 ? "var(--warning)" : "var(--danger)";

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <KpiCard icon={IconStack2}     label="Lotes abiertos" value={String(lotesAbiertos)} />
      <KpiCard icon={IconPig}        label="Stock total"    value={stockTotal.toLocaleString("es-PY")}
        sub={`Hospital: ${hospitalCount} · Desc.: ${descartadosCount}`} />
      <KpiCard icon={IconSkull}      label="Mortalidad"     value={`${mortalidadPct.toFixed(2)}%`} color={mortColor} />
      <KpiCard icon={IconTrendingUp} label="GDP promedio"   value={gdpPromedio != null ? `${gdpPromedio} g/día` : "—"} color={gdpColor} />
    </div>
  );
}
