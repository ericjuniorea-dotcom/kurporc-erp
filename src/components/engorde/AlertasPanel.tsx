"use client";

interface Alerta {
  tipo: "danger" | "warning" | "info" | "ok";
  mensaje: string;
}

const COLOR: Record<Alerta["tipo"], { bg: string; border: string; text: string; dot: string }> = {
  danger:  { bg: "var(--danger-subtle)",  border: "var(--danger-border)",  text: "var(--danger-text)",  dot: "var(--danger)"  },
  warning: { bg: "var(--warning-subtle)", border: "var(--warning-border)", text: "var(--warning-text)", dot: "var(--warning)" },
  info:    { bg: "var(--info-subtle)",    border: "var(--info-border)",    text: "var(--info-text)",    dot: "var(--info)"    },
  ok:      { bg: "var(--success-subtle)", border: "var(--success-border)", text: "var(--success-text)", dot: "var(--success)" },
};

interface Props {
  alertas: Alerta[];
  loading?: boolean;
}

export function AlertasPanel({ alertas, loading }: Props) {
  if (loading) return (
    <div style={{ height: 80, background: "var(--bg-overlay)", borderRadius: "var(--radius-lg)" }} />
  );

  if (!alertas.length) return (
    <div
      style={{
        padding: "10px 14px", fontSize: 12, color: "var(--success-text)",
        background: "var(--success-subtle)", border: "0.5px solid var(--success-border)",
        borderRadius: "var(--radius-md)",
      }}
    >
      Todo en orden — sin alertas activas
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {alertas.map((a, i) => {
        const c = COLOR[a.tipo];
        return (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px",
              background: c.bg,
              border: `0.5px solid ${c.border}`,
              borderRadius: "var(--radius-md)",
            }}
          >
            <div
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: c.dot, flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, color: c.text }}>{a.mensaje}</span>
          </div>
        );
      })}
    </div>
  );
}
