// Fase 15.3 · Tiempo de uso estimado (latidos de 60 s con la pestaña en uso). Se muestra en horas con un decimal.
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC } from "@/lib/finanzas/calculos";
import { etiquetaModulo } from "@/lib/modulos";

const DIA = 86_400_000;
export const horas = (segundos: number) => Math.round((segundos / 3600) * 10) / 10;
export const desde = (dias: number) => new Date(hoyUTC().getTime() - (dias - 1) * DIA);

function mediana(xs: number[]) {
  if (xs.length === 0) return 0;
  const o = [...xs].sort((a, b) => a - b), m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Segundos por módulo y por persona de una organización en los últimos `dias` días. */
export async function usoOrganizacion(organizacionId: string, dias = 7) {
  const where = { organizacionId, fecha: { gte: desde(dias) } };
  const [porModulo, porPersona] = await Promise.all([
    prisma.usoDiario.groupBy({ by: ["modulo"], where, _sum: { segundos: true } }),
    prisma.usoDiario.groupBy({ by: ["userId"], where, _sum: { segundos: true } }),
  ]);
  const total = porModulo.reduce((s, m) => s + (m._sum.segundos ?? 0), 0);
  return {
    totalSegundos: total,
    modulos: porModulo.map(m => ({ modulo: m.modulo, etiqueta: etiquetaModulo(m.modulo), segundos: m._sum.segundos ?? 0, parte: total ? (m._sum.segundos ?? 0) / total : 0 }))
      .sort((a, b) => b.segundos - a.segundos),
    personas: new Map(porPersona.map(p => [p.userId, p._sum.segundos ?? 0])),
  };
}

/** Segundos de la semana por organización (para listas). */
export async function usoPorOrganizacion(dias = 7) {
  const filas = await prisma.usoDiario.groupBy({ by: ["organizacionId"], where: { fecha: { gte: desde(dias) }, organizacionId: { not: null } }, _sum: { segundos: true } });
  return new Map(filas.map(f => [f.organizacionId!, f._sum.segundos ?? 0]));
}

/** Segundos de la semana por persona (para la lista de cuentas). */
export async function usoPorPersona(dias = 7) {
  const filas = await prisma.usoDiario.groupBy({ by: ["userId"], where: { fecha: { gte: desde(dias) } }, _sum: { segundos: true } });
  return new Map(filas.map(f => [f.userId, f._sum.segundos ?? 0]));
}

/** Ranking de módulos, mediana de horas por usuario y semana, y retención a 4 semanas. */
export async function usoPlataforma(dias = 28) {
  const hoy = hoyUTC();
  const [porModulo, porPersona, cohorte] = await Promise.all([
    prisma.usoDiario.groupBy({ by: ["modulo"], where: { fecha: { gte: desde(dias) } }, _sum: { segundos: true } }),
    prisma.usoDiario.groupBy({ by: ["userId"], where: { fecha: { gte: desde(dias) } }, _sum: { segundos: true } }),
    prisma.user.findMany({ where: { createdAt: { gte: new Date(hoy.getTime() - 35 * DIA), lt: new Date(hoy.getTime() - 28 * DIA) } }, select: { id: true } }),
  ]);
  const activosCohorte = cohorte.length
    ? (await prisma.actividadDiaria.groupBy({ by: ["userId"], where: { userId: { in: cohorte.map(c => c.id) }, fecha: { gte: desde(7) } } })).length
    : 0;
  const total = porModulo.reduce((s, m) => s + (m._sum.segundos ?? 0), 0);
  const semanas = dias / 7;
  return {
    totalSegundos: total,
    modulos: porModulo.map(m => ({ modulo: m.modulo, etiqueta: etiquetaModulo(m.modulo), segundos: m._sum.segundos ?? 0, parte: total ? (m._sum.segundos ?? 0) / total : 0 }))
      .sort((a, b) => b.segundos - a.segundos),
    medianaHorasSemana: horas(mediana(porPersona.map(p => (p._sum.segundos ?? 0) / semanas))),
    retencion: { cohorte: cohorte.length, activos: activosCohorte },
  };
}
