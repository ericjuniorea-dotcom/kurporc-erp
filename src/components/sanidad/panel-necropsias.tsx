"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession, usePermisos } from "@/lib/auth/sesion-cliente";
import { IconPlus, IconLoader2, IconX, IconAlertTriangle, IconFlame } from "@tabler/icons-react";
import { SowPicker } from "./sow-picker";

// Super Admin (1), Admin de granja (2) — únicos roles que pueden confirmar
// manualmente que una baja corresponde a un brote.
const CONFIRMA_BROTE_ROLES = [1, 2];

const todayIso = () => new Date().toISOString().slice(0, 10);

interface NecropsiaRow {
  id: string; caravana: string; causaSanitariaPresunta: string;
  seRealizoNecropsia: boolean; hallazgos: string | null; galpon: string | null;
  bajaConfirmaBrote: boolean; fecha: string;
}

export function PanelNecropsias() {
  const { data: session } = useSession();
  const { alguno } = usePermisos();
  const canConfirmarBrote = alguno(["sanidad.protocolos.editar"]);

  const [necropsias, setNecropsias] = useState<NecropsiaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [sow, setSow] = useState<{ id: string; identCode: string } | null>(null);
  const [causa, setCausa] = useState("");
  const [seRealizo, setSeRealizo] = useState(false);
  const [hallazgos, setHallazgos] = useState("");
  const [galpon, setGalpon] = useState("");
  const [confirmaBrote, setConfirmaBrote] = useState(false);
  const [fecha, setFecha] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/sanidad/necropsias")
      .then(r => r.ok ? r.json() : [])
      .then(setNecropsias)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit() {
    if (!sow) { setError("Seleccioná una cerda"); return; }
    if (!causa.trim()) { setError("La causa sanitaria presunta es requerida"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/sanidad/necropsias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sowId: sow.id, causaSanitariaPresunta: causa, seRealizoNecropsia: seRealizo,
          hallazgos: hallazgos || undefined, galpon: galpon || undefined, fecha,
          bajaConfirmaBrote: canConfirmarBrote ? confirmaBrote : false,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Error al guardar");
        return;
      }
      setShowForm(false);
      setSow(null); setCausa(""); setSeRealizo(false); setHallazgos(""); setGalpon(""); setConfirmaBrote(false); setFecha(todayIso());
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ fontSize: 12 }}>
          <IconPlus size={13} /> Nueva necropsia / baja
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
        </div>
      ) : necropsias.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", color: "var(--text-muted)", fontSize: 13 }}>
          Sin necropsias/bajas registradas.
        </div>
      ) : (
        <table className="kp-table" style={{ width: "100%" }}>
          <thead>
            <tr><th>Animal</th><th>Causa presunta</th><th>Galpón</th><th>Necropsia</th><th>Brote confirmado</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {necropsias.map(n => (
              <tr key={n.id}>
                <td style={{ fontWeight: 600 }}>{n.caravana}</td>
                <td>{n.causaSanitariaPresunta}</td>
                <td>{n.galpon ?? "—"}</td>
                <td style={{ fontSize: 11 }}>{n.seRealizoNecropsia ? "Sí" : "No"}</td>
                <td>
                  {n.bajaConfirmaBrote && (
                    <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--danger-text)", fontWeight: 600 }}>
                      <IconFlame size={12} /> Confirmado
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 11 }}>{new Date(n.fecha).toLocaleDateString("es-PY")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }} onClick={() => setShowForm(false)}>
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 460, padding: 18 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Nueva necropsia / baja</span>
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
                <label className="kp-label">Causa sanitaria presunta *</label>
                <input className="kp-input" value={causa} onChange={e => setCausa(e.target.value)} placeholder="Ej: Neumonía, torsión gástrica…" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="kp-label">Galpón</label>
                  <input className="kp-input" value={galpon} onChange={e => setGalpon(e.target.value)} placeholder="Ej: Galpón A" />
                </div>
                <div>
                  <label className="kp-label">Fecha</label>
                  <input className="kp-input" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={seRealizo} onChange={e => setSeRealizo(e.target.checked)} />
                Se realizó necropsia
              </label>
              {seRealizo && (
                <div>
                  <label className="kp-label">Hallazgos</label>
                  <textarea className="kp-input" rows={2} value={hallazgos} onChange={e => setHallazgos(e.target.value)} style={{ height: "auto", paddingTop: 8, resize: "vertical" }} />
                </div>
              )}
              {canConfirmarBrote && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, cursor: "pointer", padding: "8px 10px", background: "var(--danger-subtle)", borderRadius: "var(--radius-md)" }}>
                  <input type="checkbox" checked={confirmaBrote} onChange={e => setConfirmaBrote(e.target.checked)} style={{ marginTop: 2 }} />
                  <span><strong>Confirmar como brote</strong> — marcado administrativo manual, independiente de la alerta automática del heatmap.</span>
                </label>
              )}
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
