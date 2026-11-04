"use client";
import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconLoader2, IconX, IconAlertTriangle } from "@tabler/icons-react";

const PROCEDIMIENTOS = [
  { value: "DESCOLMILLADO", label: "Descolmillado" },
  { value: "CORTE_COLA",    label: "Corte de cola" },
  { value: "CORTE_OMBLIGO", label: "Corte de ombligo" },
  { value: "HIERRO",        label: "Hierro" },
  { value: "CASTRACION",    label: "Castración" },
];

interface Registro {
  id: string;
  caravana: string;
  tamanoCamada: number;
  procedimientoLabel: string;
  cantidadLechonesProcesados: number;
  edadDiasAlProcedimiento: number;
  observacionesTecnica: string | null;
  fecha: string;
}

interface CamadaOption { id: string; label: string; bornAlive: number }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function PanelMaternidadSanidad() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [camadas, setCamadas]     = useState<CamadaOption[]>([]);

  const [farrowingId, setFarrowingId] = useState("");
  const [procedimiento, setProcedimiento] = useState("DESCOLMILLADO");
  const [cantidad, setCantidad] = useState("");
  const [edad, setEdad] = useState("1");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/sanidad/maternidad")
      .then(r => r.ok ? r.json() : [])
      .then(setRegistros)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openForm() {
    setShowForm(true);
    fetch("/api/farrowing-events?active=true")
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ id: string; sow: { identCode: string }; bornAlive: number }>) => {
        setCamadas(data.map(f => ({ id: f.id, label: `${f.sow.identCode} — ${f.bornAlive} vivos`, bornAlive: f.bornAlive })));
      })
      .catch(() => {});
  }

  function handleCamadaChange(id: string) {
    setFarrowingId(id);
    const c = camadas.find(c => c.id === id);
    if (c) setCantidad(String(c.bornAlive));
  }

  async function handleSubmit() {
    if (!farrowingId || !cantidad || !edad) { setError("Completá camada, cantidad y edad"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/sanidad/maternidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farrowingId, procedimiento,
          cantidadLechonesProcesados: Number(cantidad),
          edadDiasAlProcedimiento: Number(edad),
          observacionesTecnica: observaciones || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Error al guardar");
        return;
      }
      setShowForm(false);
      setFarrowingId(""); setCantidad(""); setEdad("1"); setObservaciones("");
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={openForm} style={{ fontSize: 12 }}>
          <IconPlus size={13} /> Nuevo procedimiento
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
        </div>
      ) : registros.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", color: "var(--text-muted)", fontSize: 13 }}>
          Sin procedimientos de maternidad registrados.
        </div>
      ) : (
        <table className="kp-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Camada</th><th>Procedimiento</th><th>Lechones</th><th>Edad</th><th>Fecha</th><th>Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {registros.map(r => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.caravana}</td>
                <td>{r.procedimientoLabel}</td>
                <td>{r.cantidadLechonesProcesados} / {r.tamanoCamada}</td>
                <td>{r.edadDiasAlProcedimiento}d</td>
                <td>{fmtDate(r.fecha)}</td>
                <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.observacionesTecnica ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 460, padding: 18 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Nuevo procedimiento de maternidad</span>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><IconX size={16} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {error && (
                <div className="kp-alert kp-alert-danger" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <IconAlertTriangle size={15} />{error}
                </div>
              )}
              <div>
                <label className="kp-label">Camada (por madre) *</label>
                <select className="kp-input" value={farrowingId} onChange={e => handleCamadaChange(e.target.value)} style={{ appearance: "auto" }}>
                  <option value="">Seleccionar…</option>
                  {camadas.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="kp-label">Procedimiento *</label>
                <select className="kp-input" value={procedimiento} onChange={e => setProcedimiento(e.target.value)} style={{ appearance: "auto" }}>
                  {PROCEDIMIENTOS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Lechones procesados *</label>
                  <input className="kp-input" type="number" min={0} value={cantidad} onChange={e => setCantidad(e.target.value)} />
                </div>
                <div>
                  <label className="kp-label">Edad (días) *</label>
                  <input className="kp-input" type="number" min={0} value={edad} onChange={e => setEdad(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="kp-label">Observaciones técnicas</label>
                <textarea className="kp-input" rows={2} value={observaciones} onChange={e => setObservaciones(e.target.value)} style={{ height: "auto", paddingTop: 8, resize: "vertical" }} placeholder="Ej: sin sangrado, cicatrización normal…" />
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
