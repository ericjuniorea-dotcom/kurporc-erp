// Barras horizontales del panel (Fase 15.4): etiqueta a la izquierda, barra pastel, valor siempre fuera de la barra.
// Sin textos superpuestos. Server component: solo HTML y CSS.

export const PASTEL = ["#B5D4F4", "#C0DD97", "#FAC775", "#F7C1C1", "#D3D1C7", "#CDBEEB"];

export function BarrasH({ filas, formato, color, ancho = 160, vacio = "Sin datos todavía." }: {
  filas: { etiqueta: string; valor: number; detalle?: string }[];
  formato?: (v: number) => string;
  color?: string | ((i: number) => string);
  ancho?: number;
  vacio?: string;
}) {
  const max = Math.max(0, ...filas.map(f => f.valor));
  if (filas.length === 0 || max === 0) return <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{vacio}</div>;
  const fmt = formato ?? ((v: number) => v.toLocaleString("es-PY"));
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {filas.map((f, i) => {
        const c = typeof color === "function" ? color(i) : color ?? PASTEL[0];
        return (
          <li key={f.etiqueta} title={`${f.etiqueta}: ${fmt(f.valor)}${f.detalle ? ` · ${f.detalle}` : ""}`}
            style={{ display: "grid", gridTemplateColumns: `minmax(90px, ${ancho}px) 1fr`, alignItems: "center", gap: 10, fontSize: 12 }}>
            <span style={{ color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.etiqueta}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span aria-hidden style={{ height: 12, width: `${Math.max(2, (f.valor / max) * 78)}%`, background: c, borderRadius: "0 4px 4px 0", flexShrink: 0 }} />
              <span style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(f.valor)}{f.detalle && <span style={{ color: "var(--text-muted)" }}> · {f.detalle}</span>}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Una sola barra apilada con leyenda abajo (estado de las cerdas). Separación de 2 px entre tramos. */
export function BarraApilada({ tramos }: { tramos: { etiqueta: string; valor: number; color: string }[] }) {
  const total = tramos.reduce((s, t) => s + t.valor, 0);
  if (total === 0) return <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin cerdas cargadas.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div role="img" aria-label={tramos.map(t => `${t.etiqueta}: ${t.valor}`).join(", ")} style={{ display: "flex", gap: 2, height: 16 }}>
        {tramos.filter(t => t.valor > 0).map((t, i, arr) => (
          <span key={t.etiqueta} title={`${t.etiqueta}: ${t.valor}`} style={{ flex: t.valor, background: t.color, borderRadius: `${i === 0 ? 4 : 0}px ${i === arr.length - 1 ? 4 : 0}px ${i === arr.length - 1 ? 4 : 0}px ${i === 0 ? 4 : 0}px` }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)" }}>
        {tramos.map(t => (
          <span key={t.etiqueta} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: t.color }} />
            {t.etiqueta} <strong style={{ fontWeight: 500, color: "var(--text-primary)" }}>{t.valor}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export function Semaforo({ estado, etiqueta, fondo }: { estado: string; etiqueta: string; fondo: string }) {
  return (
    <span data-estado={estado} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-primary)" }}>
      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 99, background: fondo }} />{etiqueta}
    </span>
  );
}
