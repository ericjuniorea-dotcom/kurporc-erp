"use client";
import { useState, useEffect, useCallback } from "react";

const CAUSAS = [
  { value: "RESPIRATORY",   label: "Enfermedad respiratoria" },
  { value: "DIGESTIVE",     label: "Digestivo" },
  { value: "ACCIDENT",      label: "Accidente" },
  { value: "RENAL_URINARY", label: "Renal / urinario" },
  { value: "MULBERRY_HEART",label: "Sd. mulberry / corazón de mora" },
  { value: "OTHER",         label: "Otra" },
];

interface Lote { id: string; batchCode: string; sitio: string | null }

const EMPTY = {
  growingBatchId: "", deathDate: new Date().toISOString().split("T")[0],
  deathTime: "", count: "1", cause: "RESPIRATORY",
  estimatedWeightKg: "", notes: "", employeeId: "",
};

export function TabMuertes() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  const loadLotes = useCallback(async () => {
    const r = await fetch("/api/engorde/lotes?estado=activo");
    if (r.ok) setLotes(await r.json());
  }, []);

  useEffect(() => { loadLotes(); }, [loadLotes]);

  const F = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleGuardar() {
    if (!form.growingBatchId || !form.cause || !form.count) {
      alert("Completá Lote, Causa y Cantidad");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/engorde/muertes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) { setForm({ ...EMPTY }); setOk(true); setTimeout(() => setOk(false), 3000); loadLotes(); }
    else { const e = await r.json(); alert(e.error ?? "Error al guardar"); }
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
        Registrá bajas del lote. El stock se actualiza automáticamente.
      </div>

      {ok && (
        <div className="kp-alert kp-alert-success" style={{ fontSize: 12, marginBottom: 12 }}>
          Muerte registrada correctamente
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label className="kp-label">Lote *</label>
          <select className="kp-input" value={form.growingBatchId} onChange={e => F("growingBatchId", e.target.value)}>
            <option value="">— Seleccionar lote —</option>
            {lotes.map(l => (
              <option key={l.id} value={l.id}>{l.batchCode}{l.sitio ? ` · ${l.sitio}` : ""}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="kp-label">Fecha *</label>
            <input className="kp-input" type="date" value={form.deathDate} onChange={e => F("deathDate", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Hora</label>
            <input className="kp-input" type="time" value={form.deathTime} onChange={e => F("deathTime", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Cantidad *</label>
            <input className="kp-input" type="number" min={1} value={form.count} onChange={e => F("count", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Peso estimado (kg)</label>
            <input className="kp-input" type="number" step="0.5" value={form.estimatedWeightKg} onChange={e => F("estimatedWeightKg", e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        <div>
          <label className="kp-label">Causa *</label>
          <select className="kp-input" value={form.cause} onChange={e => F("cause", e.target.value)}>
            {CAUSAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        <div>
          <label className="kp-label">Observaciones</label>
          <textarea className="kp-input" value={form.notes} onChange={e => F("notes", e.target.value)}
            style={{ height: 60, resize: "vertical" }} placeholder="Opcional" />
        </div>

        <div style={{ paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? "Guardando..." : "Registrar baja"}
          </button>
        </div>
      </div>
    </div>
  );
}
