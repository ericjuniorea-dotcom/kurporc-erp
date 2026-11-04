"use client";
import { Fragment, useState, useEffect, useCallback } from "react";
import { IconLoader2, IconShieldCheck, IconShieldX, IconShieldExclamation, IconVaccine, IconX } from "@tabler/icons-react";

interface VacunaCarnet {
  id:                string;
  nombreVacuna:      string;
  marcaComercial:    string;
  obligatoria:       boolean;
  viaAplicacion:     string;
  dosisMl:           string;
  momentoAplicacion: string;
  refuerzoDias:      number | null;
  ultimaAplicacion:  string | null;
  proximaAplicacion: string | null;
  estado:            "AL_DIA" | "PROXIMA" | "VENCIDA" | "NO_APLICADA";
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function todayStr() { return new Date().toISOString().split("T")[0]; }

const EMPTY_APLICACION_FORM = { fechaAplicacion: todayStr(), responsable: "", lote: "", observaciones: "" };

const ESTADO_CONFIG: Record<string, { label: string; bg: string; color: string; border: string; icon: typeof IconShieldCheck }> = {
  AL_DIA:     { label: "Al día",    bg: "var(--success-subtle)",  color: "var(--success-text)",  border: "var(--success-border)", icon: IconShieldCheck },
  PROXIMA:    { label: "Próxima",   bg: "var(--warning-subtle)",  color: "var(--warning-text)",  border: "var(--warning-border)", icon: IconShieldExclamation },
  VENCIDA:    { label: "Vencida",   bg: "var(--danger-subtle)",   color: "var(--danger-text)",   border: "var(--danger-border)",  icon: IconShieldX },
  NO_APLICADA:{ label: "No aplic.", bg: "var(--bg-overlay)",      color: "var(--text-muted)",    border: "var(--border-default)", icon: IconShieldX },
};

export function TabVacunas({ sowId }: { sowId: string }) {
  const [carnet,  setCarnet]  = useState<VacunaCarnet[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId,  setOpenId]  = useState<string | null>(null);
  const [form,    setForm]    = useState({ ...EMPTY_APLICACION_FORM });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/plantel/animales/${sowId}/vacunas`)
      .then(r => r.json())
      .then(d => setCarnet(d.carnet ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sowId]);

  useEffect(() => { load(); }, [load]);

  function abrirForm(vacunaId: string) {
    setOpenId(vacunaId);
    setForm({ ...EMPTY_APLICACION_FORM });
    setError(null);
  }

  async function registrarAplicacion(vacunaId: string) {
    if (!form.responsable.trim()) { setError("El responsable es requerido"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/plantel/animales/${sowId}/vacunas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configVacunaId: vacunaId,
          fechaAplicacion: form.fechaAplicacion,
          responsable: form.responsable,
          lote: form.lote || null,
          observaciones: form.observaciones || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Error al registrar");
        return;
      }
      setOpenId(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
        <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando carnet…</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (carnet.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px 0", gap: 8, textAlign: "center",
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)",
      }}>
        <IconShieldCheck size={28} style={{ color: "var(--text-muted)" }} />
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Sin vacunas configuradas</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Configurá el protocolo sanitario en Configuración → Sanidad
        </div>
      </div>
    );
  }

  // Stats
  const alDia     = carnet.filter(v => v.estado === "AL_DIA").length;
  const proximas  = carnet.filter(v => v.estado === "PROXIMA").length;
  const vencidas  = carnet.filter(v => v.estado === "VENCIDA").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Status pills */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {alDia > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--success-subtle)", border: "0.5px solid var(--success-border)", color: "var(--success-text)", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>
            <IconShieldCheck size={11} /> {alDia} al día
          </span>
        )}
        {proximas > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--warning-subtle)", border: "0.5px solid var(--warning-border)", color: "var(--warning-text)", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>
            <IconShieldExclamation size={11} /> {proximas} próxima{proximas > 1 ? "s" : ""}
          </span>
        )}
        {vencidas > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, background: "var(--danger-subtle)", border: "0.5px solid var(--danger-border)", color: "var(--danger-text)", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 500 }}>
            <IconShieldX size={11} /> {vencidas} vencida{vencidas > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="kp-table">
          <thead>
            <tr>
              <th>Vacuna</th>
              <th>Vía / Dosis</th>
              <th>Última aplic.</th>
              <th>Próxima</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {carnet.map(v => {
              const cfg = ESTADO_CONFIG[v.estado];
              const Icon = cfg.icon;
              const isOpen = openId === v.id;
              return (
                <Fragment key={v.id}>
                  <tr>
                    <td>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 12 }}>
                        {v.nombreVacuna}
                        {v.obligatoria && (
                          <span style={{ marginLeft: 5, fontSize: 9, background: "var(--accent-subtle)", color: "var(--accent-text)", border: "0.5px solid var(--accent-border)", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                            OBL
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{v.marcaComercial}</div>
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {v.viaAplicacion} · {v.dosisMl} ml
                    </td>
                    <td style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                      {fmtDate(v.ultimaAplicacion)}
                    </td>
                    <td style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: v.estado === "PROXIMA" ? "var(--warning-text)" : v.estado === "VENCIDA" ? "var(--danger-text)" : "var(--text-secondary)" }}>
                      {fmtDate(v.proximaAplicacion)}
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "2px 7px", borderRadius: 4, background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}`, fontWeight: 500 }}>
                        <Icon size={10} />
                        {cfg.label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn"
                        style={{ height: 26, fontSize: 10, padding: "0 8px" }}
                        onClick={() => isOpen ? setOpenId(null) : abrirForm(v.id)}
                      >
                        {isOpen ? <IconX size={11} /> : <IconVaccine size={11} />}
                        {isOpen ? "Cancelar" : "Registrar aplicación"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ background: "var(--bg-elevated)", padding: "12px 14px" }}>
                        {error && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 8 }}>{error}</div>}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <div>
                            <label className="kp-label" style={{ fontSize: 10 }}>Fecha de aplicación *</label>
                            <input
                              className="kp-input" type="date" value={form.fechaAplicacion}
                              onChange={e => setForm(f => ({ ...f, fechaAplicacion: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="kp-label" style={{ fontSize: 10 }}>Responsable *</label>
                            <input
                              className="kp-input" value={form.responsable} placeholder="Nombre"
                              onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="kp-label" style={{ fontSize: 10 }}>N° de lote</label>
                            <input
                              className="kp-input" value={form.lote} placeholder="Opcional"
                              onChange={e => setForm(f => ({ ...f, lote: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="kp-label" style={{ fontSize: 10 }}>Observaciones</label>
                            <input
                              className="kp-input" value={form.observaciones} placeholder="Opcional"
                              onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 10 }}>
                          Podés usar una fecha anterior al ingreso si la cerda ya venía vacunada de otra granja.
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <button
                            className="btn btn-primary" style={{ height: 28, fontSize: 11 }}
                            onClick={() => registrarAplicacion(v.id)} disabled={saving}
                          >
                            {saving ? <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <IconShieldCheck size={12} />}
                            {saving ? "Guardando…" : "Confirmar aplicación"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
