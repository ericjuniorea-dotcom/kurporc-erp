"use client";
import { useState } from "react";
import { IconHeart, IconHeartFilled, IconChevronLeft } from "@tabler/icons-react";

export interface GalleryCard {
  id:          string;
  titulo:      string;
  descripcion: string;
  tags:        string[];
  categoria:   "desempeño" | "analisis" | "listado";
  color:       string;
  component:   React.ComponentType<{ onBack: () => void }>;
}

interface Props { cards: GalleryCard[] }

const CATS = [
  { key: "todos",     label: "Todos"     },
  { key: "desempeño", label: "Desempeño" },
  { key: "analisis",  label: "Análisis"  },
  { key: "listado",   label: "Listado"   },
  { key: "favoritos", label: "Favoritos" },
];

export function AnalisisGallery({ cards }: Props) {
  const [opened,    setOpened]    = useState<string | null>(null);
  const [cat,       setCat]       = useState("todos");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const activeCard = cards.find(c => c.id === opened);
  const Component  = activeCard?.component;

  function toggleFav(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Analysis view ────────────────────────────────────────────────────────
  if (opened && Component) return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button className="btn" style={{ fontSize: 11 }} onClick={() => setOpened(null)}>
          <IconChevronLeft size={12} /> Central de análisis
        </button>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>›</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{activeCard.titulo}</span>
      </div>
      <Component onBack={() => setOpened(null)} />
    </div>
  );

  // ── Gallery view ─────────────────────────────────────────────────────────
  const filtered =
    cat === "favoritos" ? cards.filter(c => favorites.has(c.id)) :
    cat === "todos"     ? cards :
    cards.filter(c => c.categoria === cat);

  return (
    <div>
      {/* Sub-tab strip */}
      <div style={{
        display: "flex", width: "fit-content",
        background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3,
        border: "0.5px solid var(--border-default)", marginBottom: 16,
      }}>
        {CATS.map(c => (
          <button
            key={c.key} onClick={() => setCat(c.key)}
            style={{
              fontSize: 12, padding: "5px 16px", borderRadius: 6, border: "none", cursor: "pointer",
              background: cat === c.key ? "var(--bg-surface)" : "transparent",
              color:      cat === c.key ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: cat === c.key ? 500 : 400,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {filtered.map(card => (
          <div key={card.id} style={{
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border-default)",
            borderLeft: `3px solid ${card.color}`,
            borderRadius: "var(--radius-lg)",
            padding: "16px",
            display: "flex", flexDirection: "column", gap: 10,
            minHeight: 200,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {card.titulo}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, flex: 1 }}>
              {card.descripcion}
            </div>
            <div style={{ height: "0.5px", background: "var(--border-default)" }} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {card.tags.map(t => (
                <span key={t} style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 4,
                  background: "var(--bg-overlay)", color: "var(--text-muted)",
                  border: "0.5px solid var(--border-default)",
                }}>
                  {t}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button
                type="button" onClick={e => toggleFav(card.id, e)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: "var(--text-muted)" }}
              >
                {favorites.has(card.id)
                  ? <IconHeartFilled size={16} style={{ color: "var(--danger)" }} />
                  : <IconHeart size={16} />}
              </button>
              <button
                className="btn btn-primary"
                style={{ fontSize: 11, padding: "6px 18px" }}
                onClick={() => setOpened(card.id)}
              >
                ABRIR
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{
            gridColumn: "1 / -1", textAlign: "center", padding: "48px 0",
            color: "var(--text-muted)", fontSize: 12,
          }}>
            {cat === "favoritos" ? "Todavía no marcaste ningún análisis como favorito" : "Sin análisis en esta categoría"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel de recomendaciones (reutilizable) ──────────────────────────────────
export interface Recomendacion {
  nivel:       "success" | "warning" | "danger" | "info";
  titulo:      string;
  descripcion: string;
  accion?:     string;
}

const NIVEL_STYLE: Record<Recomendacion["nivel"], { border: string; bg: string; dot: string; label: string }> = {
  success: { border: "var(--success-border)", bg: "var(--success-subtle)", dot: "var(--success)", label: "Dentro de meta" },
  warning: { border: "var(--warning-border)", bg: "var(--warning-subtle)", dot: "var(--warning)", label: "Atención"       },
  danger:  { border: "var(--danger-border)",  bg: "var(--danger-subtle)",  dot: "var(--danger)",  label: "Crítico"        },
  info:    { border: "var(--info-border)",    bg: "var(--info-subtle)",    dot: "var(--info)",    label: "Información"    },
};

export function RecomendacionesPanel({ recomendaciones }: { recomendaciones: Recomendacion[] }) {
  if (recomendaciones.length === 0) return null;
  return (
    <div style={{
      background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-lg)", padding: "16px",
      marginTop: 14,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
        Recomendaciones
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {recomendaciones.map((r, i) => {
          const s = NIVEL_STYLE[r.nivel];
          return (
            <div key={i} style={{
              background: s.bg, border: `0.5px solid ${s.border}`,
              borderRadius: "var(--radius-md)", padding: "10px 14px",
              borderLeft: `3px solid ${s.dot}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{r.titulo}</span>
                <span style={{
                  marginLeft: "auto", fontSize: 9, padding: "1px 7px", borderRadius: 4,
                  background: s.dot, color: "#fff", fontWeight: 600, textTransform: "uppercase",
                }}>
                  {s.label}
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{r.descripcion}</p>
              {r.accion && (
                <p style={{ fontSize: 11, color: "var(--text-primary)", margin: "6px 0 0", fontWeight: 500, lineHeight: 1.4 }}>
                  → {r.accion}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
