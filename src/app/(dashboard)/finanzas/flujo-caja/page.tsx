import prisma from "@/lib/db/prisma";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { datosProyeccion } from "@/lib/finanzas/plan-datos";
import { coberturaDias, flujoReal, mesDeFecha, type MesFlujo } from "@/lib/finanzas/planificacion";
import { gs, nombreMes } from "@/lib/finanzas/calculos";

export const metadata = { title: "Flujo de caja · Finanzas · KurPorc" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export default async function FlujoCajaPage() {
  const { org, mesCorte } = await paginaFinanzas("finanzas.flujo_caja.ver");
  const [pagos, cuentas, proy, params] = await Promise.all([
    prisma.pagoMovimiento.findMany({
      where: { movimiento: { organizacionId: org, estado: { not: "ANULADO" } } },
      select: { fechaPago: true, montoGs: true, movimiento: { select: { signo: true, tipo: true, esInterno: true, categoria: { select: { nombre: true } } } } },
    }),
    prisma.cuentaFondos.aggregate({ where: { organizacionId: org }, _sum: { saldoInicialGs: true } }),
    datosProyeccion(org),
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
  ]);
  const lista = pagos.map(p => ({ fechaPago: p.fechaPago, montoGs: p.montoGs, signo: p.movimiento.signo, tipo: p.movimiento.tipo, categoria: p.movimiento.categoria.nombre, esInterno: p.movimiento.esInterno }));
  const primero = lista.length ? Math.min(...lista.map(p => mesDeFecha(p.fechaPago))) : mesCorte;
  const real = flujoReal(lista, Math.min(primero, mesCorte), mesCorte, cuentas._sum.saldoInicialGs ?? 0n);
  let acum = real.at(-1)?.acumuladoAnio ?? 0n;
  const proyectado: MesFlujo[] = proy.proyeccion.map(m => {
    if (m.mes % 100 === 1) acum = 0n;
    acum += m.flujo;
    return {
      mes: m.mes, tipo: "Proyectado", saldoInicial: m.saldoInicial, ingresos: m.ventas + m.otrosIngresos, egresosOperativos: m.gastoOperativo + m.porPagar,
      inversiones: m.inversion, financiamiento: m.aportes, pagoDeudas: m.cuotas, otros: 0n, flujoNeto: m.flujo, saldoFinal: m.saldoFinal, acumuladoAnio: acum,
    };
  });
  const filas = [...real, ...proyectado];
  const anio = Math.floor(mesCorte / 100);
  const delAnio = real.filter(m => Math.floor(m.mes / 100) === anio);
  const flujoAnio = delAnio.reduce((s, m) => s + m.flujoNeto, 0n);
  const egresoProm = delAnio.length ? delAnio.reduce((s, m) => s + Number(m.egresosOperativos), 0) / delAnio.length : 0;
  const saldoHoy = real.at(-1)?.saldoFinal ?? 0n;
  const cobertura = coberturaDias(saldoHoy, egresoProm);
  const meta = params?.metaCoberturaDias ?? 30, alerta = params?.alertaCoberturaDias ?? 20;
  const cols: [string, keyof MesFlujo][] = [["Saldo inicial", "saldoInicial"], ["Ingresos", "ingresos"], ["Egresos operativos", "egresosOperativos"], ["Inversiones", "inversiones"],
    ["Financiamiento y aportes", "financiamiento"], ["Pago de deudas", "pagoDeudas"], ["Intereses y retiros", "otros"], ["Flujo neto", "flujoNeto"], ["Saldo final", "saldoFinal"], ["Acumulado del año", "acumuladoAnio"]];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        {([["Flujo real del año", gs(flujoAnio)], [`Saldo al cierre de ${nombreMes(mesCorte)}`, gs(saldoHoy)], ["Egreso operativo mensual promedio", gs(Math.round(egresoProm))],
          ["Cobertura de caja", cobertura === null ? "—" : `${Math.round(cobertura)} días`]] as const).map(([t, v]) => (
          <div key={t} style={{ ...tarjeta, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div>
            <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: t === "Cobertura de caja" && cobertura !== null ? (cobertura >= meta ? "var(--success-text)" : cobertura < alerta ? "var(--danger-text)" : "var(--warning-text)") : "var(--text-primary)" }}>{v}</div>
            {t === "Cobertura de caja" && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Meta ≥ {meta} · alerta &lt; {alerta}</div>}
          </div>
        ))}
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 1200 }}>
          <thead><tr><th>Mes</th><th>Tipo</th>{cols.map(([t]) => <th key={t} style={{ textAlign: "right" }}>{t}</th>)}</tr></thead>
          <tbody>
            {filas.map(m => (
              <tr key={`${m.tipo}-${m.mes}`} style={{ color: m.tipo === "Proyectado" ? "var(--text-muted)" : undefined }}>
                <td style={{ whiteSpace: "nowrap" }}>{nombreMes(m.mes, true)}</td>
                <td style={{ fontSize: 11 }}>{m.tipo}</td>
                {cols.map(([t, k]) => { const v = m[k] as bigint; return <td key={t} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: k === "flujoNeto" || k === "saldoFinal" ? 600 : 400, color: v < 0n && (k === "flujoNeto" || k === "saldoFinal") ? "var(--danger-text)" : undefined }}>{gs(v)}</td>; })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "8px 14px 12px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Real = lo efectivamente cobrado y pagado (por fecha de pago), partiendo de los saldos iniciales de las cuentas. Proyectado = la Proyección de caja. El acumulado se reinicia en enero.
        </div>
      </div>
    </>
  );
}
