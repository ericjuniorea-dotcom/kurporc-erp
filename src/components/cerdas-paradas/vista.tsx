// Fase 10 · Pantalla "Cerdas paradas" (servidor). Con montos solo si tiene finanzas.cerdas_paradas.ver.
import Link from "next/link";
import { gs, nombreMes } from "@/lib/finanzas/calculos";
import { ACCION, NOMBRE_CAUSA } from "@/lib/cerdas-paradas/calculo";
import type { resumenParadas, detalleCerda, sinDiagnostico } from "@/lib/cerdas-paradas/datos";
import { BotonTarea, Tendencia } from "./cliente";

type Resumen = Awaited<ReturnType<typeof resumenParadas>>;
type Detalle = NonNullable<Awaited<ReturnType<typeof detalleCerda>>>;
type SinDiagnostico = Awaited<ReturnType<typeof sinDiagnostico>>;
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 };
const etiqueta: React.CSSProperties = { fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em" };
const grande: React.CSSProperties = { fontSize: 22, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 };
const nota: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)", marginTop: 2 };
const n1 = (v: number | null, d = 1) => (v === null ? "—" : v.toLocaleString("es-PY", { maximumFractionDigits: d, minimumFractionDigits: d }));
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);
const ESTADO: Record<string, string> = { GESTANDO: "Gestando", LACTANDO: "Lactando", NORMAL: "Sin producir (normal)", PARADA: "Parada" };

