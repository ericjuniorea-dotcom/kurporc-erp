"use client";
// Ficha → Vacunas: próximas vacunas según el protocolo sanitario, con la fecha en que hay que aplicarlas.
// Las agendadas se registran desde acá (aplican el evento de la agenda); las estimadas se agendan solas
// al registrar el servicio o el parto.
import { useState } from "react";
import { IconCalendarEvent, IconLoader2, IconVaccine } from "@tabler/icons-react";

export type ProximaVacuna = {
  fecha: string | null;
  estimada: boolean;
  base: string;
  vacunas: { eventoId: string | null; nombre: string; descripcion: string | null; estado: "pendiente" | "retrasado" | "estimada" | "al-servir" }[];
};

const DIA = 86_400_000;
const fecha = (s: string) => new Date(s).toLocaleDateString("es-PY", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
function cuanto(s: string) {
  const hoy = new Date(); const h = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const d = Math.round((new Date(s).getTime() - h) / DIA);
  if (d === 0) return { texto: "hoy", tono: "warning" as const };
  if (d < 0) return { texto: `atrasada ${-d} día${d === -1 ? "" : "s"}`, tono: "danger" as const };
  return { texto: `en ${d} día${d === 1 ? "" : "s"}`, tono: d <= 7 ? ("warning" as const) : ("muted" as const) };
}

export function ProximasProtocolo({ proximas, onAplicada }: { proximas: ProximaVacuna[]; onAplicada: () => void }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [responsable, setResponsable] = useState("");
  const [dia, setDia] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (proximas.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 12px", border: "0.5px dashed var(--border-default)", borderRadius: "var(--radius-md)" }}>
        Según el protocolo no le toca ninguna vacuna por ahora. Revisá los protocolos en Sanidad si esperabas ver alguna.
      </div>
    );
  }
  const siguiente = proximas.find(p => p.fecha);

  async function aplicar(ids: string[]) {
    if (!responsable.trim()) { setError("Escribí quién la aplicó."); return; }
    setGuardando(true); setError(null);
    try {
      for (const id of ids) {
        const r = await fetch(`/api/sanidad/eventos/${id}/aplicar`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dosisAplicadas: 1, responsable: responsable.trim(), fechaAplicacion: dia }),
        });
        if (!r.ok && r.status !== 409) { const d = await r.json().catch(() => ({})); setError(d.error ?? "No se pudo registrar."); return; }
      }
      setAbierta(null); onAplicada();
    } finally { setGuardando(false); }
  }

  return (
    <section aria-labelledby="proximas-protocolo" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div id="proximas-protocolo" style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
        <IconCalendarEvent size={14} aria-hidden /> Próximas vacunas según el protocolo
      </div>
      {siguiente?.fecha && (() => {
        const c = cuanto(siguiente.fecha);
        return (
          <div style={{ padding: "10px 12px", borderRadius: "var(--radius-md)", background: c.tono === "danger" ? "var(--danger-subtle)" : "var(--warning-subtle)", color: c.tono === "danger" ? "var(--danger-text)" : "var(--warning-text)", fontSize: 12.5 }}>
            <strong style={{ fontWeight: 500 }}>Próxima: {siguiente.vacunas.map(v => v.nombre).join(" + ")}</strong> · {fecha(siguiente.fecha)} ({c.texto}){siguiente.estimada ? " · fecha estimada" : ""}
          </div>
        );
      })()}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="kp-table">
          <thead><tr><th>Fecha</th><th>Vacuna</th><th>Según el protocolo</th><th /></tr></thead>
          <tbody>
            {proximas.map((p, i) => {
              const ids = p.vacunas.map(v => v.eventoId).filter((x): x is string => !!x);
              const clave = `${i}`;
              const c = p.fecha ? cuanto(p.fecha) : null;
              return (
                <tr key={clave} style={{ verticalAlign: "top" }}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {p.fecha ? <>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{fecha(p.fecha)}</div>
                      <div style={{ fontSize: 11, color: c?.tono === "danger" ? "var(--danger-text)" : c?.tono === "warning" ? "var(--warning-text)" : "var(--text-muted)" }}>
                        {c?.texto}{p.estimada ? " · estimada" : ""}
                      </div>
                    </> : <span style={{ color: "var(--text-muted)" }}>Al servirla</span>}
                  </td>
                  <td>
                    {p.vacunas.map(v => (
                      <div key={v.nombre + v.eventoId} style={{ marginBottom: 2 }}>
                        <div style={{ color: "var(--text-primary)" }}>{v.nombre}</div>
                        {v.descripcion && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.descripcion}</div>}
                      </div>
                    ))}
                  </td>
                  <td style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{p.base}</td>
                  <td style={{ textAlign: "right" }}>
                    {ids.length > 0 && abierta !== clave && (
                      <button type="button" className="btn" style={{ height: 28, fontSize: 12, gap: 4 }} onClick={() => { setAbierta(clave); setError(null); }}>
                        <IconVaccine size={13} aria-hidden /> Registrar
                      </button>
                    )}
                    {abierta === clave && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                        <input className="kp-input" type="date" value={dia} onChange={e => setDia(e.target.value)} aria-label="Fecha de aplicación" style={{ height: 30 }} />
                        <input className="kp-input" value={responsable} onChange={e => setResponsable(e.target.value)} placeholder="Quién la aplicó" aria-label="Responsable" style={{ height: 30 }} />
                        {error && <div role="alert" style={{ fontSize: 11, color: "var(--danger-text)" }}>{error}</div>}
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button type="button" className="btn" style={{ height: 28, fontSize: 12 }} onClick={() => setAbierta(null)}>Cancelar</button>
                          <button type="button" className="btn btn-primary" style={{ height: 28, fontSize: 12 }} disabled={guardando} onClick={() => aplicar(ids)}>
                            {guardando && <IconLoader2 size={12} className="animate-spin" aria-hidden />} Guardar
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Las fechas «estimadas» salen del destete previsto, el servicio estimado o el parto previsto; quedan fijas al registrar el servicio o el parto.
      </div>
    </section>
  );
}
