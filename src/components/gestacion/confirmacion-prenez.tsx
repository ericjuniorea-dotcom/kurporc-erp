"use client";
import { useState, useEffect, useCallback } from "react";
import { IconCheck, IconLoader2, IconRefresh } from "@tabler/icons-react";

interface Pendiente {
  serviceEventId:    string;
  sowId:             string;
  identCode:         string;
  plantelState:      string;
  fechaServicio:     string;
  diasPostServicio:  number;
  diasVencimiento:   number;
  ultimoDiagnostico: string | null;
}

type Metodo   = "ecografia" | "repeticion";
type Resultado = "Positivo" | "Negativo" | "Dudoso";

export function ConfirmacionPrenez() {
  const [pendientes,   setPendientes]   = useState<Pendiente[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<Pendiente | null>(null);
  const [metodo,       setMetodo]       = useState<Metodo>("ecografia");
  const [resultado,    setResultado]    = useState<Resultado>("Positivo");
  const [fechaDiag,    setFechaDiag]    = useState(() => new Date().toISOString().slice(0, 10));
  const [observ,       setObserv]       = useState("");
  const [repite,       setRepite]       = useState(false);
  const [nuevaFecha,   setNuevaFecha]   = useState(() => new Date().toISOString().slice(0, 10));
  const [causaProb,    setCausaProb]    = useState("");
  const [reproductor,  setReproductor]  = useState("");
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/gestacion/pendientes-diagnostico")
      .then(r => r.ok ? r.json() : [])
      .then(d => { setPendientes(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function selectSow(p: Pendiente) {
    setSelected(p);
    setMetodo("ecografia");
    setResultado("Positivo");
    setObserv("");
    setRepite(false);
    setCausaProb("");
    setNuevaFecha(new Date().toISOString().slice(0, 10));
    setReproductor("");
    setMsg(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMsg(null);

    try {
      if (metodo === "ecografia") {
        const r = await fetch("/api/gestacion/diagnostico-prenez", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceEventId: selected.serviceEventId,
            sowId:           selected.sowId,
            fechaDiagnostico: fechaDiag,
            resultado,
            metodo:           "Ecografía",
            observaciones:    observ,
            veterinario:      "Veterinario",
          }),
        });
        const d = await r.json();
        if (r.ok) {
          setMsg({ tipo: "ok", texto: d.mensaje ?? "Diagnóstico registrado" });
          setSelected(null);
          load();
        } else {
          setMsg({ tipo: "err", texto: d.error ?? "Error al guardar" });
        }
      } else {
        const r = await fetch("/api/gestacion/repeticion-celo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sowId:           selected.sowId,
            serviceEventId:  selected.serviceEventId,
            fechaDeteccion:  fechaDiag,
            diasPostServicio: selected.diasPostServicio,
            causaProbable:   causaProb,
            repiteServicio:  repite,
            nuevaFecha,
            reproductor,
            observaciones:   observ,
          }),
        });
        const d = await r.json();
        if (r.ok) {
          setMsg({ tipo: "ok", texto: d.mensaje ?? "Registrado" });
          setSelected(null);
          load();
        } else {
          setMsg({ tipo: "err", texto: d.error ?? "Error al guardar" });
        }
      }
    } catch {
      setMsg({ tipo: "err", texto: "Error de red" });
    }
    setSaving(false);
  }

  const urgentes   = pendientes.filter(p => p.diasVencimiento > 7);
  const normales   = pendientes.filter(p => p.diasVencimiento >= 0 && p.diasVencimiento <= 7);
  const proximas   = pendientes.filter(p => p.diasVencimiento < 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Diagnóstico de preñez</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Todas las cerdas servidas — permanecen hasta confirmar preñez o repetición de celo
          </div>
        </div>
        <button className="btn" onClick={load} title="Actualizar"><IconRefresh size={13} /></button>
      </div>

      {msg && (
        <div style={{
          padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 12,
          background: msg.tipo === "ok" ? "var(--success-subtle)" : "var(--accent-subtle)",
          border: `0.5px solid ${msg.tipo === "ok" ? "var(--success-border)" : "var(--accent-border)"}`,
          color: msg.tipo === "ok" ? "var(--success-text)" : "var(--accent-text)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {msg.tipo === "ok" && <IconCheck size={14} />}
          {msg.texto}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.2fr" : "1fr", gap: 16, alignItems: "start" }}>
        {/* Lista de pendientes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "32px 0", alignItems: "center", gap: 6 }}>
              <IconLoader2 size={16} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Cargando...</span>
            </div>
          ) : pendientes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "var(--text-muted)" }}>
              Sin diagnósticos pendientes
            </div>
          ) : (
            <>
              {urgentes.length > 0 && (
                <SectionHeader label="Diagnóstico vencido (> 35d post-servicio)" color="var(--accent)" />
              )}
              {urgentes.map(p => (
                <PendienteRow key={p.serviceEventId} p={p} selected={selected?.serviceEventId === p.serviceEventId} onSelect={selectSow} />
              ))}
              {normales.length > 0 && (
                <SectionHeader label="Ventana de ecografía (28–35d)" color="var(--warning)" />
              )}
              {normales.map(p => (
                <PendienteRow key={p.serviceEventId} p={p} selected={selected?.serviceEventId === p.serviceEventId} onSelect={selectSow} />
              ))}
              {proximas.length > 0 && (
                <SectionHeader label="Recientes (< 28d post-servicio)" color="var(--text-muted)" />
              )}
              {proximas.map(p => (
                <PendienteRow key={p.serviceEventId} p={p} selected={selected?.serviceEventId === p.serviceEventId} onSelect={selectSow} />
              ))}
            </>
          )}
        </div>

        {/* Formulario */}
        {selected && (
          <div style={{
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: "16px 18px",
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12 }}>
              Cerda {selected.identCode} — {selected.diasPostServicio} días post-servicio
            </div>

            {/* Selector de método */}
            <div style={{ display: "flex", gap: 0, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)", marginBottom: 14 }}>
              {([["ecografia", "Por ecografía"], ["repeticion", "Repetición de celo"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setMetodo(k)} style={{
                  flex: 1, fontSize: 11, padding: "5px 8px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: metodo === k ? "var(--bg-surface)" : "transparent",
                  color:      metodo === k ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: metodo === k ? 600 : 400,
                }}>{l}</button>
              ))}
            </div>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Fecha */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  FECHA DE {metodo === "ecografia" ? "DIAGNÓSTICO" : "DETECCIÓN"}
                </label>
                <input type="date" value={fechaDiag} onChange={e => setFechaDiag(e.target.value)} className="kp-input" style={{ fontSize: 12, width: "100%" }} required />
              </div>

              {metodo === "ecografia" ? (
                <>
                  {/* Resultado */}
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>RESULTADO</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["Positivo", "Negativo", "Dudoso"] as Resultado[]).map(r => (
                        <button
                          type="button" key={r}
                          onClick={() => setResultado(r)}
                          style={{
                            flex: 1, padding: "7px 6px", fontSize: 11, borderRadius: "var(--radius-md)", cursor: "pointer",
                            border: resultado === r
                              ? `2px solid ${r === "Positivo" ? "var(--success)" : r === "Negativo" ? "var(--accent)" : "var(--warning)"}`
                              : "0.5px solid var(--border-default)",
                            background: resultado === r
                              ? (r === "Positivo" ? "var(--success-subtle)" : r === "Negativo" ? "var(--accent-subtle)" : "var(--warning-subtle)")
                              : "var(--bg-overlay)",
                            color: resultado === r
                              ? (r === "Positivo" ? "var(--success-text)" : r === "Negativo" ? "var(--accent-text)" : "var(--warning-text)")
                              : "var(--text-secondary)",
                            fontWeight: resultado === r ? 700 : 400,
                          }}
                        >{r}</button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Causa probable */}
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>CAUSA PROBABLE</label>
                    <select value={causaProb} onChange={e => setCausaProb(e.target.value)} className="kp-input" style={{ fontSize: 12, width: "100%" }}>
                      <option value="">Desconocida</option>
                      <option value="Anestro">Anestro</option>
                      <option value="Fallo de cubrición">Fallo de cubrición</option>
                      <option value="Reabsorción embrionaria">Reabsorción embrionaria</option>
                      <option value="Infección uterina">Infección uterina</option>
                      <option value="Estrés calórico">Estrés calórico</option>
                    </select>
                  </div>

                  {/* ¿Repite servicio? */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" id="repite" checked={repite} onChange={e => setRepite(e.target.checked)} />
                    <label htmlFor="repite" style={{ fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
                      ¿Programar nuevo servicio?
                    </label>
                  </div>

                  {repite && (
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>NUEVA FECHA</label>
                        <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} className="kp-input" style={{ fontSize: 12, width: "100%" }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>REPRODUCTOR</label>
                        <input placeholder="ID verraco" value={reproductor} onChange={e => setReproductor(e.target.value)} className="kp-input" style={{ fontSize: 12, width: "100%" }} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Observaciones */}
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>OBSERVACIONES</label>
                <textarea
                  value={observ} onChange={e => setObserv(e.target.value)}
                  placeholder="Observaciones adicionales..."
                  className="kp-input"
                  style={{ fontSize: 12, width: "100%", minHeight: 60, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" style={{ fontSize: 11 }} onClick={() => setSelected(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontSize: 11 }}>
                  {saving ? <IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : null}
                  {saving ? "Guardando..." : "Confirmar diagnóstico"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.1em", padding: "6px 0 2px" }}>
      {label}
    </div>
  );
}

function PendienteRow({ p, selected, onSelect }: { p: Pendiente; selected: boolean; onSelect: (p: Pendiente) => void }) {
  const urgent = p.diasVencimiento > 3;
  return (
    <button
      onClick={() => onSelect(p)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 12px", borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "left",
        background: selected ? "var(--info-subtle)" : urgent ? "var(--accent-subtle)" : "var(--bg-surface)",
        border: selected
          ? "1.5px solid var(--info)"
          : urgent ? "0.5px solid var(--accent-border)" : "0.5px solid var(--border-default)",
        width: "100%",
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "#fff",
      }}>
        {p.identCode?.slice(0, 3) ?? "??"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          Cerda {p.identCode}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
          {p.diasPostServicio} días post-servicio · {new Date(p.fechaServicio).toLocaleDateString("es-PY")}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
        <span style={{
          fontSize: 10, padding: "2px 7px", borderRadius: 99, fontWeight: 600, whiteSpace: "nowrap",
          background: urgent ? "var(--accent-subtle)" : "var(--warning-subtle)",
          border: `0.5px solid ${urgent ? "var(--accent-border)" : "var(--warning-border)"}`,
          color: urgent ? "var(--accent-text)" : "var(--warning-text)",
        }}>
          {p.diasPostServicio}d post-serv
        </span>
        {p.ultimoDiagnostico && (
          <span style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 99, fontWeight: 600, whiteSpace: "nowrap",
            background: p.ultimoDiagnostico === "RECHECK" ? "var(--warning-subtle)" : "var(--accent-subtle)",
            border: `0.5px solid ${p.ultimoDiagnostico === "RECHECK" ? "var(--warning-border)" : "var(--accent-border)"}`,
            color: p.ultimoDiagnostico === "RECHECK" ? "var(--warning-text)" : "var(--accent-text)",
          }}>
            {p.ultimoDiagnostico === "RECHECK" ? "Dudoso" : "No preñada"}
          </span>
        )}
      </div>
    </button>
  );
}
