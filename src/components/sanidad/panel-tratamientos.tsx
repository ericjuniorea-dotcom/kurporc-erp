"use client";
import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconLoader2, IconX, IconAlertTriangle } from "@tabler/icons-react";
import { SowPicker } from "./sow-picker";

const DIAGNOSIS_TYPES = [
  { value: "DIARRHEA",  label: "Diarrea" },
  { value: "ARTHRITIS", label: "Artritis" },
  { value: "PNEUMONIA", label: "Neumonía" },
  { value: "OTHER",     label: "Otro" },
];

const ESTADOS = [
  { value: "",               label: "Todos" },
  { value: "ACTIVO",         label: "Activos" },
  { value: "EN_SEGUIMIENTO", label: "En seguimiento" },
  { value: "FINALIZADO",     label: "Finalizados" },
  { value: "ABANDONADO",     label: "Abandonados" },
];

const ESTADO_COLOR: Record<string, string> = {
  ACTIVO: "var(--warning-text)", EN_SEGUIMIENTO: "var(--info-text)",
  FINALIZADO: "var(--success-text)", ABANDONADO: "var(--text-muted)",
};

interface Tratamiento {
  id: string; caravana: string; medicamento: string;
  diagnosisType: string; motivoClinico: string | null;
  dosis: number; animalsAffected: number; estado: string;
  startDate: string; withdrawalDays: number;
}

interface Medicamento { id: string; name: string }

const todayIso = () => new Date().toISOString().slice(0, 10);

export function PanelTratamientos() {
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);

  const [sow, setSow] = useState<{ id: string; identCode: string } | null>(null);
  const [medicineId, setMedicineId] = useState("");
  const [nuevoMedNombre, setNuevoMedNombre] = useState("");
  const [diagnosisType, setDiagnosisType] = useState("OTHER");
  const [motivoClinico, setMotivoClinico] = useState("");
  const [doseMl, setDoseMl] = useState("");
  const [animalsAffected, setAnimalsAffected] = useState("1");
  const [withdrawalDays, setWithdrawalDays] = useState("0");
  const [startDate, setStartDate] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/sanidad/tratamientos${filtroEstado ? `?estado=${filtroEstado}` : ""}`)
      .then(r => r.ok ? r.json() : [])
      .then(setTratamientos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filtroEstado]);

  useEffect(() => { load(); }, [load]);

  function openForm() {
    setShowForm(true);
    fetch("/api/sanidad/medicamentos").then(r => r.ok ? r.json() : []).then(setMedicamentos).catch(() => {});
  }

  async function handleNuevoMedicamento() {
    if (!nuevoMedNombre.trim()) return;
    const res = await fetch("/api/sanidad/medicamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nuevoMedNombre.trim() }),
    });
    if (res.ok) {
      const m = await res.json();
      setMedicamentos(prev => [...prev, m]);
      setMedicineId(m.id);
      setNuevoMedNombre("");
    }
  }

  async function handleSubmit() {
    if (!sow) { setError("Seleccioná una cerda"); return; }
    if (!medicineId) { setError("Seleccioná (o creá) un medicamento"); return; }
    if (!doseMl) { setError("Ingresá la dosis"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/sanidad/tratamientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sowId: sow.id, medicineId, diagnosisType, motivoClinico: motivoClinico || undefined,
          doseMl: Number(doseMl), animalsAffected: Number(animalsAffected),
          withdrawalDays: Number(withdrawalDays), startDate,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Error al guardar");
        return;
      }
      setShowForm(false);
      setSow(null); setMedicineId(""); setMotivoClinico(""); setDoseMl("");
      setAnimalsAffected("1"); setWithdrawalDays("0"); setStartDate(todayIso());
      load();
    } finally {
      setSaving(false);
    }
  }

  async function cambiarEstado(id: string, estado: string) {
    await fetch("/api/sanidad/tratamientos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {ESTADOS.map(e => (
            <button
              key={e.value}
              onClick={() => setFiltroEstado(e.value)}
              style={{
                fontSize: 11, padding: "5px 10px", borderRadius: "var(--radius-md)",
                border: `0.5px solid ${filtroEstado === e.value ? "var(--accent)" : "var(--border-default)"}`,
                background: filtroEstado === e.value ? "var(--accent-subtle)" : "var(--bg-overlay)",
                color: filtroEstado === e.value ? "var(--accent)" : "var(--text-muted)", cursor: "pointer",
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={openForm} style={{ fontSize: 12 }}>
          <IconPlus size={13} /> Nuevo tratamiento
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
        </div>
      ) : tratamientos.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", color: "var(--text-muted)", fontSize: 13 }}>
          Sin tratamientos registrados.
        </div>
      ) : (
        <table className="kp-table" style={{ width: "100%" }}>
          <thead>
            <tr><th>Cerda</th><th>Medicamento</th><th>Motivo</th><th>Dosis</th><th>Estado</th><th>Inicio</th><th>Carencia</th></tr>
          </thead>
          <tbody>
            {tratamientos.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.caravana}</td>
                <td>{t.medicamento}</td>
                <td style={{ fontSize: 11 }}>{t.motivoClinico ?? DIAGNOSIS_TYPES.find(d => d.value === t.diagnosisType)?.label}</td>
                <td>{t.dosis}ml</td>
                <td>
                  <select
                    value={t.estado}
                    onChange={e => cambiarEstado(t.id, e.target.value)}
                    style={{ fontSize: 11, fontWeight: 500, color: ESTADO_COLOR[t.estado], border: "none", background: "none", cursor: "pointer" }}
                  >
                    {ESTADOS.slice(1).map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </td>
                <td style={{ fontSize: 11 }}>{new Date(t.startDate).toLocaleDateString("es-PY")}</td>
                <td style={{ fontSize: 11 }}>{t.withdrawalDays > 0 ? `${t.withdrawalDays}d` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }} onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 460, padding: 18 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Nuevo tratamiento clínico</span>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {error && (
                <div className="kp-alert kp-alert-danger" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconAlertTriangle size={15} />{error}
                </div>
              )}
              <div>
                <label className="kp-label">Cerda *</label>
                <SowPicker value={sow} onChange={setSow} />
              </div>
              <div>
                <label className="kp-label">Medicamento *</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <select className="kp-input" value={medicineId} onChange={e => setMedicineId(e.target.value)} style={{ appearance: "auto", flex: 1 }}>
                    <option value="">Seleccionar…</option>
                    {medicamentos.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input className="kp-input" value={nuevoMedNombre} onChange={e => setNuevoMedNombre(e.target.value)} placeholder="…o cargar uno nuevo" style={{ fontSize: 12 }} />
                  <button type="button" className="btn" onClick={handleNuevoMedicamento} style={{ fontSize: 11, whiteSpace: "nowrap" }}>+ Agregar</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Diagnóstico</label>
                  <select className="kp-input" value={diagnosisType} onChange={e => setDiagnosisType(e.target.value)} style={{ appearance: "auto" }}>
                    {DIAGNOSIS_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="kp-label">Dosis (ml) *</label>
                  <input className="kp-input" type="number" step="0.1" value={doseMl} onChange={e => setDoseMl(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="kp-label">Motivo clínico</label>
                <input className="kp-input" value={motivoClinico} onChange={e => setMotivoClinico(e.target.value)} placeholder="Descripción libre del cuadro clínico" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Fecha de inicio</label>
                  <input className="kp-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="kp-label">Días de carencia</label>
                  <input className="kp-input" type="number" min={0} value={withdrawalDays} onChange={e => setWithdrawalDays(e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? <><IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
