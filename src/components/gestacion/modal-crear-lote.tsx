"use client";
import { useState } from "react";
import { IconX, IconAlertTriangle, IconLoader2, IconLayoutGrid, IconChevronRight, IconCircleCheck } from "@tabler/icons-react";
import { ModalAccionDisponible, type DisponibleSow } from "./modal-accion-disponible";

const todayIso = () => new Date().toISOString().slice(0, 10);

interface Batch { id: string; code: string | null }

export function ModalCrearLote({
  sows,
  onClose,
  onProgress,
}: {
  sows: DisponibleSow[];
  onClose: () => void;
  onProgress: () => void;
}) {
  const [step, setStep] = useState<"form" | "list">("form");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [servicedIds, setServicedIds] = useState<Set<string>>(new Set());
  const [activeSowId, setActiveSowId] = useState<string | null>(null);

  const [code, setCode]               = useState("");
  const [serviceDate, setServiceDate] = useState(todayIso());
  const [notes, setNotes]             = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function handleCrearLote() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/service-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() || undefined, serviceDate, notes: notes || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Error al crear el lote");
        return;
      }
      const data: { batch: Batch } = await res.json();
      setBatch(data.batch);
      setStep("list");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSowDone() {
    if (activeSowId) {
      setServicedIds(prev => new Set(prev).add(activeSowId));
      onProgress();
    }
    setActiveSowId(null);
  }

  const activeSow = sows.find(s => s.id === activeSowId) ?? null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 320,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 16px", overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
          borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 520,
          boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", borderBottom: "0.5px solid var(--border-default)",
            background: "var(--bg-elevated)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconLayoutGrid size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {step === "form" ? "Crear lote de servicio" : batch?.code}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, padding: "1px 7px", borderRadius: 10, background: "var(--accent-subtle)", color: "var(--accent)" }}>
              {sows.length} cerdas
            </span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 4, borderRadius: "var(--radius-md)" }}>
            <IconX size={14} />
          </button>
        </div>

        <div style={{ padding: "16px 18px 20px" }}>
          {step === "form" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {error && (
                <div className="kp-alert kp-alert-danger" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconAlertTriangle size={15} />
                  {error}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Código del lote</label>
                  <input className="kp-input" value={code} onChange={e => setCode(e.target.value)} placeholder="Se genera automáticamente" />
                </div>
                <div>
                  <label className="kp-label">Fecha del servicio *</label>
                  <input className="kp-input" type="date" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="kp-label">Observaciones del lote</label>
                <textarea
                  className="kp-input"
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Observaciones opcionales…"
                  style={{ height: "auto", paddingTop: 8, resize: "vertical" }}
                />
              </div>

              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Después de crear el lote vas a poder abrir la ficha de inseminación de cada cerda una por una, con las mismas validaciones del registro individual.
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" className="btn" onClick={onClose} disabled={submitting}>Cancelar</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCrearLote}
                  disabled={submitting || !serviceDate}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  {submitting ? <><IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Creando…</> : "Crear lote"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Hacé click en cada cerda para completar su ficha de inseminación individual.
              </div>

              <div style={{ border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                {sows.map((s, i) => {
                  const done = servicedIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveSowId(s.id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 14px", background: "none", border: "none",
                        borderTop: i > 0 ? "0.5px solid var(--border-default)" : "none",
                        cursor: "pointer", textAlign: "left",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-overlay)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.identCode}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.ubicacion}</div>
                      </div>
                      {done ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, color: "var(--success-text)" }}>
                          <IconCircleCheck size={13} /> Registrada
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Pendiente</span>
                      )}
                      <IconChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={onClose}>
                  Listo ({servicedIds.size}/{sows.length} registradas)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {activeSow && batch && (
        // Envoltorio con stopPropagation: evita que un click en el backdrop de
        // la ficha individual burbujee y cierre también el wizard del lote.
        <div onClick={e => e.stopPropagation()}>
          <ModalAccionDisponible
            sow={activeSow}
            serviceBatchId={batch.id}
            defaultServiceDate={serviceDate}
            zIndex={330}
            onClose={() => setActiveSowId(null)}
            onSuccess={handleSowDone}
          />
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
