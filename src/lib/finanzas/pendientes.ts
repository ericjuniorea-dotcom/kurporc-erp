// Arma las filas de Cuentas por pagar / por cobrar para la pantalla (server).
import "server-only";
import prisma from "@/lib/db/prisma";
import { pendientes } from "./datos";
import { TRAMOS, estadoCuentaDe, hoyUTC, mesDePago, pct, tramoDe } from "./calculos";

export async function vistaPendientes(org: string, esCobro: boolean) {
  const corte = hoyUTC();
  const [movs, cuentas] = await Promise.all([
    pendientes(org, esCobro),
    prisma.cuentaFondos.findMany({ where: { organizacionId: org, activa: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, tipo: true } }),
  ]);
  const filas = movs.map(m => ({
    id: m.id, fecha: m.fecha.toISOString().slice(0, 10), vencimiento: m.fechaVencimiento?.toISOString().slice(0, 10) ?? null,
    concepto: m.concepto, categoria: m.categoria.nombre, contraparte: m.contraparte?.nombre ?? "",
    montoGs: m.montoGs.toString(), pagadoGs: m.pagadoGs.toString(), saldoGs: m.saldoGs.toString(),
    estado: estadoCuentaDe(m.montoGs, m.saldoGs, m.fechaVencimiento, corte, esCobro),
    tramo: tramoDe(m.fechaVencimiento, corte, m.saldoGs),
    factura: m.facturaNumero ?? "", observacion: m.observacion ?? "",
    mesPago: esCobro ? null : mesDePago(m.fechaVencimiento, corte),
  }));
  const total = movs.reduce((s, m) => s + m.saldoGs, 0n);
  const resumen = TRAMOS.map(t => {
    const monto = movs.filter(m => tramoDe(m.fechaVencimiento, corte, m.saldoGs) === t).reduce((s, m) => s + m.saldoGs, 0n);
    return { tramo: t, montoGs: monto.toString(), pct: pct(monto, total) };
  });
  return { filas, cuentas, resumen, hoy: corte.toISOString().slice(0, 10) };
}
