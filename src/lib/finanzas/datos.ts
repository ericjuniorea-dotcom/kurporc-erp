// Consultas de Finanzas (Fase 8). Todas reciben la organización y filtran por ella.
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC, saldoCuenta } from "./calculos";

/** Categorías visibles: las del sistema + las propias de la organización. */
export function categoriasDe(org: string) {
  return prisma.categoriaFinanciera.findMany({
    where: { activa: true, OR: [{ organizacionId: null }, { organizacionId: org }] },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });
}

export function unidadesDe(org: string) {
  return prisma.unidadNegocio.findMany({ where: { organizacionId: org, activa: true }, orderBy: { codigo: "asc" }, select: { id: true, codigo: true, nombre: true, tipo: true, granjaId: true } });
}

/** La primera vez que se entra a Finanzas: parámetros por defecto y una cuenta "Caja". */
export async function asegurarFinanzas(org: string) {
  await prisma.parametrosFinancieros.upsert({ where: { organizacionId: org }, create: { organizacionId: org }, update: {} });
  const hay = await prisma.cuentaFondos.count({ where: { organizacionId: org } });
  if (hay === 0) await prisma.cuentaFondos.create({ data: { organizacionId: org, nombre: "Caja", tipo: "CAJA" } }).catch(() => {});
}

/** Pagos de la organización con el signo de su movimiento (para saldos y flujo de caja). */
export async function pagosConSigno(org: string) {
  const pagos = await prisma.pagoMovimiento.findMany({
    where: { movimiento: { organizacionId: org, estado: { not: "ANULADO" } } },
    select: { montoGs: true, fechaPago: true, cuentaFondosId: true, movimiento: { select: { signo: true, cuentaFondosId: true, esInterno: true } } },
  });
  return pagos.map(p => ({
    montoGs: p.montoGs, fechaPago: p.fechaPago, signo: p.movimiento.signo,
    cuentaFondosId: p.cuentaFondosId ?? p.movimiento.cuentaFondosId, esInterno: p.movimiento.esInterno,
  }));
}

/** Cuentas de fondos con saldo calculado y último saldo declarado. */
export async function cuentasConSaldo(org: string) {
  const [cuentas, pagos, declarados] = await Promise.all([
    prisma.cuentaFondos.findMany({ where: { organizacionId: org }, orderBy: [{ activa: "desc" }, { tipo: "asc" }, { nombre: "asc" }] }),
    pagosConSigno(org),
    prisma.saldoDeclarado.findMany({ where: { organizacionId: org }, orderBy: { fecha: "desc" } }),
  ]);
  const corte = hoyUTC();
  const filas = cuentas.map(c => {
    const propios = pagos.filter(p => p.cuentaFondosId === c.id);
    const ultimo = declarados.find(d => d.cuentaFondosId === c.id) ?? null;
    const calculadoAlDeclarar = ultimo ? saldoCuenta(c, propios, ultimo.fecha) : null;
    return {
      ...c,
      saldoGs: saldoCuenta(c, propios, corte),
      declarado: ultimo ? { fecha: ultimo.fecha, saldoGs: ultimo.saldoGs, diferenciaGs: ultimo.saldoGs - calculadoAlDeclarar! } : null,
    };
  });
  const sinAsignar = pagos.filter(p => !p.cuentaFondosId).reduce((s, p) => s + (p.signo > 0 ? p.montoGs : -p.montoGs), 0n);
  return { cuentas: filas, sinAsignarGs: sinAsignar };
}

/** Movimientos con saldo pendiente (base de Cuentas por pagar y por cobrar). */
export async function pendientes(org: string, esCobro: boolean) {
  const movs = await prisma.movimiento.findMany({
    where: { organizacionId: org, estado: esCobro ? "POR_COBRAR" : "PENDIENTE" },
    orderBy: [{ fechaVencimiento: { sort: "asc", nulls: "last" } }, { fecha: "asc" }],
    select: {
      id: true, fecha: true, fechaVencimiento: true, concepto: true, montoGs: true, facturaNumero: true, observacion: true, tipo: true, origen: true,
      categoria: { select: { nombre: true } }, contraparte: { select: { nombre: true } },
      pagos: { select: { montoGs: true, fechaPago: true } },
    },
  });
  return movs.map(m => {
    const pagado = m.pagos.reduce((s, p) => s + p.montoGs, 0n);
    return { ...m, pagadoGs: pagado, saldoGs: m.montoGs - pagado };
  });
}
