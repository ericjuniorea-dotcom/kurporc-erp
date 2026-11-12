// Carga de datos para la línea de tiempo de ciclos de una cerda (solo servidor).
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC } from "@/lib/finanzas/calculos";
import { parametrosParadas } from "@/lib/cerdas-paradas/datos";
import { ciclosCerda, type Fallo } from "./ciclos";

export async function ciclosDeCerda(org: string, id: string) {
  const sow = await prisma.sow.findFirst({ where: { id, tenantId: org }, select: { id: true, entryDate: true, birthDate: true, sourceProvider: true, purchasePriceGs: true } });
  if (!sow) return null;

  const [servicios, partos, chequeos, abortos, repeticiones, descarte, recibidas, donadas, p] = await Promise.all([
    prisma.serviceEvent.findMany({ where: { tenantId: org, sowId: id }, select: { id: true, codigo: true, serviceDate: true }, orderBy: { serviceDate: "asc" } }),
    prisma.farrowingEvent.findMany({
      where: { tenantId: org, sowId: id }, orderBy: { startDatetime: "asc" },
      select: { id: true, codigo: true, serviceEventId: true, startDatetime: true, durationMinutes: true, bornAlive: true, bornDead: true, mummified: true, avgPigletWeightKg: true,
        deaths: { select: { quantity: true } },
        weaning: { select: { weaningDate: true, pigletsWeaned: true, avgPigletWeightKg: true, lastMinuteReceived: true, lastMinuteDonated: true } } },
    }),
    prisma.pregnancyCheck.findMany({ where: { tenantId: org, sowId: id, result: "NOT_PREGNANT" }, select: { serviceEventId: true, checkDate: true } }),
    prisma.abortionEvent.findMany({ where: { tenantId: org, sowId: id }, select: { serviceEventId: true, abortionDate: true } }),
    prisma.heatRepeat.findMany({ where: { tenantId: org, sowId: id }, select: { serviceEventId: true, repeatDate: true } }),
    prisma.sowDiscard.findFirst({ where: { tenantId: org, sowId: id }, orderBy: { discardDate: "desc" }, select: { discardDate: true } }),
    prisma.pigletMovement.findMany({ where: { tenantId: org, destinationId: id }, select: { movementDate: true, quantity: true } }),
    prisma.pigletMovement.findMany({ where: { tenantId: org, originId: id }, select: { movementDate: true, quantity: true } }),
    parametrosParadas(org),
  ]);
  const fallos: Fallo[] = [
    ...repeticiones.map(r => ({ servicioId: r.serviceEventId, fecha: r.repeatDate, tipo: "REPETICION" as const })),
    ...abortos.map(a => ({ servicioId: a.serviceEventId, fecha: a.abortionDate, tipo: "ABORTO" as const })),
    ...chequeos.map(c => ({ servicioId: c.serviceEventId, fecha: c.checkDate, tipo: "VACIA" as const })),
  ];
  const filas = ciclosCerda({
    ingreso: sow.entryDate, nacimiento: sow.birthDate, hoy: hoyUTC(), descarte: descarte?.discardDate ?? null,
    compra: !!sow.purchasePriceGs || (!!sow.sourceProvider && !/propia/i.test(sow.sourceProvider)),
    servicios: servicios.map(s => ({ id: s.id, codigo: s.codigo, fecha: s.serviceDate })),
    partos: partos.map(x => ({
      id: x.id, codigo: x.codigo, servicioId: x.serviceEventId, inicio: x.startDatetime, duracionMin: x.durationMinutes, vivos: x.bornAlive, muertos: x.bornDead, momias: x.mummified,
      pesoMedio: x.avgPigletWeightKg === null ? null : Number(x.avgPigletWeightKg), muertesLechones: x.deaths.reduce((s, d) => s + d.quantity, 0),
      destete: x.weaning ? { fecha: x.weaning.weaningDate, destetados: x.weaning.pigletsWeaned, pesoMedio: Number(x.weaning.avgPigletWeightKg) || null, recibidos: x.weaning.lastMinuteReceived, donados: x.weaning.lastMinuteDonated } : null,
    })),
    fallos,
    adopcionesRecibidas: recibidas.map(r => ({ fecha: r.movementDate, cantidad: r.quantity })),
    adopcionesDonadas: donadas.map(r => ({ fecha: r.movementDate, cantidad: r.quantity })),
    objetivo: {
      gestacion: p.gestacionDias, lactancia: p.lactanciaDias, idsMax: p.calc.intervaloObjetivoDias + p.calc.toleranciaDias,
      edadPrimerServicio: p.calc.edadPrimerServicioDias, adaptacion: p.calc.adaptacionDias, tolerancia: p.calc.toleranciaDias,
    },
  });
  return { filas, idsMax: p.calc.intervaloObjetivoDias + p.calc.toleranciaDias };
}
