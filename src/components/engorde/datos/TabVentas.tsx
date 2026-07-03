"use client";
import { useState, useEffect, useCallback } from "react";

interface Lote { id: string; batchCode: string; sitio: string | null }

const EMPTY = {
  growingBatchId: "", saleDate: new Date().toISOString().split("T")[0],
  buyerName: "", animalCount: "", totalWeightKg: "", pricePerKg: "",
  transferGuide: "", employeeId: "",
};

export function TabVentas() {
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

  const totalVenta = form.totalWeightKg && form.pricePerKg
    ? (Number(form.totalWeightKg) * Number(form.pricePerKg)).toLocaleString("es-PY")
    : "";
  const pesoMedio = form.animalCount && form.totalWeightKg
    ? (Number(form.totalWeightKg) / Number(form.animalCount)).toFixed(2)
    : "";

  async function handleGuardar() {
    if (!form.growingBatchId || !form.animalCount || !form.totalWeightKg || !form.pricePerKg) {
      alert("Completá Lote, Cantidad, Peso total y Precio");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/engorde/ventas", {
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
        Los datos de venta fluyen automáticamente al módulo Financiero.
      </div>

      {ok && (
        <div className="kp-alert kp-alert-success" style={{ fontSize: 12, marginBottom: 12 }}>
          Venta registrada correctamente
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="kp-label">Fecha de venta *</label>
            <input className="kp-input" type="date" value={form.saleDate} onChange={e => F("saleDate", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Comprador</label>
            <input className="kp-input" value={form.buyerName} onChange={e => F("buyerName", e.target.value)} placeholder="Razón social" />
          </div>
          <div>
            <label className="kp-label">Cantidad vendida *</label>
            <input className="kp-input" type="number" min={1} value={form.animalCount} onChange={e => F("animalCount", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Peso total (kg) *</label>
            <input className="kp-input" type="number" step="0.1" value={form.totalWeightKg} onChange={e => F("totalWeightKg", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Peso medio (kg)</label>
            <input className="kp-input" value={pesoMedio} readOnly style={{ background: "var(--bg-overlay)", color: "var(--text-muted)" }} />
          </div>
          <div>
            <label className="kp-label">Precio por kg (₲) *</label>
            <input className="kp-input" type="number" step="100" value={form.pricePerKg} onChange={e => F("pricePerKg", e.target.value)} />
          </div>
        </div>

        {totalVenta && (
          <div
            style={{
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: "var(--engorde-subtle)", border: "0.5px solid var(--engorde-border)",
              fontSize: 13, fontWeight: 600, color: "var(--engorde-text)",
            }}
          >
            Total venta: ₲ {totalVenta}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label className="kp-label">Guía de traslado N°</label>
            <input className="kp-input" value={form.transferGuide} onChange={e => F("transferGuide", e.target.value)} />
          </div>
        </div>

        <div style={{ paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? "Guardando..." : "Registrar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}
