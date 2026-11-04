"use client";
import { useState, useEffect } from "react";
import { IconLoader2, IconFlame, IconCircleCheck } from "@tabler/icons-react";

interface Caso { tipo: "NECROPSIA" | "TRATAMIENTO"; fecha: string }
interface Grupo { galpon: string; causa: string; cantidadCasos: number; esBrote: boolean; casos: Caso[] }
interface BrotesData { ventanaDias: number; umbralBrote: number; estadoGeneral: "verde" | "amarillo" | "rojo"; grupos: Grupo[] }

const ESTADO_COLOR: Record<string, string> = {
  verde:    "var(--success)",
  amarillo: "var(--warning)",
  rojo:     "var(--danger)",
};
const ESTADO_LABEL: Record<string, string> = {
  verde:    "Sin alertas",
  amarillo: "Casos aislados, sin brote",
  rojo:     "Brote activo",
};

export function PanelBrotes() {
  const [data, setData] = useState<BrotesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sanidad/brotes")
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
        background: `${ESTADO_COLOR[data.estadoGeneral]}1a`, border: `0.5px solid ${ESTADO_COLOR[data.estadoGeneral]}`,
        borderRadius: "var(--radius-lg)",
      }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: ESTADO_COLOR[data.estadoGeneral], flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{ESTADO_LABEL[data.estadoGeneral]}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Ventana de {data.ventanaDias} días · alerta a partir de {data.umbralBrote} casos de la misma causa en el mismo galpón
          </div>
        </div>
      </div>

      {data.grupos.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" }}>
          <IconCircleCheck size={26} style={{ color: "var(--success)", display: "block", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Sin necropsias ni tratamientos en los últimos {data.ventanaDias} días.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.grupos.map((g, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "12px 16px", borderRadius: "var(--radius-lg)",
                background: g.esBrote ? "var(--danger-subtle)" : "var(--bg-surface)",
                border: `0.5px solid ${g.esBrote ? "var(--danger)" : "var(--border-default)"}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {g.esBrote && <IconFlame size={16} style={{ color: "var(--danger)" }} />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{g.causa}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.galpon}</div>
                </div>
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99,
                background: g.esBrote ? "var(--danger)" : "var(--bg-overlay)",
                color: g.esBrote ? "white" : "var(--text-secondary)",
              }}>
                {g.cantidadCasos} caso{g.cantidadCasos > 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
