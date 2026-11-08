"use client";
import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { formatDate } from "@/lib/utils";

interface Lote {
  id: string;
  batchCode: string;
  sitio: string | null;
  status: string;
  currentCount: number;
  diasAlojamiento: number;
  avgWeightKg: number;
  gdpGramsDia: number | null;
  gdpStatus: "ok" | "warn" | "bad" | null;
  estimatedExitDate: string | null;
  progressPct: number | null;
  totalDeaths: number;
  hospitalCount: number;
  discardedCount: number;
  entryDate: string;
}

const EMPTY_FORM = {
  batchCode: "", sitio: "", procedencia: "RECRIA_PROPIA",
  entryDate: new Date().toISOString().split("T")[0],
  currentCount: "", entryWeightKg: "", avgAgeAtEntryDays: "",
  targetWeightKg: "120", employeeId: "", observations: "", costoIngresoGs: "", proveedor: "",
};

function gdpColor(status: "ok" | "warn" | "bad" | null) {
  if (status === "ok")  return "var(--success)";
  if (status === "warn") return "var(--warning)";
  if (status === "bad")  return "var(--danger)";
  return "var(--text-muted)";
}

export function TabLotes() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/engorde/lotes");
    if (r.ok) setLotes(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const F = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleGuardar() {
    if (!form.batchCode || !form.currentCount || !form.entryWeightKg) {
      alert("Completá los campos obligatorios (*)");
      return;
    }
    setSaving(true);
    const r = await fetch("/api/engorde/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (r.ok) { setShowModal(false); setForm({ ...EMPTY_FORM }); load(); }
    else { const e = await r.json(); alert(e.error ?? "Error al guardar"); }
  }

  const pesoMedioCalc = form.currentCount && form.entryWeightKg
    ? (Number(form.entryWeightKg) / Number(form.currentCount)).toFixed(2)
    : "";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <IconPlus size={13} /> Nuevo lote
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 32, color: "var(--text-muted)", fontSize: 12 }}>Cargando lotes...</div>
      ) : !lotes.length ? (
        <div className="kp-alert kp-alert-info" style={{ fontSize: 12 }}>
          Sin lotes registrados. Creá el primer lote de engorde.
        </div>
      ) : (
        <table className="kp-table">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Sitio</th>
              <th style={{ textAlign: "right" }}>Animales</th>
              <th style={{ textAlign: "right" }}>Días aloj.</th>
              <th style={{ textAlign: "right" }}>Peso medio</th>
              <th style={{ textAlign: "right" }}>GDP</th>
              <th>Progreso</th>
              <th>Prev. salida</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {lotes.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight: 600, fontSize: 12 }}>{l.batchCode}</td>
                <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.sitio ?? "—"}</td>
                <td style={{ textAlign: "right", fontSize: 12 }}>{l.currentCount.toLocaleString("es-PY")}</td>
                <td style={{ textAlign: "right", fontSize: 12 }}>{l.diasAlojamiento}</td>
                <td style={{ textAlign: "right", fontSize: 12 }}>
                  {l.avgWeightKg > 0 ? `${l.avgWeightKg} kg` : "—"}
                </td>
                <td style={{ textAlign: "right", fontSize: 12, fontWeight: 600, color: gdpColor(l.gdpStatus) }}>
                  {l.gdpGramsDia != null ? `${l.gdpGramsDia} g` : "—"}
                </td>
                <td style={{ minWidth: 80 }}>
                  {l.progressPct != null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ flex: 1, height: 5, background: "var(--bg-overlay)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${l.progressPct}%`,
                          background: gdpColor(l.gdpStatus),
                          borderRadius: 3,
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{l.progressPct}%</span>
                    </div>
                  ) : "—"}
                </td>
                <td style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {l.estimatedExitDate ? formatDate(l.estimatedExitDate) : "—"}
                </td>
                <td>
                  <span className={`badge ${l.status === "ACTIVE" ? "badge-success" : "badge-muted"}`} style={{ fontSize: 10 }}>
                    {l.status === "ACTIVE" ? "Activo" : "Cerrado"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal nuevo lote */}
      {showModal && (
        <div className="kp-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="kp-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="kp-modal-header">
              <span>Nuevo lote de engorde</span>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
                <IconX size={16} />
              </button>
            </div>
            <div className="kp-modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="kp-label">Nro. de lote *</label>
                  <input className="kp-input" value={form.batchCode} onChange={e => F("batchCode", e.target.value)} placeholder="Ej: 2025-001" />
                </div>
                <div>
                  <label className="kp-label">Sitio / ubicación</label>
                  <input className="kp-input" value={form.sitio} onChange={e => F("sitio", e.target.value)} placeholder="Ej: Sitio 2" />
                </div>
                <div>
                  <label className="kp-label">Procedencia</label>
                  <select className="kp-input" value={form.procedencia} onChange={e => F("procedencia", e.target.value)}>
                    <option value="RECRIA_PROPIA">Recría propia</option>
                    <option value="COMPRA_EXTERNA">Compra externa</option>
                  </select>
                </div>
                {form.procedencia === "COMPRA_EXTERNA" && (
                  <>
                    <div>
                      <label className="kp-label">Proveedor</label>
                      <input className="kp-input" value={form.proveedor} onChange={e => F("proveedor", e.target.value)} maxLength={120} />
                    </div>
                    <div>
                      <label className="kp-label">Total pagado por los animales (₲)</label>
                      <input className="kp-input" inputMode="numeric" value={form.costoIngresoGs} onChange={e => F("costoIngresoGs", e.target.value.replace(/[^0-9]/g, ""))} placeholder="Queda en Finanzas como gasto pendiente" />
                    </div>
                  </>
                )}
                <div>
                  <label className="kp-label">Fecha de ingreso *</label>
                  <input className="kp-input" type="date" value={form.entryDate} onChange={e => F("entryDate", e.target.value)} />
                </div>
                <div>
                  <label className="kp-label">Cantidad inicial *</label>
                  <input className="kp-input" type="number" min={1} value={form.currentCount} onChange={e => F("currentCount", e.target.value)} placeholder="466" />
                </div>
                <div>
                  <label className="kp-label">Peso total ingreso (kg) *</label>
                  <input className="kp-input" type="number" step="0.1" value={form.entryWeightKg} onChange={e => F("entryWeightKg", e.target.value)} placeholder="23750" />
                </div>
                <div>
                  <label className="kp-label">Peso medio ingreso (kg)</label>
                  <input className="kp-input" value={pesoMedioCalc} readOnly style={{ background: "var(--bg-overlay)", color: "var(--text-muted)" }} />
                </div>
                <div>
                  <label className="kp-label">Edad media al ingreso (días)</label>
                  <input className="kp-input" type="number" min={0} value={form.avgAgeAtEntryDays} onChange={e => F("avgAgeAtEntryDays", e.target.value)} placeholder="63" />
                </div>
                <div>
                  <label className="kp-label">Peso objetivo de salida (kg)</label>
                  <input className="kp-input" type="number" step="0.5" value={form.targetWeightKg} onChange={e => F("targetWeightKg", e.target.value)} placeholder="120" />
                </div>
                <div>
                  <label className="kp-label">Responsable (ID empleado)</label>
                  <input className="kp-input" value={form.employeeId} onChange={e => F("employeeId", e.target.value)} placeholder="Opcional" />
                </div>
              </div>
              <div>
                <label className="kp-label">Observaciones</label>
                <textarea className="kp-input" value={form.observations} onChange={e => F("observations", e.target.value)}
                  style={{ height: 64, resize: "vertical" }} placeholder="Opcional" />
              </div>
            </div>
            <div className="kp-modal-footer">
              <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGuardar} disabled={saving}>
                {saving ? "Guardando..." : "Crear lote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
