"use client";
import { LoteCard, LoteCardData } from "./LoteCard";

interface Props {
  lotes: LoteCardData[];
  loading?: boolean;
}

export function LotesGrid({ lotes, loading }: Props) {
  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 200, background: "var(--bg-overlay)",
              borderRadius: "var(--radius-lg)",
            }}
          />
        ))}
      </div>
    );
  }

  if (!lotes.length) {
    return (
      <div
        style={{
          padding: "40px 20px", textAlign: "center",
          color: "var(--text-muted)", fontSize: 13,
          background: "var(--bg-surface)",
          border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        No hay lotes activos. Creá el primer lote de engorde.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
      {lotes.map((l) => (
        <LoteCard key={l.id} lote={l} />
      ))}
    </div>
  );
}
