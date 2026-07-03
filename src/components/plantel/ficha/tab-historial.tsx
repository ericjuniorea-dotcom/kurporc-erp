"use client";
import { useState, useEffect, useCallback } from "react";
import { IconLoader2, IconHistory } from "@tabler/icons-react";

interface TimelineEvent {
  id:          string;
  date:        string;
  type:        string;
  description: string;
  module:      string;
  color:       string;
}

function fmtDateTime(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + date.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
}

const MODULE_LABELS: Record<string, string> = {
  PLANTEL:   "Plantel",
  GESTACION: "Gestación",
  MATERNIDAD:"Maternidad",
  SANIDAD:   "Sanidad",
  RECRIA:    "Iniciación",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  ENTRY:             "Ingreso",
  STATE_CHANGE:      "Cambio de estado",
  DEATH:             "Muerte",
  DISCARD:           "Descarte",
  SERVICE:           "Servicio",
  FARROWING:         "Parto",
  WEANING:           "Destete",
  VACCINATION:       "Vacunación",
  TREATMENT:         "Tratamiento",
  DIAGNOSIS:         "Diagnóstico",
  HEALTH_ALERT:      "Alerta sanitaria",
  OBSERVATION:       "Observación",
  QUARANTINE_RELEASE:"Alta de cuarentena",
};

export function TabHistorial({ sowId }: { sowId: string }) {
  const [events,  setEvents]  = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/plantel/animales/${sowId}/timeline`)
      .then(r => r.json())
      .then((d: { events: TimelineEvent[] }) => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sowId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
        <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando historial…</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 0", gap: 8, textAlign: "center",
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
      }}>
        <IconHistory size={28} style={{ color: "var(--text-muted)" }} />
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Sin eventos registrados</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", paddingLeft: 20 }}>
      {/* Vertical line */}
      <div style={{
        position: "absolute", left: 7, top: 0, bottom: 0,
        width: 1, background: "var(--border-default)",
      }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {events.map((e, i) => (
          <div key={e.id} style={{ position: "relative", paddingBottom: i < events.length - 1 ? 16 : 0 }}>
            {/* Dot */}
            <div style={{
              position: "absolute", left: -17, top: 4,
              width: 9, height: 9, borderRadius: "50%",
              background: e.color,
              border: "1.5px solid var(--bg-surface)",
              boxShadow: `0 0 0 1px ${e.color}`,
            }} />

            {/* Content */}
            <div style={{
              background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
              borderRadius: "var(--radius-md)", padding: "8px 12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
                  {EVENT_TYPE_LABELS[e.type] ?? e.type}
                </span>
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 4,
                  background: "var(--bg-overlay)", color: "var(--text-muted)",
                  border: "0.5px solid var(--border-default)", fontWeight: 500,
                }}>
                  {MODULE_LABELS[e.module] ?? e.module}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, lineHeight: 1.4 }}>
                {e.description}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                {fmtDateTime(e.date)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
