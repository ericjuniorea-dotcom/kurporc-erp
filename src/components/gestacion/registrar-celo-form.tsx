"use client";
import { useState } from "react";
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import type { SowLite } from "./servicio-fields";

const todayIso = () => new Date().toISOString().slice(0, 10);

export function RegistrarCeloForm({
  sow,
  onDone,
  onCancel,
}: {
  sow: SowLite;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [heatDate, setHeatDate] = useState(todayIso());
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gestacion/registrar-celo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sowId: sow.id, heatDate, notes: notes || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Error al guardar");
        return;
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && (
        <div className="kp-alert kp-alert-danger" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconAlertTriangle size={15} />
          {error}
        </div>
      )}

      <div>
        <label className="kp-label">Fecha del último celo observado *</label>
        <input
          className="kp-input"
          type="date"
          value={heatDate}
          max={todayIso()}
          onChange={e => setHeatDate(e.target.value)}
        />
      </div>

      <div>
        <label className="kp-label">Observaciones (opcional)</label>
        <textarea
          className="kp-input"
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ej: celo débil, detectado por reflejo de tolerancia…"
          style={{ height: "auto", paddingTop: 8, resize: "vertical" }}
        />
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Este dato se usa para estimar la fecha en que la cerda estará lista para su primer servicio.
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || !heatDate}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          {saving ? <><IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Registrar último celo"}
        </button>
      </div>
    </div>
  );
}
