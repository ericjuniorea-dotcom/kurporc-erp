"use client";
import { useState, useEffect, useCallback } from "react";
import { IconPlus, IconSearch, IconSkull, IconAlertTriangle, IconLoader2 } from "@tabler/icons-react";
import { EstadoBadgeBoar } from "./estado-badge";

const BOAR_STATES = [
  { value: "", label: "Todos los estados" },
  { value: "QUARANTINE", label: "Cuarentena" },
  { value: "ACTIVE", label: "Activo" },
  { value: "RESTING", label: "Descanso" },
  { value: "CULLED", label: "Descartado" },
  { value: "DEAD", label: "Muerto" },
];

const GENETIC_LINES = ["TN Rexne", "TN Duroc", "PIC", "Genesus", "NAIMA CG36", "Otra"];
const BREEDS = ["Yorkshire", "Landrace", "Duroc", "Hampshire", "Pietrain", "Híbrido", "Otra"];

interface Boar {
  id: string;
  erpCode: string | null;
  caravanaCode: string | null;
  identCode: string;
  plantelState: string | null;
  geneticLine: string | null;
  birthDate: string | null;
  galponAssigned: string | null;
  serviceEvents: Array<{ id: string }>;
  animalEvents: Array<{ eventType: string; eventDate: string; description: string | null }>;
}

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const days = Math.floor((Date.now() - new Date(birthDate).getTime()) / 86400000);
  if (days < 60)  return `${days}d`;
  if (days < 730) return `${Math.floor(days / 30)}m`;
  return `${(days / 365).toFixed(1)}a`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function VerracosTab() {
  const [boars, setBoars]         = useState<Boar[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [actionModal, setActionModal] = useState<{ boar: Boar; type: "death" | "discard" } | null>(null);
  const [saving, setSaving]       = useState(false);
  const [cause, setCause]         = useState("");
  const [actionNotes, setActionNotes] = useState("");

  const [form, setForm] = useState({
    caravanaCode: "", tattooCode: "", rfidChip: "", breed: "", geneticLine: "",
    birthDate: "", entryWeightKg: "", sourceProvider: "", purchasePriceGs: "",
    galponAssigned: "", corralAssigned: "", plantelNotes: "", initialDestination: "QUARANTINE",
  });

  const loadBoars = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (stateFilter) params.set("state", stateFilter);
      if (search)      params.set("search", search);
      const res = await fetch(`/api/plantel/verracos?${params}`);
      if (res.ok) setBoars(await res.json());
    } finally {
      setLoading(false);
    }
  }, [stateFilter, search]);

  useEffect(() => {
    const t = setTimeout(loadBoars, 300);
    return () => clearTimeout(t);
  }, [loadBoars]);

  async function handleSubmit() {
    if (!form.caravanaCode || !form.birthDate || !form.entryWeightKg || !form.sourceProvider || !form.geneticLine) {
      alert("Completá los campos obligatorios: Caravana, F. Nacimiento, Peso, Proveedor, Línea genética");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/plantel/verracos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ caravanaCode: "", tattooCode: "", rfidChip: "", breed: "", geneticLine: "",
          birthDate: "", entryWeightKg: "", sourceProvider: "", purchasePriceGs: "",
          galponAssigned: "", corralAssigned: "", plantelNotes: "", initialDestination: "QUARANTINE" });
        loadBoars();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAction() {
    if (!actionModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/plantel/verracos/${actionModal.boar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionModal.type === "death" ? "register_death" : "register_discard",
          cause, notes: actionNotes,
        }),
      });
      if (res.ok) {
        setActionModal(null);
        setCause(""); setActionNotes("");
        loadBoars();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleQuarantineRelease(boar: Boar) {
    await fetch(`/api/plantel/verracos/${boar.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "quarantine_release" }),
    });
    loadBoars();
  }

  const F = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            className="kp-input"
            placeholder="Buscar por código ERP o caravana…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <select
          className="kp-input"
          value={stateFilter}
          onChange={e => setStateFilter(e.target.value)}
          style={{ appearance: "auto", minWidth: 160 }}
        >
          {BOAR_STATES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus size={13} aria-hidden /> Registrar reproductor
        </button>
      </div>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : boars.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No se encontraron reproductores con los filtros actuales.
          </div>
        ) : (
          <table className="kp-table">
            <thead>
              <tr>
                <th>Código ERP</th>
                <th>Caravana</th>
                <th>Estado</th>
                <th>Línea genética</th>
                <th>Edad</th>
                <th>Total servicios</th>
                <th>Último evento</th>
                <th>Galpón</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {boars.map(boar => {
                const lastEv  = boar.animalEvents[0];
                const isDead  = boar.plantelState === "DEAD" || boar.plantelState === "CULLED";
                return (
                  <tr key={boar.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)" }}>
                      {boar.erpCode ?? "—"}
                    </td>
                    <td style={{ fontWeight: 500 }}>{boar.caravanaCode || boar.identCode}</td>
                    <td><EstadoBadgeBoar state={boar.plantelState} /></td>
                    <td style={{ color: "var(--text-secondary)" }}>{boar.geneticLine ?? "—"}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{calcAge(boar.birthDate)}</td>
                    <td style={{ textAlign: "center" }}>{boar.serviceEvents.length}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 11 }}>
                      {lastEv ? `${lastEv.eventType} · ${fmtDate(lastEv.eventDate)}` : "—"}
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{boar.galponAssigned ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {boar.plantelState === "QUARANTINE" && (
                          <button className="btn" style={{ fontSize: 10, height: 26 }} onClick={() => handleQuarantineRelease(boar)}>Alta</button>
                        )}
                        {!isDead && (
                          <>
                            <button className="btn" style={{ fontSize: 10, height: 26, color: "var(--danger-text)" }}
                              onClick={() => { setActionModal({ boar, type: "death" }); setCause(""); }} title="Registrar muerte">
                              <IconSkull size={11} />
                            </button>
                            <button className="btn" style={{ fontSize: 10, height: 26, color: "var(--warning-text)" }}
                              onClick={() => { setActionModal({ boar, type: "discard" }); setCause(""); }} title="Registrar descarte">
                              <IconAlertTriangle size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Registration modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 540, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Registrar reproductor</h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">Caravana *</label><input className="kp-input" value={form.caravanaCode} onChange={e => F("caravanaCode", e.target.value)} /></div>
                <div><label className="kp-label">Tatuaje</label><input className="kp-input" value={form.tattooCode} onChange={e => F("tattooCode", e.target.value)} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Raza</label>
                  <select className="kp-input" value={form.breed} onChange={e => F("breed", e.target.value)} style={{ appearance: "auto" }}>
                    <option value="">Seleccionar…</option>
                    {BREEDS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="kp-label">Línea genética *</label>
                  <select className="kp-input" value={form.geneticLine} onChange={e => F("geneticLine", e.target.value)} style={{ appearance: "auto" }}>
                    <option value="">Seleccionar…</option>
                    {GENETIC_LINES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">Fecha de nacimiento *</label><input className="kp-input" type="date" value={form.birthDate} onChange={e => F("birthDate", e.target.value)} /></div>
                <div><label className="kp-label">Peso al ingreso (kg) *</label><input className="kp-input" type="number" step="0.1" value={form.entryWeightKg} onChange={e => F("entryWeightKg", e.target.value)} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">Proveedor / Origen *</label><input className="kp-input" value={form.sourceProvider} onChange={e => F("sourceProvider", e.target.value)} /></div>
                <div><label className="kp-label">Precio de compra (₲)</label><input className="kp-input" type="number" value={form.purchasePriceGs} onChange={e => F("purchasePriceGs", e.target.value)} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label className="kp-label">Galpón asignado</label><input className="kp-input" value={form.galponAssigned} onChange={e => F("galponAssigned", e.target.value)} /></div>
                <div><label className="kp-label">Corral</label><input className="kp-input" value={form.corralAssigned} onChange={e => F("corralAssigned", e.target.value)} /></div>
              </div>
              <div>
                <label className="kp-label">Destino inicial *</label>
                <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
                  {[{ val: "QUARANTINE", label: "Cuarentena" }, { val: "ACTIVE", label: "Plantel activo" }].map(({ val, label }) => (
                    <label key={val} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
                      <input type="radio" name="boar_destination" value={val} checked={form.initialDestination === val} onChange={() => F("initialDestination", val)} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className="kp-label">Observaciones</label><textarea className="kp-input" rows={2} value={form.plantelNotes} onChange={e => F("plantelNotes", e.target.value)} style={{ height: "auto", paddingTop: 8, resize: "vertical" }} /></div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Registrar reproductor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Death/Discard modal */}
      {actionModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setActionModal(null)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--border-default)" }}>
              <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                {actionModal.type === "death" ? "Registrar muerte" : "Registrar descarte"}{" — "}
                <span style={{ color: "var(--accent)" }}>{actionModal.boar.caravanaCode || actionModal.boar.identCode}</span>
              </h2>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label className="kp-label">Causa *</label><input className="kp-input" value={cause} onChange={e => setCause(e.target.value)} /></div>
              <div><label className="kp-label">Observaciones</label><textarea className="kp-input" rows={2} value={actionNotes} onChange={e => setActionNotes(e.target.value)} style={{ height: "auto", paddingTop: 8, resize: "vertical" }} /></div>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setActionModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleAction} disabled={saving || !cause}>
                {saving ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
