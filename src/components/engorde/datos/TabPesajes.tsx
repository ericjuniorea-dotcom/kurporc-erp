"use client";
import { useState, useEffect, useCallback } from "react";
import { addDays } from "@/lib/utils";

interface Lote { id: string; batchCode: string; sitio: string | null; targetWeightKg: number }

const EMPTY = {
  growingBatchId: "", recordDate: new Date().toISOString().split("T")[0],
  animalCount: "", totalWeightKg: "", employeeId: "",
};

export function TabPesajes() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [resultado, setResultado] = useState<{ gdpGramsDia: number; exitDate: string; targetKg: number } | null>(null);
  const [ok, setOk] = useState(false);

  const loadLotes = useCallback(async () => {
    const r = await fetch("/api/engorde/lotes?estado=activo");
    if (r.ok) {
      const data = await r.json();
      setLotes(data.map((l: { id: string; batchCode: string; sitio: string | null; targetWeightKg: number }) => ({
        id: l.id, batchCode: l.batchCode, sitio: l.sitio, targetWeightKg: l.targetWeightKg,
      })));
    }
  }, []);

  useEffect(() => { loadLotes(); }, [loadLotes]);

  const F = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Calcular preview GDP en tiempo real
  const avgKgPreview = form.animalCount && form.totalWeightKg
    ? Number(form.totalWeightKg) / Number(form.animalCount)
    : null;

  async function handleGuardar() {
    if (!form.growingBatchId || !form.animalCount || !form.totalWeightKg) {
      alert("Completá Lote, Cantidad pesada y Peso total");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/engorde/pesajes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) {
      const data = await r.json();
      const lote = lotes.find(l => l.id === form.growingBatchId);
      const targetKg = lote?.targetWeightKg ?? 120;
      if (data.gdpGramsDia && avgKgPreview) {
        const diasRestantes = Math.ceil(((targetKg - avgKgPreview) * 1000) / data.gdpGramsDia);
        const exitDate = addDays(new Date(), Math.max(0, diasRestantes));
        setResultado({ gdpGramsDia: data.gdpGramsDia, exitDate: exitDate.toISOString().split("T")[0], targetKg });
      }
      setForm({ ...EMPTY }); setOk(true); setTimeout(() => setOk(false), 5000); loadLotes();
    } else { const e = await r.json(); alert(e.error ?? "Error al guardar"); }
  }

  function formatFecha(iso: string) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
        Registrá un pesaje para calcular la GDP y estimar fecha de salida.
      </div>

      {ok && resultado && (
        <div
          style={{
            padding: "12px 16px", marginBottom: 12,
            background: "var(--engorde-subtle)",
            border: "0.5px solid var(--engorde-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--engorde-text)", fontSize: 13, marginBottom: 4 }}>
            GDP calculada: {resultado.gdpGramsDia} g/día
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Estimación de salida a {resultado.targetKg} kg: {formatFecha(resultado.exitDate)}
          </div>
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
            <label className="kp-label">Fecha pesaje *</label>
            <input className="kp-input" type="date" value={form.recordDate} onChange={e => F("recordDate", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Cantidad pesada *</label>
            <input className="kp-input" type="number" min={1} value={form.animalCount} onChange={e => F("animalCount", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Peso total (kg) *</label>
            <input className="kp-input" type="number" step="0.1" value={form.totalWeightKg} onChange={e => F("totalWeightKg", e.target.value)} />
          </div>
          <div>
            <label className="kp-label">Peso medio (kg)</label>
            <input className="kp-input" value={avgKgPreview != null ? avgKgPreview.toFixed(2) : ""} readOnly
              style={{ background: "var(--bg-overlay)", color: "var(--text-muted)" }} />
          </div>
        </div>

        <div style={{ paddingTop: 4 }}>
          <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
            {saving ? "Guardando..." : "Registrar pesaje"}
          </button>
        </div>
      </div>
    </div>
  );
}
