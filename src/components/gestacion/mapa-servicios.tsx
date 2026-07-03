"use client";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";
import {
  IconAlertTriangle, IconCircleCheck, IconClock, IconTrendingUp,
  IconChevronDown, IconChevronUp, IconRefresh, IconHeart,
  IconX, IconDroplet, IconClock2, IconUserCheck, IconStethoscope, IconLoader2,
} from "@tabler/icons-react";

interface ServiceEventRow {
  id:                    string;
  sowId:                 string;
  sowCode:               string;
  serviceDate:           string;
  serviceType:           string;
  durationMinutes:       number | null;
  doseCode:              string | null;
  employeeName:          string | null;
  projectedFarrowingDate: string;
  hasConfirmedFarrowing: boolean;
  farrowingDate:         string | null;
  bornAlive:             number | null;
  lastPregnancyCheck:    { result: string; checkDate: string } | null;
  isOverdue:             boolean;
  heatRepeatCount:       number;
  totalHeatRepeats:      number;
  hasSubsequentService:  boolean;
  subsequentBatchLabel:  string | null;
  isRepeatService:       boolean;
  siblingCount:          number;
}

interface BatchData {
  id:              string;
  weekLabel:       string;
  totalServiced:   number;
  confirmedBirths: number;
  paritionRate:    number;
  events:          ServiceEventRow[];
}

/* ─── Modal de detalle de la hembra ─────────────────────────────── */

const METHOD_OPTIONS = [
  { value: "ULTRASOUND", label: "Ecografía" },
  { value: "BLOOD_TEST", label: "Análisis de sangre" },
  { value: "VISUAL",     label: "Visual" },
] as const;

const RESULT_OPTIONS = [
  { value: "PREGNANT",     label: "Preñada",     color: "var(--success)" },
  { value: "NOT_PREGNANT", label: "No preñada",  color: "var(--danger)"  },
  { value: "RECHECK",      label: "Re-control",  color: "var(--warning)" },
] as const;

