"use client";
// Sanidad y Nutrición · consumo de balanceado por día, semana, mes o año: kg y costo por módulo y por balanceado,
// y cada carga con quién la hizo y a qué hora.
import { useCallback, useEffect, useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { consumoPeriodo } from "@/app/acciones/nutricion";
import { CaravanaFicha } from "@/components/plantel/caravana-ficha";
import { MODULOS_NUTRICION, ORDEN_MODULOS } from "@/lib/nutricion/plan";
import { mensajeError } from "@/lib/version-vieja";

type Datos = Awaited<ReturnType<typeof consumoPeriodo>>;
type Agrupar = "dia" | "semana" | "mes" | "anio";
const AGRUPAR: { key: Agrupar; label: string; dias: number }[] = [
  { key: "dia", label: "Por día", dias: 30 },
  { key: "semana", label: "Por semana", dias: 12 * 7 },
  { key: "mes", label: "Por mes", dias: 365 },
  { key: "anio", label: "Por año", dias: 3 * 365 },
];
const hoyPY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date());
const menos = (f: string, dias: number) => new Date(new Date(`${f}T00:00:00Z`).getTime() - dias * 86_400_000).toISOString().slice(0, 10);
const kg = (v: number) => `${v.toLocaleString("es-PY", { maximumFractionDigits: 1 })} kg`;
const gs = (v: number) => (v ? `₲ ${Math.round(v).toLocaleString("es-PY")}` : "—");
const fechaHora = (fecha: string, iso: string) => `${fecha.split("-").reverse().join("/")} · ${new Intl.DateTimeFormat("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso))}`;
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflow: "hidden" };
const titulo: React.CSSProperties = { padding: "9px 14px", background: "var(--bg-elevated)", borderBottom: "0.5px solid var(--border-default)", fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" };
const num: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };

