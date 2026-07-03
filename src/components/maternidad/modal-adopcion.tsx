"use client";
import { useState, useEffect } from "react";
import { IconArrowsLeftRight, IconLoader2, IconX, IconAlertTriangle, IconSearch } from "@tabler/icons-react";

interface ActiveFarrowing {
  id:           string;
  sow:          { identCode: string };
  currentStock: number;
  bornAlive:    number;
  lactationDays: number;
}

interface Props {
  farrowing: { id: string; sow: { identCode: string }; currentStock: number };
  onClose:   () => void;
  onSaved:   () => void;
}

export function ModalAdopcion({ farrowing, onClose, onSaved }: Props) {
  const [accion,       setAccion]       = useState<"DONA" | "RECIBE">("DONA");
  const [otherSearch,  setOtherSearch]  = useState("");
  const [allFarrowings, setAllFarrowings] = useState<ActiveFarrowing[]>([]);
  const [selectedOther, setSelectedOther] = useState<ActiveFarrowing | null>(null);
  const [quantity,     setQuantity]     = useState(1);
  const [movDate,      setMovDate]      = useState(new Date().toISOString().slice(0, 10));
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/farrowing-events?active=true")
      .then(r => r.json())
      .then((d: ActiveFarrowing[]) => setAllFarrowings(Array.isArray(d) ? d.filter(f => f.id !== farrowing.id) : []))
      .catch(() => {});
  }, [farrowing.id]);

  const filtered = otherSearch
    ? allFarrowings.filter(f => f.sow.identCode.toLowerCase().includes(otherSearch.toLowerCase()))
    : allFarrowings;

  const maxQty = accion === "DONA"
    ? farrowing.currentStock
    : (selectedOther ? selectedOther.currentStock : 999);

  async function handleSubmit() {
    if (!selectedOther) { setError("Seleccioná la cerda receptora/donadora"); return; }
    if (quantity < 1 || quantity > maxQty) { setError(`Cantidad debe ser entre 1 y ${maxQty}`); return; }

    const originId      = accion === "DONA" ? farrowing.id : selectedOther.id;
    const destinationId = accion === "DONA" ? selectedOther.id : farrowing.id;

    setSaving(true); setError(null);
    const res = await fetch(`/api/farrowing-events/${originId}/movements`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ originId, destinationId, movementDate: movDate, quantity }),
    });

    if (res.ok) {
      onSaved();
    } else {
      const err = await res.json();
      setError(err.error ?? "Error al guardar");
    }
    setSaving(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.55)",
    }}>
      <div className="kp-modal" style={{ width: 500 }}>
        {/* Header */}
        <div className="kp-modal-title">
          <IconArrowsLeftRight size={15} style={{ color: "var(--info)" }} aria-hidden />
          Movimiento de lechones — Cerda {farrowing.sow.identCode}
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
          >
            <IconX size={16} aria-hidden />
          </button>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          Stock actual: <strong style={{ color: "var(--text-primary)" }}>{farrowing.currentStock} lechones</strong>
        </p>

        {error && (
          <div className="kp-alert kp-alert-danger" style={{ marginBottom: 14 }}>
            <IconAlertTriangle size={13} /> {error}
          </div>
        )}

        {/* Acción */}
        <div style={{ marginBottom: 14 }}>
          <label className="kp-label">Acción *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["DONA", "RECIBE"] as const).map(a => (
              <button
                key={a}
                type="button"
                onClick={() => { setAccion(a); setSelectedOther(null); setOtherSearch(""); }}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: "var(--radius-md)",
                  border: `1.5px solid ${accion === a ? "var(--accent)" : "var(--border-default)"}`,
                  background: accion === a ? "var(--accent-subtle)" : "var(--bg-overlay)",
                  color:      accion === a ? "var(--accent-text)" : "var(--text-secondary)",
                  fontWeight: accion === a ? 600 : 400,
                  fontSize: 12, cursor: "pointer",
                }}
              >
                {a === "DONA" ? `Dona → otra cerda` : `Recibe ← otra cerda`}
              </button>
            ))}
          </div>
        </div>

        {/* Búsqueda cerda 2 */}
        <div style={{ marginBottom: 14 }}>
          <label className="kp-label">Cerda {accion === "DONA" ? "receptora" : "donadora"} *</label>
          {selectedOther ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "var(--accent-subtle)", borderRadius: "var(--radius-md)", padding: "8px 12px",
              border: "1px solid var(--accent-border)",
            }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--accent-text)" }}>
                  {selectedOther.sow.identCode}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
                  {selectedOther.currentStock} lechones disponibles
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOther(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
              >
                <IconX size={14} />
              </button>
            </div>
          ) : (
            <>
              <div style={{ position: "relative" }}>
                <IconSearch size={12} style={{
                  position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-muted)", pointerEvents: "none",
                }} />
                <input
                  className="kp-input"
                  style={{ paddingLeft: 26 }}
                  placeholder="Buscar por ID de cerda..."
                  value={otherSearch}
                  onChange={e => setOtherSearch(e.target.value)}
                />
              </div>
              {otherSearch && filtered.length > 0 && (
                <div style={{
                  border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)",
                  background: "var(--bg-surface)", marginTop: 4, maxHeight: 160, overflowY: "auto",
                }}>
                  {filtered.slice(0, 8).map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => { setSelectedOther(f); setOtherSearch(""); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "8px 12px", background: "none", border: "none",
                        cursor: "pointer", fontSize: 12, borderBottom: "0.5px solid var(--border-default)",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-overlay)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <span style={{ fontWeight: 500 }}>{f.sow.identCode}</span>
                      <span style={{ color: "var(--text-muted)", marginLeft: 8 }}>
                        {f.currentStock} lechones · {f.lactationDays} días lactancia
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {otherSearch && filtered.length === 0 && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Sin resultados</p>
              )}
            </>
          )}
        </div>

        {/* Fecha + cantidad */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
          <div>
            <label className="kp-label">Fecha del movimiento *</label>
            <input
              className="kp-input" type="date"
              value={movDate}
              onChange={e => setMovDate(e.target.value)}
            />
          </div>
          <div>
            <label className="kp-label">Cantidad *</label>
            <input
              className="kp-input" type="number" min={1} max={maxQty}
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
            />
            {quantity > maxQty && (
              <p style={{ fontSize: 11, color: "var(--danger-text)", marginTop: 3 }}>
                Supera el stock disponible ({maxQty})
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            type="button" className="btn btn-primary"
            disabled={saving || !selectedOther || quantity < 1 || quantity > maxQty}
            onClick={handleSubmit}
            style={{ minWidth: 150 }}
          >
            {saving
              ? <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              : `Registrar movimiento`}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
