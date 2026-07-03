"use client";
import { useState, useEffect, useCallback } from "react";

const MOTIVOS = [
  { value: "SPACE_PRESSURE",    label: "Presión de espacio" },
  { value: "BATCH_REBALANCING", label: "Rebalanceo de lote" },
  { value: "HEALTH_ISSUE",      label: "Problema sanitario" },
  { value: "OTHER",             label: "Otro" },
];

interface Lote { id: string; batchCode: string; sitio: string | null }

const EMPTY = {
  sourceBatchId: "", targetBatchId: "", targetSite: "",
  transferDate: new Date().toISOString().split("T")[0],
  count: "", totalWeightKg: "", reason: "SPACE_PRESSURE", employeeId: "",
};

export function TabTransferencias() {
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

  const avgKg = form.count && form.totalWeightKg
    ? (Number(form.totalWeightKg) / Number(form.count)).toFixed(2)
    : "";

  async function handleGuardar() {
    if (!form.sourceBatchId || !form.count || !form.reason) {
      alert("Completá Lote origen, Cantidad y Motivo");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/engorde/transferencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) { setForm({ ...EMPTY }); setOk(true); setTimeout(() => setOk(false), 3000); loadLotes(); }
    else { const e = await r.json(); alert(e.error ?? "Error al guardar"); }
  }

  const lotesDestino = lotes.filter(l => l.id !== form.sourceBatchId);

  return (
    <div style={{ maxWidth: 520 }}>
      {ok && (
        <div className="kp-alert kp-alert-success" style={{ fontSize: 12, marginBottom: 12 }}>
          Transferencia registrada
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <label className="kp-label">Lote origen *</label>
          <select className="kp-input" value={form.sourceBatchId} onChange={e => F("sourceBatchId", e.target.value)}>
            <option value="">— Seleccionar —</option>
            {lotes.map(l => <option key={l.id} value={l.id}>{l.batchCode}{l.sitio ? ` · ${l.sitio}` : ""}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="kp-label">Lote destino</label>
            <select className="kp-input" value={form.targetBatchId} onChange={e => F("targetBatchId", e.target.value)}>
              <option value="">— Externo / sin lote —</option>
              {lotesDestino.map(l => <option key={l.id} value={l.id}>{l.batchCode}{l.sitio ? ` · ${l.sitio}` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="kp-label">Sitio destino</label>
            <input className="kp-input" value={form.targetSite} onChange={e => F("targetSite", e.target.value)} placeholder="Ej: Sitio 3" />
          </div>
          <div>
            <label className="kp-label">Fecha *</label>
            <input className="kp-input" type="date" value={form.transferDate} onChange={e => F("transferDate", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Cantidad *</label>
            <input className="kp-input" type="number" min={1} value={form.count} onChange={e => F("count", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Peso total (kg)</label>
            <input className="kp-input" type="number" step="0.1" value={form.totalWeightKg} onChange={e => F("totalWeightKg", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Peso medio (kg)</label>
            <input className="kp-input" value={avgKg} readOnly style={{ background: "var(--bg-overlay)", color: "var(--text-muted)" }} />
          </div>
        </div>

        <div>
          <label className="kp-label">Motivo *</label>
          <select className="kp-input" value={form.reason} onChange={e => F("reason", e.target.value)}>
            {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div style={{ paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? "Guardando..." : "Registrar transferencia"}
          </button>
        </div>
      </div>
    </div>
  );
}
