import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { prestamosDe } from "@/lib/finanzas/plan-datos";
import { mesDeFecha, resumenPrestamo, sumarMeses } from "@/lib/finanzas/planificacion";
import { gs, nombreMes } from "@/lib/finanzas/calculos";
import { fmt } from "../tabla-mensual";
import { NuevoPrestamo } from "./nuevo-prestamo";

export const metadata = { title: "Deudas · Finanzas · KurPorc" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "—");

export default async function DeudasPage() {
  const { org, permisos, corte, mesCorte } = await paginaFinanzas("finanzas.deudas.ver");
  const [prestamos, cuentas] = await Promise.all([
    prestamosDe(org),
    prisma.cuentaFondos.findMany({ where: { organizacionId: org, activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);
  const filas = prestamos.map(p => ({ p, r: resumenPrestamo(p, p.cuotas, corte) }));
  const vigentes = filas.filter(f => f.p.estado === "VIGENTE");
  const cuotasEn = (desde: number, n: number) => vigentes.reduce((s, f) => s + f.p.cuotas.filter(c => !c.pagada && mesDeFecha(c.vencimiento) >= desde && mesDeFecha(c.vencimiento) < sumarMeses(desde, n)).reduce((t, c) => t + c.montoGs, 0n), 0n);
  const resumen = {
    deuda: vigentes.reduce((s, f) => s + f.r.saldo, 0n),
    cuotaHoy: cuotasEn(mesCorte, 1), proximoMes: cuotasEn(sumarMeses(mesCorte, 1), 1),
    tres: cuotasEn(sumarMeses(mesCorte, 1), 3), doce: cuotasEn(sumarMeses(mesCorte, 1), 12),
    recibido: filas.reduce((s, f) => s + f.p.montoRecibidoGs, 0n),
    pagado: filas.reduce((s, f) => s + f.p.cuotas.filter(c => c.pagada).reduce((t, c) => t + c.montoGs, 0n), 0n),
    costo: filas.reduce((s, f) => s + f.r.costoFinanciero, 0n),
  };
  const calendario = Array.from({ length: 12 }, (_, i) => sumarMeses(mesCorte, i));
  const ranking = [...vigentes].filter(f => f.r.tasaAnual !== null).sort((a, b) => (b.r.tasaAnual ?? 0) - (a.r.tasaAnual ?? 0));
  const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("es-PY", { maximumFractionDigits: 2 })} %`);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {([["Deuda total pendiente", resumen.deuda], ["Cuota de este mes", resumen.cuotaHoy], ["Cuota del mes que viene", resumen.proximoMes], ["Próximos 3 meses", resumen.tres],
          ["Próximos 12 meses", resumen.doce], ["Total recibido", resumen.recibido], ["Total pagado", resumen.pagado], ["Costo financiero total", resumen.costo]] as const).map(([t, v]) => (
          <div key={t} style={{ ...tarjeta, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{gs(v)}</div>
          </div>
        ))}
      </div>
      {puede(permisos, "finanzas.deudas.crear") && <NuevoPrestamo cuentas={cuentas} hoy={corte.toISOString().slice(0, 10)} />}
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Préstamos</div>
        <table className="kp-table" style={{ minWidth: 1100 }}>
          <thead><tr><th>Acreedor</th><th style={{ textAlign: "right" }}>Recibido</th><th style={{ textAlign: "right" }}>Cuota</th><th style={{ textAlign: "right" }}>Cuotas</th><th style={{ textAlign: "right" }}>Saldo</th><th style={{ textAlign: "right" }}>Costo financiero</th><th style={{ textAlign: "right" }}>Tasa mensual</th><th style={{ textAlign: "right" }}>Tasa anual</th><th>Próximo pago</th><th>Último</th></tr></thead>
          <tbody>
            {filas.map(({ p, r }) => (
              <tr key={p.id}>
                <td><div style={{ color: "var(--text-primary)" }}>{p.acreedor}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.concepto}{p.debitoAutomatico ? " · débito automático" : ""}</div></td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(p.montoRecibidoGs)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(p.cuotaMensualGs)}</td>
                <td style={{ textAlign: "right" }}>{r.pagadas}/{p.numeroCuotas}{r.atrasadas > 0 && <div style={{ fontSize: 11, color: "var(--danger-text)" }}>{r.atrasadas} atrasada(s)</div>}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{gs(r.saldo)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(r.costoFinanciero)}</td>
                <td style={{ textAlign: "right" }}>{pct(r.tasaMensual)}</td>
                <td style={{ textAlign: "right" }}>{pct(r.tasaAnual)}</td>
                <td>{r.proxima ? `${fecha(r.proxima.vencimiento)} · ${gs(r.proxima.montoGs)}` : "Cancelado"}</td>
                <td>{fecha(r.ultimoVencimiento)}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={10} style={{ padding: 16, color: "var(--text-muted)" }}>No hay préstamos cargados.</td></tr>}
          </tbody>
        </table>
        <div style={{ padding: "8px 14px 12px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Cada cuota que vence aparece sola en Por pagar (o pagada, si es débito automático). Una cuota cuenta como pagada cuando se registra su pago. La tasa implícita es la que iguala las cuotas con lo recibido.
        </div>
      </div>
      {vigentes.length > 0 && (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Calendario de cuotas</div>
          <table className="kp-table" style={{ minWidth: 1000 }}>
            <thead><tr><th>Préstamo</th>{calendario.map(m => <th key={m} style={{ textAlign: "right" }}>{nombreMes(m, true)}</th>)}</tr></thead>
            <tbody>
              {vigentes.map(({ p }) => (
                <tr key={p.id}>
                  <td>{p.acreedor}</td>
                  {calendario.map(m => { const v = p.cuotas.filter(c => !c.pagada && Math.max(mesDeFecha(c.vencimiento), mesCorte) === m).reduce((s, c) => s + c.montoGs, 0n); return <td key={m} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{v ? fmt(v) : ""}</td>; })}
                </tr>
              ))}
              <tr style={{ background: "var(--bg-elevated)" }}>
                <td style={{ fontWeight: 600 }}>Cuota total del mes</td>
                {calendario.map(m => <td key={m} style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(vigentes.reduce((s, { p }) => s + p.cuotas.filter(c => !c.pagada && Math.max(mesDeFecha(c.vencimiento), mesCorte) === m).reduce((t, c) => t + c.montoGs, 0n), 0n))}</td>)}
              </tr>
            </tbody>
          </table>
          <div style={{ padding: "8px 14px 12px", fontSize: 11, color: "var(--text-muted)" }}>Lo atrasado se muestra en el mes actual.</div>
        </div>
      )}
      {ranking.length > 1 && (
        <div style={{ ...tarjeta, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>¿Cuál conviene refinanciar primero?</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.8 }}>
            {ranking.map(({ p, r }) => (
              <li key={p.id}>{p.acreedor}: tasa anual {pct(r.tasaAnual)}, saldo {gs(r.saldo)} · cada punto menos de tasa anual ahorra ~{gs(BigInt(Math.round(Number(r.saldo) * 0.01 * (r.pendientes / 12) / 2)))}</li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