export function ConsumoPeriodo() {
  const [agrupar, setAgrupar] = useState<Agrupar>("dia");
  const [hasta, setHasta] = useState(hoyPY());
  const [desde, setDesde] = useState(menos(hoyPY(), 30));
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true); setError(null);
    // Si falla, reintenta una vez; si la pantalla quedó con una versión vieja, recarga sola
    consumoPeriodo({ desde, hasta, agrupar }).catch(() => new Promise(r => setTimeout(r, 800)).then(() => consumoPeriodo({ desde, hasta, agrupar })))
      .then(setDatos).catch((e: unknown) => setError(mensajeError(e, "No se pudo cargar el consumo. Probá de nuevo.", { recargar: true }) || null)).finally(() => setCargando(false));
  }, [desde, hasta, agrupar]);
  useEffect(() => { cargar(); }, [cargar]);

  const elegir = (a: Agrupar) => { setAgrupar(a); setDesde(menos(hasta, AGRUPAR.find(x => x.key === a)!.dias)); };
  const modulos = ORDEN_MODULOS.filter(m => datos?.grupos.some(g => g.porModulo[m]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div role="tablist" aria-label="Agrupar" style={{ display: "flex", gap: 2, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)" }}>
          {AGRUPAR.map(a => (
            <button key={a.key} type="button" role="tab" aria-selected={agrupar === a.key} onClick={() => elegir(a.key)}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: agrupar === a.key ? "var(--bg-surface)" : "transparent", color: agrupar === a.key ? "var(--text-primary)" : "var(--text-muted)", fontWeight: agrupar === a.key ? 500 : 400 }}>
              {a.label}
            </button>
          ))}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)" }}>
          Desde<input type="date" className="kp-input" value={desde} max={hasta} onChange={e => e.target.value && setDesde(e.target.value)} style={{ height: 32 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "var(--text-secondary)" }}>
          Hasta<input type="date" className="kp-input" value={hasta} min={desde} max={hoyPY()} onChange={e => e.target.value && setHasta(e.target.value)} style={{ height: 32 }} />
        </label>
        {cargando && <IconLoader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)", marginBottom: 8 }} aria-label="Cargando" />}
      </div>
      {error && (
        <div role="alert" style={{ fontSize: 13, color: "var(--danger-text)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {error}
          <button type="button" className="btn" onClick={cargar}>Reintentar</button>
          <button type="button" className="btn" onClick={() => window.location.reload()}>Recargar</button>
        </div>
      )}

      {datos && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
            {[["Total consumido", kg(datos.total.kg)], ["Costo", gs(datos.total.costoGs)], ["Cargas", datos.total.cargas.toLocaleString("es-PY")]].map(([t, v]) => (
              <div key={t} style={{ ...tarjeta, padding: "8px 12px" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div>
                <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
              </div>
            ))}
          </div>

          <section style={tarjeta} aria-label="Consumo por período">
            <div style={titulo}>Consumo {AGRUPAR.find(a => a.key === agrupar)!.label.toLowerCase()}</div>
            {datos.grupos.length === 0 ? <div style={{ padding: 14, fontSize: 12.5, color: "var(--text-muted)" }}>No hay cargas en este rango.</div> : (
              <div style={{ overflowX: "auto" }}>
                <table className="kp-table">
                  <thead><tr>
                    <th>{agrupar === "semana" ? "Semana" : agrupar === "mes" ? "Mes" : agrupar === "anio" ? "Año" : "Día"}</th>
                    {modulos.map(m => <th key={m} style={num}>{MODULOS_NUTRICION[m].etiqueta}</th>)}
                    <th style={num}>Total</th><th style={num}>Costo</th><th style={num}>Cargas</th>
                  </tr></thead>
                  <tbody>
                    {datos.grupos.map(g => (
                      <tr key={g.clave}>
                        <td>{g.etiqueta}</td>
                        {modulos.map(m => <td key={m} style={num}>{g.porModulo[m] ? kg(g.porModulo[m]!) : "—"}</td>)}
                        <td style={{ ...num, fontWeight: 500 }}>{kg(g.kg)}</td><td style={num}>{gs(g.costoGs)}</td><td style={num}>{g.cargas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {datos.porBalanceado.length > 0 && (
            <section style={tarjeta} aria-label="Por balanceado">
              <div style={titulo}>Por balanceado</div>
              <div style={{ overflowX: "auto" }}>
                <table className="kp-table">
                  <thead><tr><th>Balanceado</th><th>Módulo</th><th style={num}>Kg</th><th style={num}>Costo</th><th style={num}>Cargas</th></tr></thead>
                  <tbody>{datos.porBalanceado.map(b => <tr key={`${b.nombre}-${b.modulo}`}><td>{b.nombre}</td><td>{b.modulo}</td><td style={num}>{kg(b.kg)}</td><td style={num}>{gs(b.costoGs)}</td><td style={num}>{b.cargas}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}

          {datos.cargas.length > 0 && (
            <section style={tarjeta} aria-label="Cargas">
              <div style={titulo}>Cargas ({datos.total.cargas > datos.cargas.length ? `últimas ${datos.cargas.length} de ${datos.total.cargas}` : datos.cargas.length})</div>
              <div style={{ overflowX: "auto" }}>
                <table className="kp-table">
                  <thead><tr><th>Día y hora</th><th>Balanceado</th><th>Módulo</th><th>Cerda</th><th style={num}>Kg</th><th style={num}>Costo</th><th>Cargó</th></tr></thead>
                  <tbody>{datos.cargas.map(c => (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fechaHora(c.fecha, c.hora)}</td>
                      <td>{c.balanceado}</td><td>{c.modulo}</td>
                      <td>{c.cerda ? <CaravanaFicha sowId={c.cerda.id} caravana={c.cerda.caravana} /> : "—"}</td>
                      <td style={num}>{kg(c.kg)}</td><td style={num}>{gs(c.costoGs)}</td><td>{c.quien ?? "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
