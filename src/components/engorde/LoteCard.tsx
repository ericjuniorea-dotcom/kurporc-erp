"use client";

export interface LoteCardData {
  id: string;
  batchCode: string;
  sitio: string | null;
  entryDate: string;
  currentCount: number;
  avgWeightKg: number;
  targetWeightKg: number;
  diasAlojamiento: number;
  gdpGramsDia: number | null;
  gdpStatus: "ok" | "warn" | "bad" | null;
  estimatedExitDate: string | null;
  progressPct: number | null;
  totalDeaths: number;
  hospitalCount: number;
  discardedCount: number;
  lastPesajeFecha: string | null;
}

interface Props {
  lote: LoteCardData;
}

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function barColor(status: "ok" | "warn" | "bad" | null): string {
  if (status === "bad") return "var(--danger)";
  if (status === "warn") return "var(--warning)";
  return "var(--engorde-accent)";
}

function barGradient(status: "ok" | "warn" | "bad" | null): string {
  if (status === "bad") return "var(--danger)";
  if (status === "warn") return "var(--warning)";
  return "linear-gradient(90deg, var(--engorde-accent), var(--engorde-text))";
}

export function LoteCard({ lote }: Props) {
  const isBad = lote.gdpStatus === "bad";
  const pct = lote.progressPct ?? 0;

  // Calcular días totales estimados
  const diasTotales = lote.gdpGramsDia && lote.gdpGramsDia > 0
    ? lote.diasAlojamiento + Math.ceil(((lote.targetWeightKg - lote.avgWeightKg) * 1000) / lote.gdpGramsDia)
    : null;
  const diasRestantes = diasTotales != null ? diasTotales - lote.diasAlojamiento : null;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: `0.5px solid ${isBad ? "var(--danger)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "var(--shadow-sm)",
        transition: "border-color 0.15s",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Lote {lote.batchCode}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            {lote.diasAlojamiento} días · {formatFecha(lote.entryDate)}
          </div>
        </div>
        {lote.sitio && (
          <span
            style={{
              fontSize: 10, fontWeight: 500, padding: "2px 8px",
              borderRadius: 4,
              background: "var(--engorde-subtle)",
              color: "var(--engorde-text)",
              border: "0.5px solid var(--engorde-border)",
              whiteSpace: "nowrap",
            }}
          >
            {lote.sitio}
          </span>
        )}
      </div>

      {/* Barra de progreso */}
      <div>
        <div style={{ position: "relative", height: 7, background: "var(--bg-overlay)", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: 0, top: 0, bottom: 0,
              width: `${pct}%`,
              background: barGradient(lote.gdpStatus),
              borderRadius: 4,
              transition: "width 0.4s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>0</span>
          <span style={{ fontSize: 10, color: "var(--engorde-text)", fontWeight: 500 }}>
            {lote.diasAlojamiento} días ({pct}%)
          </span>
          {diasTotales != null && (
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>~{diasTotales} días</span>
          )}
        </div>
        {diasRestantes != null && diasRestantes > 0 && (
          <div style={{ fontSize: 10, color: "var(--text-secondary)", textAlign: "right", marginTop: 1 }}>
            ~{diasRestantes} días restantes
          </div>
        )}
      </div>

      {/* Grid de stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px 10px",
          padding: "10px 12px",
          background: "var(--bg-overlay)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Animales</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            {lote.currentCount.toLocaleString("es-PY")}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Peso medio</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            {lote.avgWeightKg > 0 ? `${lote.avgWeightKg} kg` : "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Obj. salida</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
            {lote.targetWeightKg} kg
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Hospital / Desc.</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {lote.hospitalCount} / {lote.discardedCount}
          </div>
        </div>
      </div>

      {/* Footer: GDP + fecha salida */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {lote.gdpGramsDia != null ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: barColor(lote.gdpStatus),
              }}
            >
              GDP: {lote.gdpGramsDia} g/día
            </span>
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sin pesaje aún</span>
          )}
          {lote.gdpStatus === "bad" && (
            <span
              style={{
                fontSize: 9, fontWeight: 700, padding: "1px 5px",
                borderRadius: 3, background: "var(--danger-subtle)", color: "var(--danger-text)",
                border: "0.5px solid var(--danger-border)",
                textTransform: "uppercase", letterSpacing: "0.04em",
              }}
            >
              !
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {lote.estimatedExitDate ? formatFecha(lote.estimatedExitDate) : "—"}
        </div>
      </div>
    </div>
  );
}
