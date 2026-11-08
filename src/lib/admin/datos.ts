// Consultas del panel de plataforma (Fase 11). Agregados de toda la plataforma: solo desde el servidor.
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC, mesDe } from "@/lib/finanzas/calculos";

const DIA = 86_400_000;

export async function resumenPlataforma() {
  const hoy = hoyUTC();
  const hace7 = new Date(hoy.getTime() - 7 * DIA), hace30 = new Date(hoy.getTime() - 30 * DIA);
  const mes = mesDe(hoy);
  const [usuarios, nuevos7, orgsPorTipo, granjas, madres, activosHoy, activos7, activos30, ingresosMes, privacidad, incidentes, fallidos24, altas] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: hace7 } } }),
    prisma.tenant.groupBy({ by: ["tipo"], _count: { _all: true } }),
    prisma.granja.count({ where: { activa: true } }),
    prisma.sow.count({ where: { isActive: true } }),
    prisma.actividadDiaria.count({ where: { fecha: hoy } }),
    prisma.actividadDiaria.groupBy({ by: ["userId"], where: { fecha: { gte: hace7 } } }).then(r => r.length),
    prisma.actividadDiaria.groupBy({ by: ["userId"], where: { fecha: { gte: hace30 } } }).then(r => r.length),
    prisma.movimiento.aggregate({ where: { tipo: "INGRESO", mes, estado: { not: "ANULADO" }, esInterno: false }, _sum: { montoGs: true } }),
    prisma.solicitudPrivacidad.count({ where: { estado: { in: ["RECIBIDA", "EN_CURSO"] } } }),
    prisma.incidenteSeguridad.count({ where: { estado: { not: "CERRADO" } } }),
    prisma.auditoria.count({ where: { accion: { in: ["LOGIN_FALLIDO", "LOGIN_BLOQUEADO"] }, createdAt: { gte: new Date(Date.now() - DIA) } } }),
    prisma.user.findMany({ where: { createdAt: { gte: hace30 } }, select: { createdAt: true, tipoRegistro: true } }),
  ]);
  const altasPorDia = new Map<string, number>();
  for (const u of altas) { const k = u.createdAt.toISOString().slice(0, 10); altasPorDia.set(k, (altasPorDia.get(k) ?? 0) + 1); }
  return {
    usuarios, nuevos7, granjas, madres, activosHoy, activos7, activos30, privacidad, incidentes, fallidos24,
    orgsPorTipo: Object.fromEntries(orgsPorTipo.map(o => [o.tipo, o._count._all])) as Record<string, number>,
    ingresosMesGs: ingresosMes._sum.montoGs ?? 0n,
    altasPorDia: Array.from(altasPorDia.entries()).sort(([a], [b]) => (a < b ? 1 : -1)),
  };
}

export async function cuentasPlataforma() {
  const hace30 = new Date(hoyUTC().getTime() - 30 * DIA);
  const [usuarios, mfa, aceptaciones, miembros, actividad] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, tipoRegistro: true, proveedorLogin: true, tipoAcceso: true, onboardingCompleto: true, isActive: true, ultimoAcceso: true, createdAt: true, authUserId: true, adminPlataforma: { select: { nivel: true } } },
    }),
    prisma.$queryRaw<{ user_id: string }[]>`select distinct user_id::text from auth.mfa_factors where status = 'verified'`.catch(() => []),
    prisma.aceptacionDocumento.findMany({ where: { codigo: "TERMINOS", aceptado: true }, select: { userId: true, version: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    prisma.miembro.findMany({ select: { userId: true, esPropietario: true, organizacion: { select: { farmName: true, tipo: true } } } }),
    prisma.actividadDiaria.groupBy({ by: ["userId"], where: { fecha: { gte: hace30 } }, _count: { _all: true } }),
  ]);
  const conMfa = new Set(mfa.map(m => m.user_id));
  const contrato = new Map<string, string>();
  for (const a of aceptaciones) if (!contrato.has(a.userId)) contrato.set(a.userId, a.version);
  const dias = new Map(actividad.map(a => [a.userId, a._count._all]));
  return usuarios.map(u => ({
    ...u,
    segundoFactor: !!u.authUserId && conMfa.has(u.authUserId),
    contrato: contrato.get(u.id) ?? null,
    organizaciones: miembros.filter(m => m.userId === u.id).map(m => ({ nombre: m.organizacion.farmName, tipo: m.organizacion.tipo, propietario: m.esPropietario })),
    diasActivo30: dias.get(u.id) ?? 0,
  }));
}

export async function organizacionesPlataforma() {
  const mes = mesDe(hoyUTC());
  const [orgs, miembros, granjas, madres, ingresos, ultimaActividad] = await Promise.all([
    prisma.tenant.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, farmName: true, tipo: true, departamento: true, plan: true, estado: true, verificacion: true, createdAt: true, ruc: true } }),
    prisma.miembro.groupBy({ by: ["organizacionId"], where: { estado: "ACTIVO" }, _count: { _all: true } }),
    prisma.granja.groupBy({ by: ["organizacionId"], where: { activa: true }, _count: { _all: true } }),
    prisma.sow.groupBy({ by: ["tenantId"], where: { isActive: true }, _count: { _all: true } }),
    prisma.movimiento.groupBy({ by: ["organizacionId"], where: { tipo: "INGRESO", mes, estado: { not: "ANULADO" }, esInterno: false }, _sum: { montoGs: true } }),
    prisma.actividadDiaria.groupBy({ by: ["organizacionId"], _max: { fecha: true } }),
  ]);
  const de = <T extends { _count: { _all: number } }>(xs: T[], k: keyof T, id: string) => xs.find(x => x[k] === id)?._count._all ?? 0;
  return orgs.map(o => ({
    ...o,
    miembros: de(miembros, "organizacionId", o.id),
    granjas: de(granjas, "organizacionId", o.id),
    madres: de(madres, "tenantId", o.id),
    ingresosMesGs: ingresos.find(i => i.organizacionId === o.id)?._sum.montoGs ?? 0n,
    ultimaActividad: ultimaActividad.find(a => a.organizacionId === o.id)?._max.fecha ?? null,
  }));
}