export function VistaParadas({ r, conMontos, base, puedeTarea, detalle, ecografias }: { r: Resumen; conMontos: boolean; base: string; puedeTarea: boolean; detalle: Detalle | null; ecografias?: SinDiagnostico }) {
  const maxCausa = Math.max(1, ...r.porCausa.map(c => (conMontos ? c.gs : c.dias)));
  const i = r.indicadores;
  return (
    <>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        Una cerda está <strong>parada</strong> cuando no gesta ni amamanta más allá de lo normal: la espera del destete al servicio
        (objetivo {r.params.calc.intervaloObjetivoDias} días + {r.params.calc.toleranciaDias} de tolerancia), una repetición, una vacía, un aborto,
        una nulípara que pasó su fecha o una cerda para descarte que no sale.
        {conMontos && " Lo «gastado» ya está dentro de los costos del mes; lo «dejado de ganar» es el margen de los lechones que no nacieron."}
      </div>

      <section aria-label="Resumen" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        <div style={tarjeta}><div style={etiqueta}>Cerdas paradas hoy</div><div style={grande}>{r.paradas.length}</div>
          <div style={nota}>{conMontos ? `Hoy te cuestan ${gs(r.perdidaDiariaHoyGs)} por día` : `${r.paradas.reduce((s, p) => s + p.dias, 0)} días parados acumulados`}</div></div>
        {conMontos && <div style={tarjeta}><div style={etiqueta}>Perdido en {nombreMes(r.mesHoy).toLowerCase()}</div><div style={grande}>{gs(r.mes.gastadoGs + r.mes.dejadoGs)}</div>
          <div style={nota}>{gs(r.mes.gastadoGs)} gastado · {gs(r.mes.dejadoGs)} dejado de ganar</div></div>}
        {conMontos && <div style={tarjeta}><div style={etiqueta}>Perdido en el año</div><div style={grande}>{gs(r.anio.gastadoGs + r.anio.dejadoGs)}</div>
          <div style={nota}>{gs(r.anio.gastadoGs)} gastado · {gs(r.anio.dejadoGs)} dejado de ganar</div></div>}
        <div style={tarjeta}><div style={etiqueta}>Lechones no producidos (año)</div><div style={grande}>{n1(r.anio.lechones)}</div>
          <div style={nota}>{r.anio.dias} días parados en el año</div></div>
        {conMontos && r.costoHoy && <div style={tarjeta}><div style={etiqueta}>Un día parado cuesta</div><div style={grande}>{gs(Math.round(r.costoHoy.perdidaDia))}</div>
          <div style={nota}>{gs(Math.round(r.costoHoy.alimento))} alimento + {gs(Math.round(r.costoHoy.estructura))} estructura + {gs(Math.round(r.costoHoy.lucroCesante))} de margen{r.costoHoy.usado !== r.mesHoy ? ` · con los costos de ${nombreMes(r.costoHoy.usado).toLowerCase()}` : ""}</div></div>}
      </section>

      <section style={tarjeta} aria-labelledby="t-hoy">
        <h2 id="t-hoy" style={{ fontSize: 14, margin: "0 0 10px", color: "var(--text-primary)" }}>Cerdas paradas hoy</h2>
        {r.paradas.length === 0 ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Ninguna cerda está parada. 👏</div> : (
          <div style={{ overflowX: "auto" }}>
            <table className="kp-table">
              <thead><tr><th>Cerda</th><th>Causa</th><th>Desde</th><th style={{ textAlign: "right" }}>Días</th>{conMontos && <th style={{ textAlign: "right" }}>Pérdida acumulada</th>}<th>Qué hacer</th><th>Responsable</th><th></th></tr></thead>
              <tbody>
                {r.paradas.map(p => (
                  <tr key={p.id}>
                    <td><Link href={`${base}?cerda=${p.id}`} style={{ fontWeight: 500, color: "var(--accent-text)" }}>{p.codigo}</Link></td>
                    <td><span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 12, background: p.causa === "VACIA" || p.causa === "ABORTO" ? "var(--danger-subtle)" : "var(--warning-subtle)", color: p.causa === "VACIA" || p.causa === "ABORTO" ? "var(--danger)" : "var(--warning-text)" }}>{NOMBRE_CAUSA[p.causa]}</span></td>
                    <td>{new Date(`${p.desde}T12:00:00Z`).toLocaleDateString("es-PY")}</td>
                    <td style={{ textAlign: "right" }}>{p.dias}{p.alerta && <span title="Pasó el plazo de aviso" aria-label="pasó el plazo de aviso" style={{ color: "var(--danger)", marginLeft: 4 }}>●</span>}</td>
                    {conMontos && <td style={{ textAlign: "right" }}>{gs(p.perdidaGs)}</td>}
                    <td>{ACCION[p.causa]}</td>
                    <td style={{ color: "var(--text-secondary)" }}>Jefatura de Producción</td>
                    <td>{puedeTarea && <BotonTarea sowId={p.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ecografias && ecografias.cerdas.length > 0 && (
        <section style={tarjeta} aria-labelledby="t-eco">
          <h2 id="t-eco" style={{ fontSize: 14, margin: "0 0 4px", color: "var(--text-primary)" }}>Servidas sin diagnóstico</h2>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 10 }}>
            Pasaron más de {ecografias.diasEco} días desde el servicio y no tienen ecografía. Si alguna está vacía, va a contar como parada desde el día del servicio.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="kp-table">
              <thead><tr><th>Cerda</th><th>Servida el</th><th style={{ textAlign: "right" }}>Días</th><th>Qué hacer</th><th>Responsable</th><th></th></tr></thead>
              <tbody>
                {ecografias.cerdas.map(c => (
                  <tr key={c.id}>
                    <td><Link href={`${base}?cerda=${c.id}`} style={{ fontWeight: 500, color: "var(--accent-text)" }}>{c.codigo}</Link></td>
                    <td>{new Date(`${c.servicio}T12:00:00Z`).toLocaleDateString("es-PY")}</td>
                    <td style={{ textAlign: "right" }}>{c.dias}</td>
                    <td>Hacer ecografía</td>
                    <td style={{ color: "var(--text-secondary)" }}>Jefatura de Producción</td>
                    <td>{puedeTarea && <BotonTarea sowId={c.id} ecografia />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {detalle && (
        <section style={tarjeta} aria-labelledby="t-det">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h2 id="t-det" style={{ fontSize: 14, margin: 0, color: "var(--text-primary)" }}>Cerda {detalle.codigo}: su historia</h2>
            <Link href={base} className="btn" style={{ height: 28, fontSize: 12 }}>Cerrar</Link>
          </div>
          <div style={{ ...nota, margin: "6px 0 10px" }}>{detalle.resumen.productivos} días productivos · {detalle.resumen.normales} normales · <strong>{detalle.resumen.parados} parados</strong></div>
          <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", gap: 2, background: "var(--bg-surface)", marginBottom: 10 }} aria-hidden>
            {detalle.tramos.map((t, k) => <div key={k} title={`${ESTADO[t.estado]} · ${t.dias} d`} style={{ flex: t.dias, background: t.estado === "PARADA" ? "var(--danger)" : t.estado === "NORMAL" ? "var(--border-strong, #bbb)" : "var(--success)", opacity: t.estado === "PARADA" ? 0.75 : 1 }} />)}
          </div>
          <table className="kp-table">
            <thead><tr><th>Desde</th><th>Hasta</th><th>Estado</th><th style={{ textAlign: "right" }}>Días</th>{conMontos && <th style={{ textAlign: "right" }}>Pérdida</th>}</tr></thead>
            <tbody>{detalle.tramos.map((t, k) => (
              <tr key={k}><td>{new Date(`${t.desde}T12:00:00Z`).toLocaleDateString("es-PY")}</td><td>{new Date(`${t.hasta}T12:00:00Z`).toLocaleDateString("es-PY")}</td>
                <td>{t.estado === "PARADA" ? `Parada · ${NOMBRE_CAUSA[t.causa!]}` : ESTADO[t.estado]}</td><td style={{ textAlign: "right" }}>{t.dias}</td>
                {conMontos && <td style={{ textAlign: "right" }}>{t.estado === "PARADA" ? gs(t.perdidaGs) : ""}</td>}</tr>
            ))}</tbody>
          </table>
        </section>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 10 }}>
        <section style={tarjeta} aria-labelledby="t-causa">
          <h2 id="t-causa" style={{ fontSize: 14, margin: "0 0 10px", color: "var(--text-primary)" }}>{conMontos ? "Pérdida por causa (año)" : "Días parados por causa (año)"}</h2>
          {r.porCausa.length === 0 ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Sin días parados en el año.</div> : r.porCausa.map(c => {
            const v = conMontos ? c.gs : c.dias;
            return (
              <div key={c.causa} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 38%) 1fr auto", gap: 8, alignItems: "center", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--text-secondary)" }}>{NOMBRE_CAUSA[c.causa]}</span>
                <span style={{ height: 12, background: "var(--bg-base)", borderRadius: 4 }}><span style={{ display: "block", height: 12, width: `${Math.max(2, (v / maxCausa) * 100)}%`, background: "var(--warning)", borderRadius: "0 4px 4px 0", opacity: 0.6 }} /></span>
                <span style={{ color: "var(--text-primary)", minWidth: 70, textAlign: "right" }}>{conMontos ? gs(c.gs) : `${c.dias} d`}</span>
              </div>
            );
          })}
        </section>
        <section style={tarjeta} aria-labelledby="t-tend">
          <h2 id="t-tend" style={{ fontSize: 14, margin: "0 0 10px", color: "var(--text-primary)" }}>{conMontos ? "Pérdida por mes" : "Días parados por mes"}</h2>
          <Tendencia puntos={r.porMes.map(m => ({ etiqueta: nombreMes(m.mes).slice(0, 3), valor: conMontos ? m.gastadoGs + m.dejadoGs : m.dias, texto: conMontos ? gs(m.gastadoGs + m.dejadoGs) : `${m.dias} días` }))} />
        </section>
      </div>

      <section style={tarjeta} aria-labelledby="t-ind">
        <h2 id="t-ind" style={{ fontSize: 14, margin: "0 0 10px", color: "var(--text-primary)" }}>Indicadores (últimos 365 días)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, fontSize: 13 }}>
          <div><div style={etiqueta}>Días no productivos por cerda por año</div><div style={grande}>{n1(i.dnpPorCerdaAnio, 0)}</div><div style={nota}>Días sin gestar ni amamantar (normales y parados)</div></div>
          <div><div style={etiqueta}>Destete → servicio</div><div style={grande}>{i.intervaloDesteteServicio === null ? "—" : `${n1(i.intervaloDesteteServicio)} d`}</div><div style={nota}>Objetivo {r.params.calc.intervaloObjetivoDias} días</div></div>
          <div><div style={etiqueta}>Servidas a tiempo</div><div style={grande}>{pct(i.servidasATiempo)}</div><div style={nota}>Dentro de {r.params.calc.intervaloObjetivoDias + r.params.calc.toleranciaDias} días del destete</div></div>
          <div><div style={etiqueta}>Tasa de repetición</div><div style={grande}>{pct(i.tasaRepeticion)}</div><div style={nota}>Servicios que no terminaron en parto</div></div>
          <div><div style={etiqueta}>Partos por cerda por año</div><div style={grande}>{n1(i.partosCerdaAnio, 2)}</div><div style={nota}>Máximo posible {n1(i.partosMaximos, 2)} · meta {n1(r.params.partosMeta, 1)}</div></div>
        </div>
      </section>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Metas productivas: Configuración (Jefatura de Producción). Tolerancia, nulíparas y avisos: Finanzas → Parámetros.
        {conMontos && " El costo de un día sale de los costos del mes: alimento de gestación, gastos fijos y amortización; el margen, del precio de referencia del lechón menos el costo variable por lechón."}
      </div>
    </>
  );
}
