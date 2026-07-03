"use client";
import { useState, useEffect } from "react";
import { IconLoader2, IconCheck } from "@tabler/icons-react";

interface GestanteOption {
  sowId:         string;
  caravana:      string;
  diasGestacion: number;
  plantelState:  string;
}

const CAUSAS = [
  "Desconocida",
  "Infección uterina",
  "Estrés calórico",
  "Trauma físico",
  "Viral / bacteriana",
  "Deficiencia nutricional",
  "Toxinas",
  "Otra",
];

export function FormAborto() {
  const [gestantes,   setGestantes]   = useState<GestanteOption[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);

  const [sowId,         setSowId]         = useState("");
  const [fechaAborto,   setFechaAborto]   = useState(() => new Date().toISOString().slice(0, 10));
  const [causa,         setCausa]         = useState("Desconocida");
  const [diagVet,       setDiagVet]       = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving,        setSaving]        = useState(false);
  const [msg,           setMsg]           = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/gestacion/prenadas-detail").then(r => r.ok ? r.json() : []),
      fetch("/api/gestacion/pendientes-diagnostico").then(r => r.ok ? r.json() : []),
    ]).then(([prenadas, matedList]) => {
      const combined: GestanteOption[] = [
        ...(Array.isArray(prenadas) ? (prenadas as Record<string, unknown>[]).map(p => ({
          sowId:         String(p.sowId),
          caravana:      String(p.caravana),
          diasGestacion: Number(p.diasGestacion),
          plantelState:  "PREGNANT",
        })) : []),
        ...(Array.isArray(matedList) ? (matedList as Record<string, unknown>[]).map(p => ({
          sowId:         String(p.sowId),
          caravana:      String(p.identCode),
          diasGestacion: Number(p.diasPostServicio),
          plantelState:  "MATED",
        })) : []),
      ];
      // Deduplicar por sowId (PREGNANT tiene prioridad)
      const seen = new Set<string>();
      const deduped: GestanteOption[] = [];
      for (const o of combined) {
        if (!seen.has(o.sowId)) { seen.add(o.sowId); deduped.push(o); }
      }
      setGestantes(deduped.sort((a, b) => a.caravana.localeCompare(b.caravana)));
    }).catch(() => {}).finally(() => setLoadingOpts(false));
  }, []);

  const selectedGestante = gestantes.find(g => g.sowId === sowId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sowId) return;
    setSaving(true);
    setMsg(null);
    try {
      const vetDiagnosis = [diagVet, observaciones].filter(Boolean).join("\n") || undefined;
      const r = await fetch("/api/gestacion/aborto", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sowId,
          abortionDate: fechaAborto,
          cause:        causa !== "Desconocida" ? causa : undefined,
          vetDiagnosis,
        }),
      });
      const d = await r.json() as { mensaje?: string; error?: string };
      if (r.ok) {
        setMsg({ tipo: "ok", texto: d.mensaje ?? "Aborto registrado correctamente" });
        setSowId(""); setDiagVet(""); setObservaciones(""); setCausa("Desconocida");
        setFechaAborto(new Date().toISOString().slice(0, 10));
      } else {
        setMsg({ tipo: "err", texto: d.error ?? "Error al registrar" });
      }
    } catch {
      setMsg({ tipo: "err", texto: "Error de red" });
    }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Registrar aborto</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          Registra el aborto de una cerda gestante o servida. La hembra pasará a estado "Vacía".
        </div>
      </div>

      {msg && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 12, marginBottom: 14,
          background: msg.tipo === "ok" ? "var(--success-subtle)" : "var(--accent-subtle)",
          border: `0.5px solid ${msg.tipo === "ok" ? "var(--success-border)" : "var(--accent-border)"}`,
          color: msg.tipo === "ok" ? "var(--success-text)" : "var(--accent-text)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {msg.tipo === "ok" && <IconCheck size={14} />}
          {msg.texto}
        </div>
      )}

      <form onSubmit={submit} style={{
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", padding: "18px 20px",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        {/* Cerda */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            CERDA *
          </label>
          {loadingOpts ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <IconLoader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              Cargando…
            </div>
          ) : gestantes.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
              No hay cerdas gestantes o servidas actualmente.
            </div>
          ) : (
            <select
              required
              value={sowId}
              onChange={e => setSowId(e.target.value)}
              className="kp-input"
              style={{ fontSize: 12, width: "100%" }}
            >
              <option value="">— Seleccionar hembra —</option>
              {gestantes.map(g => (
                <option key={g.sowId} value={g.sowId}>
                  {g.caravana} · {g.plantelState === "PREGNANT" ? "Preñada" : "Servida"} · {g.diasGestacion}d
                </option>
              ))}
            </select>
          )}
          {selectedGestante && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
              Días de gestación: <strong style={{ color: "var(--text-primary)" }}>{selectedGestante.diasGestacion}</strong>
            </div>
          )}
        </div>

        {/* Fecha del aborto */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            FECHA DEL ABORTO *
          </label>
          <input
            type="date"
            required
            value={fechaAborto}
            onChange={e => setFechaAborto(e.target.value)}
            className="kp-input"
            style={{ fontSize: 12, width: "100%" }}
          />
        </div>

        {/* Causa probable */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            CAUSA PROBABLE
          </label>
          <select
            value={causa}
            onChange={e => setCausa(e.target.value)}
            className="kp-input"
            style={{ fontSize: 12, width: "100%" }}
          >
            {CAUSAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Diagnóstico veterinario */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            DIAGNÓSTICO VETERINARIO
          </label>
          <input
            value={diagVet}
            onChange={e => setDiagVet(e.target.value)}
            placeholder="Ej: Endometritis, PRRS, Parvovirus…"
            className="kp-input"
            style={{ fontSize: 12, width: "100%" }}
          />
        </div>

        {/* Observaciones */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
            OBSERVACIONES
          </label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Descripción adicional del caso…"
            className="kp-input"
            style={{ fontSize: 12, width: "100%", minHeight: 70, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || !sowId}
            style={{ fontSize: 12 }}
          >
            {saving
              ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} />{" "}Guardando…</>
              : "Registrar aborto"}
          </button>
        </div>
      </form>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