function DiagnosticoForm({
  sowId,
  serviceEventId,
  onSaved,
}: {
  sowId: string;
  serviceEventId: string;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [checkDate, setCheckDate] = useState(today);
  const [method,    setMethod]    = useState<"ULTRASOUND" | "BLOOD_TEST" | "VISUAL">("ULTRASOUND");
  const [result,    setResult]    = useState<"PREGNANT" | "NOT_PREGNANT" | "RECHECK">("PREGNANT");
  const [notes,     setNotes]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/pregnancy-checks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sowId, serviceEventId, checkDate, method, result, notes }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Error al guardar");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)",
      borderRadius: "var(--radius-md)", padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
        Nuevo diagnóstico de preñez
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Fecha</label>
          <input className="kp-input" type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)} style={{ height: 30, fontSize: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Método</label>
          <select className="kp-input" value={method} onChange={e => setMethod(e.target.value as typeof method)} style={{ height: 30, fontSize: 12, appearance: "auto" }}>
            {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>Resultado</label>
        <div style={{ display: "flex", gap: 6 }}>
          {RESULT_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => setResult(o.value)}
              style={{
                flex: 1, padding: "6px 8px", fontSize: 11, fontWeight: 500,
                border: `1.5px solid ${result === o.value ? o.color : "var(--border-default)"}`,
                borderRadius: "var(--radius-md)",
                background: result === o.value ? o.color + "1a" : "var(--bg-surface)",
                color: result === o.value ? o.color : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 3 }}>Observaciones (opcional)</label>
        <input className="kp-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: imagen clara, confirmado por veterinario…" style={{ fontSize: 12 }} />
      </div>

      {error && (
        <div style={{ fontSize: 11, color: "var(--danger-text)", background: "var(--danger-subtle)", borderRadius: "var(--radius-md)", padding: "6px 10px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: 11 }}>
          {saving ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Guardar diagnóstico"}
        </button>
      </div>
    </div>
  );
}

function SowDetailModal({
  event,
  siblings,
  onClose,
  onRefresh,
}: {
  event: ServiceEventRow;
  siblings: ServiceEventRow[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [showDiag, setShowDiag] = useState(false);

  // Todos los servicios de este ciclo (ordenados por fecha)
  const cicloEvents = [event, ...siblings.filter(s => s.id !== event.id)]
    .sort((a, b) => new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime());

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          width: "100%", maxWidth: 460,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          overflow: "hidden",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Encabezado */}
        <div
          style={{
            padding: "13px 16px",
            borderBottom: "0.5px solid var(--border-default)",
            background: "var(--bg-elevated)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconHeart size={15} style={{ color: "var(--success)" }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              Cerda {event.sowCode}
            </span>
            {event.isRepeatService && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 3, background: "var(--warning)", color: "white" }}>
                REP. #{event.totalHeatRepeats}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2 }}
          >
            <IconX size={15} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Servicios del ciclo */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
              Ciclo de inseminación — {cicloEvents.length} dosis registradas
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {cicloEvents.map((ev, idx) => (
                <div
                  key={ev.id}
                  style={{
                    background: ev.id === event.id ? "var(--success-subtle)" : "var(--bg-elevated)",
                    border: `0.5px solid ${ev.id === event.id ? "var(--success-border)" : "var(--border-default)"}`,
                    borderRadius: "var(--radius-md)",
                    padding: "8px 12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>
                      Dosis #{idx + 1}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {new Date(ev.serviceDate).toLocaleString("es-PY", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {ev.doseCode && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-secondary)" }}>
                        <IconDroplet size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span>{ev.doseCode}</span>
                      </div>
                    )}
                    {ev.durationMinutes != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-secondary)" }}>
                        <IconClock2 size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span>{ev.durationMinutes} min</span>
                      </div>
                    )}
                    {ev.employeeName && (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-secondary)", gridColumn: "1 / -1" }}>
                        <IconUserCheck size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span>{ev.employeeName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estado reproductivo */}
          <div style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
              Estado reproductivo
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <Row label="Parto proyectado" value={formatDate(event.projectedFarrowingDate)} />
              {event.hasConfirmedFarrowing && (
                <Row label="Fecha de parto" value={formatDate(event.farrowingDate!)} color="var(--success-text)" />
              )}
              {event.bornAlive != null && (
                <Row label="Nacidos vivos" value={String(event.bornAlive)} />
              )}
              {event.lastPregnancyCheck && (
                <Row
                  label="Último diagnóstico"
                  value={event.lastPregnancyCheck.result === "PREGNANT" ? "Preñada ✓" : event.lastPregnancyCheck.result}
                  color={event.lastPregnancyCheck.result === "PREGNANT" ? "var(--success-text)" : "var(--text-secondary)"}
                />
              )}
              {event.hasSubsequentService && (
                <Row label="Nuevo servicio" value={`Lote ${event.subsequentBatchLabel}`} color="var(--warning-text)" />
              )}
              {event.totalHeatRepeats > 0 && (
                <Row label="Repeticiones de celo" value={String(event.totalHeatRepeats)} color="var(--warning-text)" />
              )}
            </div>
          </div>
        </div>

        {/* Diagnóstico de preñez */}
        <div style={{ padding: "0 16px 14px" }}>
          {showDiag ? (
            <DiagnosticoForm
              sowId={event.sowId}
              serviceEventId={event.id}
              onSaved={() => {
                setShowDiag(false);
                onRefresh();
                onClose();
              }}
            />
          ) : (
            !event.hasConfirmedFarrowing && (
              <button
                className="btn"
                style={{ width: "100%", justifyContent: "center", gap: 5, fontSize: 11, color: "var(--info-text)" }}
                onClick={() => setShowDiag(true)}
              >
                <IconStethoscope size={13} />
                Registrar diagnóstico de preñez
              </button>
            )
          )}
        </div>

        {/* Pie */}
        <div style={{ padding: "10px 16px", borderTop: "0.5px solid var(--border-default)", background: "var(--bg-elevated)", display: "flex", justifyContent: "flex-end" }}>
          <button className="btn" style={{ fontSize: 12 }} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 500, color: color ?? "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────────────── */

export function MapaServicios({ tenantId }: { tenantId: string }) {
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Modal de detalle
  const [detailEvent, setDetailEvent] = useState<ServiceEventRow | null>(null);
  const [detailSiblings, setDetailSiblings] = useState<ServiceEventRow[]>([]);

  function loadData() {
    setLoading(true);
    fetch("/api/service-batches")
      .then(r => r.json())
      .then((data: BatchData[]) => {
        setBatches(data);
        if (data.length > 0) setExpanded(prev => prev ?? data[0].id);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [tenantId]);

  function openDetail(event: ServiceEventRow, batch: BatchData) {
    // Hermanos = otros servicios del MISMO lote para la misma cerda
    const siblings = batch.events.filter(e => e.sowId === event.sowId && e.id !== event.id);
    setDetailSiblings(siblings);
    setDetailEvent(event);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: 72, borderRadius: "var(--radius-lg)", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", opacity: 0.5 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Modal de detalle */}
      {detailEvent && (
        <SowDetailModal
          event={detailEvent}
          siblings={detailSiblings}
          onClose={() => setDetailEvent(null)}
          onRefresh={loadData}
        />
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {batches.length === 0 ? (
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "40px 20px", textAlign: "center" }}>
          <IconClock size={32} style={{ color: "var(--text-muted)", marginBottom: 10 }} />
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", margin: 0 }}>Sin lotes de servicio aún</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>Registrá el primer servicio para comenzar.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {batches.map(batch => {
            const isOpen = expanded === batch.id;
            return (
              <div key={batch.id} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : batch.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-overlay)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Lote {batch.weekLabel}</span>
                    <ParitionBadge rate={batch.paritionRate} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{batch.totalServiced} servidas</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{batch.confirmedBirths} partos</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--success)" }}>{batch.paritionRate}%</span>
                    <IconTrendingUp size={13} style={{ color: "var(--text-muted)" }} />
                    {isOpen ? <IconChevronUp size={13} style={{ color: "var(--text-muted)" }} /> : <IconChevronDown size={13} style={{ color: "var(--text-muted)" }} />}
                  </div>
                </button>

                {isOpen && (
                  <div style={{ padding: "0 14px 14px", borderTop: "0.5px solid var(--border-default)" }}>
                    <div style={{ height: 3, background: "var(--border-default)", borderRadius: 99, margin: "12px 0 12px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${batch.paritionRate}%`, background: "var(--success)", borderRadius: 99, transition: "width 0.4s ease" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
                      {batch.events.map(ev => (
                        <SowCard key={ev.id} event={ev} onClick={() => openDetail(ev, batch)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Badges ─────────────────────────────────────────────────────── */

function ParitionBadge({ rate }: { rate: number }) {
  if (rate >= 80) return <span className="badge badge-ok">{rate}% parición</span>;
  if (rate >= 60) return <span className="badge badge-warn">{rate}% parición</span>;
  return <span className="badge badge-danger">{rate}% parición</span>;
}

/* ─── Tarjeta de cerda (clickeable) ─────────────────────────────── */

function SowCard({ event, onClick }: { event: ServiceEventRow; onClick: () => void }) {
  let borderColor = "var(--border-default)";
  let bgColor     = "var(--bg-surface)";
  let statusIcon  = <IconClock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />;
  let statusLabel = "Proyectado";
  let statusColor = "var(--text-muted)";

  if (event.hasConfirmedFarrowing) {
    borderColor = "var(--success-border)"; bgColor = "var(--success-subtle)";
    statusIcon  = <IconCircleCheck size={12} style={{ color: "var(--success)", flexShrink: 0 }} />;
    statusLabel = `Parió: ${formatDate(event.farrowingDate!)}`;
    statusColor = "var(--success-text)";
  } else if (event.hasSubsequentService) {
    borderColor = "var(--warning-border)"; bgColor = "var(--warning-subtle)";
    statusIcon  = <IconRefresh size={12} style={{ color: "var(--warning)", flexShrink: 0 }} />;
    statusLabel = `Repitió celo → Lote ${event.subsequentBatchLabel}`;
    statusColor = "var(--warning-text)";
  } else if (event.isOverdue) {
    borderColor = "var(--danger-border)"; bgColor = "var(--danger-subtle)";
    statusIcon  = <IconAlertTriangle size={12} style={{ color: "var(--danger)", flexShrink: 0 }} />;
    statusLabel = "Vencida — sin parto";
    statusColor = "var(--danger-text)";
  } else if (event.lastPregnancyCheck?.result === "PREGNANT") {
    borderColor = "var(--info-border)"; bgColor = "var(--info-subtle)";
    statusIcon  = <IconCircleCheck size={12} style={{ color: "var(--info)", flexShrink: 0 }} />;
    statusLabel = "Preñez confirmada";
    statusColor = "var(--info-text)";
  }

  return (
    <button
      onClick={onClick}
      style={{
        background: bgColor, border: `0.5px solid ${borderColor}`,
        borderRadius: "var(--radius-md)", padding: "10px 11px",
        cursor: "pointer", textAlign: "left", width: "100%",
        transition: "filter 0.1s",
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.96)")}
      onMouseLeave={e => (e.currentTarget.style.filter = "none")}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>Cerda {event.sowCode}</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {event.isRepeatService && (
            <span style={{ fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 3, background: "var(--warning)", color: "white" }}>
              REP.{event.totalHeatRepeats > 0 ? ` #${event.totalHeatRepeats}` : ""}
            </span>
          )}
          {event.siblingCount > 1 && (
            <span style={{ fontSize: 9, fontWeight: 500, padding: "1px 5px", borderRadius: 3, background: "var(--bg-overlay)", border: "0.5px solid var(--border-default)", color: "var(--text-muted)" }}>
              {event.siblingCount} dosis
            </span>
          )}
          {event.bornAlive != null && (
            <span className="badge badge-ok" style={{ fontSize: 10 }}>{event.bornAlive} vivos</span>
          )}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 5 }}>
        Servicio: {formatDate(event.serviceDate)}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: statusColor }}>
        {statusIcon}
        <span>{statusLabel}</span>
      </div>

      {!event.hasConfirmedFarrowing && !event.hasSubsequentService && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
          Parto proyectado: {formatDate(event.projectedFarrowingDate)}
        </div>
      )}

      {/* Quién inseminó (en gris pequeño al pie) */}
      {event.employeeName && (
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
          <IconUserCheck size={10} />
          {event.employeeName}
        </div>
      )}
    </button>
  );
}
