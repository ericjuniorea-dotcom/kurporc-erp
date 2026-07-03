"use client";
import { useState, useEffect, useCallback } from "react";
import { IconLoader2, IconAlertTriangle, IconMedicalCross } from "@tabler/icons-react";

interface AnimalEventItem {
  id:           string;
  eventType:    string;
  eventDate:    string;
  description:  string | null;
  moduleSource: string | null;
  metadata:     Record<string, unknown> | null;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const SANIDAD_TYPES = new Set(["TREATMENT", "VACCINATION", "DIAGNOSIS", "HEALTH_ALERT", "OBSERVATION"]);

export function TabSanitario({ sowId }: { sowId: string }) {
  const [events,  setEvents]  = useState<AnimalEventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/plantel/animales/${sowId}/timeline`)
      .then(r => r.json())
      .then((d: { events: AnimalEventItem[] }) => {
        const sanitaryEvents = (d.events ?? []).filter(
          e => e.moduleSource === "SANIDAD" || SANIDAD_TYPES.has(e.eventType),
        );
        setEvents(sanitaryEvents);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sowId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
        <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando registros sanitarios…</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const treatments = events.filter(e => e.eventType === "TREATMENT" || e.eventType === "VACCINATION");
  const alerts     = events.filter(e => e.eventType === "HEALTH_ALERT" || e.eventType === "DIAGNOSIS");
  const obs        = events.filter(e => e.eventType === "OBSERVATION");

  if (events.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 0", gap: 8, textAlign: "center",
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
      }}>
        <IconMedicalCross size={28} style={{ color: "var(--text-muted)" }} />
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Sin registros sanitarios</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Los eventos sanitarios se registran desde el módulo de Sanidad
        </div>
      </div>
    );
  }

  function EventTable({ rows, emptyLabel }: { rows: AnimalEventItem[]; emptyLabel: string }) {
    if (rows.length === 0) {
      return <div style={{ padding: "10px 0", fontSize: 12, color: "var(--text-muted)" }}>{emptyLabel}</div>;
    }
    return (
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="kp-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(e => (
              <tr key={e.id}>
                <td style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmtDate(e.eventDate)}</td>
                <td>
                  <span style={{ fontSize: 10, background: "var(--warning-subtle)", color: "var(--warning-text)", border: "0.5px solid var(--warning-border)", borderRadius: 4, padding: "1px 6px", fontWeight: 500 }}>
                    {e.eventType}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{e.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function SectionTitle({ title, count }: { title: string; count: number }) {
    return (
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {title} ({count})
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <IconMedicalCross size={13} style={{ color: "var(--info)" }} />
          <SectionTitle title="Tratamientos y vacunaciones" count={treatments.length} />
        </div>
        <EventTable rows={treatments} emptyLabel="Sin tratamientos registrados" />
      </div>

      {alerts.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <IconAlertTriangle size={13} style={{ color: "var(--warning)" }} />
            <SectionTitle title="Alertas y diagnósticos" count={alerts.length} />
          </div>
          <EventTable rows={alerts} emptyLabel="" />
        </div>
      )}

      {obs.length > 0 && (
        <div>
          <SectionTitle title="Observaciones médicas" count={obs.length} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {obs.map(e => (
              <div key={e.id} style={{
                background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)",
                borderRadius: "var(--radius-md)", padding: "8px 12px",
              }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>{fmtDate(e.eventDate)}</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{e.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
