import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { datosProyeccion } from "@/lib/finanzas/plan-datos";
import { gs, nombreMes } from "@/lib/finanzas/calculos";
import { Aportes } from "./aportes";

export const metadata = { title: "Proyección de caja · Finanzas · KurPorc" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const COLOR: Record<string, string> = { "SIN CAJA": "var(--danger-text)", AJUSTADO: "var(--warning-text)", OK: "var(--success-text)" };

export default async function ProyeccionPage() {
  const { org, permisos } = await paginaFinanzas("finanzas.proyeccion.ver");
  const d = await datosProyeccion(org);
  const p = d.proyeccion, q = d.preguntas;
  const filas: [string, (m: (typeof p)[number]) => bigint | string, boolean?][] = [
    ["Venta de lechones", m => m.ventas], ["Otros ingresos", m => m.otrosIngresos], ["Aportes de capital", m => m.aportes], ["Total ingresos", m => m.ingresos, true],
    ["Gasto operativo (presupuesto)", m => m.gastoOperativo], ["Inversión (presupuesto)", m => m.inversion], ["Cuotas de préstamos", m => m.cuotas], ["Cuentas por pagar que vencen", m => m.porPagar], ["Total egresos", m => m.egresos, true],
    ["Flujo del mes", m => m.flujo, true], ["Saldo inicial", m => m.saldoInicial], ["Saldo final", m => m.saldoFinal, true],
  ];
  const preguntas: [string, string][] = [
    ["¿Cuánto necesito para llegar al mes que viene sin problemas?", gs(q.necesitoProximoMes)],
    ["Egresos del mes que viene", gs(q.egresosProximoMes)],
    ["Ingresos esperados (con aportes)", gs(q.ingresosEsperados)],
    ["¿En qué mes me quedo sin caja si sigo así?", q.mesSinCaja ? nombreMes(q.mesSinCaja) : "No se queda sin caja en 15 meses"],
    ["Saldo más bajo del horizonte", gs(q.saldoMasBajo)],
    ["Capital de trabajo para no quedar nunca en rojo", gs(q.capitalTrabajoNecesario)],
    ["Aportes de capital ya previstos", gs(q.aportesPrevistos)],
  ];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
        {preguntas.map(([t, v]) => (
          <div key={t} style={{ ...tarjeta, padding: "10px 12px" }}>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: t.includes("sin caja") && q.mesSinCaja ? "var(--danger-text)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Próximos 15 meses · caja + bancos hoy {gs(d.cajaHoy)}</div>
        <table className="kp-table" style={{ minWidth: 1500 }}>
          <thead><tr><th style={{ position: "sticky", left: 0, background: "var(--bg-surface)", minWidth: 220 }}></th>{p.map(m => <th key={m.mes} style={{ textAlign: "right" }}>{nombreMes(m.mes, true)}</th>)}</tr></thead>
          <tbody>
            {filas.map(([t, f, fuerte]) => (
              <tr key={t} style={{ background: fuerte ? "var(--bg-elevated)" : undefined }}>
                <td style={{ position: "sticky", left: 0, background: fuerte ? "var(--bg-elevated)" : "var(--bg-surface)", fontWeight: fuerte ? 600 : 400, color: "var(--text-primary)" }}>{t}</td>
                {p.map(m => { const v = f(m) as bigint; return <td key={m.mes} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: fuerte ? 600 : 400, color: v < 0n ? "var(--danger-text)" : undefined }}>{gs(v)}</td>; })}
              </tr>
            ))}
            <tr>
              <td style={{ position: "sticky", left: 0, background: "var(--bg-surface)" }}>Meses cubiertos</td>
              {p.map(m => <td key={m.mes} style={{ textAlign: "right" }}>{m.mesesCubiertos === null ? "—" : m.mesesCubiertos.toLocaleString("es-PY", { maximumFractionDigits: 1 })}</td>)}
            </tr>
            <tr>
              <td style={{ position: "sticky", left: 0, background: "var(--bg-surface)" }}>Alerta</td>
              {p.map(m => <td key={m.mes} style={{ textAlign: "right", color: COLOR[m.alerta], fontWeight: 500, fontSize: 11 }}>{m.alerta}</td>)}
            </tr>
          </tbody>
        </table>
        <div style={{ padding: "8px 14px 12px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {d.bandas ? <>Ventas por calendario: {d.bandas.detalle}; después, {d.params?.lechonesAVenderMes ?? 0} lechones por mes × {gs(d.params?.precioEsperadoLechonGs ?? 0n)}.</> : <>Ventas = {d.params?.lechonesAVenderMes ?? 0} lechones por mes × {gs(d.params?.precioEsperadoLechonGs ?? 0n)} (Parámetros; también se puede proyectar por calendario de partos y lotes).</>} Gasto e inversión salen del Presupuesto; las cuotas, de Deudas; lo vencido sin pagar se proyecta al mes que viene.
          Ajustado = el saldo no cubre {Number(d.params?.colchonMesesEgreso ?? 1).toLocaleString("es-PY")} mes(es) de egresos.
        </div>
      </div>
      <Aportes editable={puede(permisos, "finanzas.proyeccion.editar_supuestos")} desde={d.desde}
        aportes={d.aportes.map(a => ({ id: a.id, mes: a.mes, montoGs: a.montoGs.toString(), descripcion: a.descripcion ?? "" }))} />
    </>
  );
}
