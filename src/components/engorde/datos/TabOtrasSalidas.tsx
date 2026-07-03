"use client";
import { useState, useEffect, useCallback } from "react";

const TIPOS = [
  { value: "DISCARD",  label: "Descarte" },
  { value: "HOSPITAL", label: "Hospital (no descuenta del stock)" },
  { value: "SAMPLE",   label: "Muestra" },
  { value: "DONATION", label: "Donación" },
  { value: "OTHER",    label: "Otro" },
];

interface Lote { id: string; batchCode: string; sitio: string | null }

const EMPTY = {
  growingBatchId: "", exitType: "DISCARD", exitDate: new Date().toISOString().split("T")[0],
  count: "1", estimatedWeightKg: "", reason: "", employeeId: "",
};

export function TabOtrasSalidas() {
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
    if (!form.growingBatchId || !form.count || !form.reason) {
      alert("Completá Lote, Cantidad y Motivo");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/engorde/otras-salidas", {
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
        Los animales en Hospital siguen en el stock pero se diferencian en el KPI.
      </div>

      {ok && (
        <div className="kp-alert kp-alert-success" style={{ fontSize: 12, marginBottom: 12 }}>
          Salida registrada correctamente
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label className="kp-label">Lote *</label>
          <select className="kp-input" value={form.growingBatchId} onChange={e => F("growingBatchId", e.target.value)}>
            <option value="">— Seleccionar lote —</option>
            {lotes.map(l => <option key={l.id} value={l.id}>{l.batchCode}{l.sitio ? ` · ${l.sitio}` : ""}</option>)}
          </select>
        </div>

        <div>
          <label className="kp-label">Tipo de salida *</label>
          <select className="kp-input" value={form.exitType} onChange={e => F("exitType", e.target.value)}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="kp-label">Fecha *</label>
            <input className="kp-input" type="date" value={form.exitDate} onChange={e => F("exitDate", e.target.value)} />
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
          <label className="kp-label">Motivo *</label>
          <input className="kp-input" value={form.reason} onChange={e => F("reason", e.target.value)} placeholder="Describí el motivo" />
        </div>

        <div style={{ paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? "Guardando..." : "Registrar salida"}
          </button>
        </div>
      </div>
    </div>
  );
}
