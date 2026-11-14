// Fase 15.4 · Datos del Inicio del panel de plataforma.
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC, mesDe } from "@/lib/finanzas/calculos";
import { funcionesMasPedidas } from "@/lib/buzon/datos";
import { saludOrganizaciones } from "./salud";
import { usoPlataforma } from "./uso";

const DIA = 86_400_000;

export async function inicioPlataforma() {
  const hoy = hoyUTC();
  const hace7 = new Date(hoy.getTime() - 7 * DIA);
  const mes = mesDe(hoy);
  const [orgs, usuarios, activos7, madresPorOrg, plata, buzonNuevos, privacidad, incidentes, salud, funciones, uso, conPasos, miembros] = await Promise.all([
    prisma.tenant.findMany({ select: { id: true, tipo: true, createdAt: true } }),
    prisma.user.count(),
    prisma.actividadDiaria.groupBy({ by: ["userId"], where: { fecha: { gte: hace7 } } }).then(r => r.length),
    prisma.sow.groupBy({ by: ["tenantId"], where: { isActive: true }, _count: { _all: true } }),
    prisma.movimiento.groupBy({ by: ["tipo"], where: { tipo: { in: ["INGRESO", "GASTO"] }, mes, estado: { not: "ANULADO" }, esInterno: false }, _sum: { montoGs: true } }),
    prisma.sugerencia.count({ where: { estado: "NUEVA", agrupadaEn: null } }),
    prisma.solicitudPrivacidad.count({ where: { estado: { in: ["RECIBIDA", "EN_CURSO"] } } }),
    prisma.incidenteSeguridad.count({ where: { estado: { not: "CERRADO" } } }),
    saludOrganizaciones(),
    funcionesMasPedidas(1, 50),
    usoPlataforma(7),
    prisma.user.count({ where: { onboardingCompleto: true } }),
    prisma.miembro.findMany({ where: { estado: "ACTIVO" }, select: { userId: true, organizacionId: true } }),
  ]);
  const granjas = orgs.filter(o => o.tipo !== "VENDEDOR");
  const conMadres = new Set(madresPorOrg.map(m => m.tenantId));
  const usuariosCon = (orgsOk: (id: string) => boolean) => new Set(miembros.filter(m => orgsOk(m.organizacionId)).map(m => m.userId)).size;
  const monto = (t: string) => plata.find(p => p.tipo === t)?._sum.montoGs ?? 0n;
  const rojos = Object.values(salud).filter(s => s.estado === "ROJO").length;

  return {
    organizaciones: {
      granjas: granjas.length,
      tiendas: orgs.length - granjas.length,
      nuevas7: orgs.filter(o => o.createdAt >= hace7).length,
    },
    usuarios, activos7,
    madres: madresPorOrg.reduce((s, m) => s + m._count._all, 0),
    granjasConMadres: conMadres.size,
    plataMes: { ingresos: monto("INGRESO"), gastos: monto("GASTO") },
    atencion: {
      buzonNuevos,
      funcionesPedidas: funciones.filter(f => f.pedidas >= 3).length,
      rojos, privacidad, incidentes,
    },
    embudo: [
      { etiqueta: "Registrados", valor: usuarios },
      { etiqueta: "Terminaron los primeros pasos", valor: conPasos },
      { etiqueta: "Con una organización con madres cargadas", valor: usuariosCon(id => conMadres.has(id)) },
      { etiqueta: "Cargaron datos en los últimos 7 días", valor: usuariosCon(id => !!salud[id]?.cargoUltimos7) },
    ],
    topFunciones: funciones.slice(0, 3).map(f => ({ id: f.id, titulo: f.tituloPublico ?? f.titulo ?? "Sin título", pedidas: f.pedidas })),
    topModulos: uso.modulos.slice(0, 3),
  };
}
