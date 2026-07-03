"use client";

interface GdpPorLote {
  batchCode: string;
  sitio: string | null;
  gdp: number | null;
  status: "ok" | "warn" | "bad" | null;
}

const META_GDP = 800;

function barColor(status: "ok" | "warn" | "bad" | null): string {
  if (status === "bad")  return "var(--danger)";
  if (status === "warn") return "var(--warning)";
  return "var(--engorde-accent)";
}

interface Props {
  data: GdpPorLote[];
}

export function GdpBarChart({ data }: Props) {
  if (!data.length) return (
    <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
      Sin datos de GDP aún
    </div>
  );

  const values = data.map(d => d.gdp ?? 0);
  const maxVal  = Math.max(...values, META_GDP + 100);

  const metaPct = (META_GDP / maxVal) * 100;

  return (
    <div>
      {/* Label título */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>GDP por lote activo (g/día)</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>meta {META_GDP} g</span>
      </div>

      {/* Contenedor de barras */}
      <div style={{ position: "relative", paddingBottom: 24 }}>
        {/* Línea meta */}
        <div
          style={{
            position: "absolute",
            bottom: `calc(24px + ${metaPct}%)`,
            left: 0, right: 0,
            height: 1,
            borderTop: "1.5px dashed var(--border-strong)",
            zIndex: 1,
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: `calc(24px + ${metaPct}% + 3px)`,
            right: 0,
            fontSize: 9, color: "var(--text-muted)",
          }}
        >
          meta
        </span>

        {/* Barras */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120 }}>
          {data.map((d) => {
            const pct = d.gdp != null ? (d.gdp / maxVal) * 100 : 0;
            const color = barColor(d.status);
            return (
              <div
                key={d.batchCode}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}
              >
                {/* Valor encima */}
                <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 2, textAlign: "center" }}>
                  {d.gdp != null ? `${d.gdp}` : "—"}
                </div>
                {/* Barra */}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "flex-end",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${pct}%`,
                      minHeight: d.gdp != null ? 4 : 0,
                      background: color,
                      borderRadius: "3px 3px 0 0",
                      opacity: d.status === "ok" ? 0.85 : 1,
                      transition: "height 0.3s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Labels eje X */}
        <div style={{ display: "flex", gap: 8 }}>
          {data.map((d) => (
            <div key={d.batchCode} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.batchCode}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
