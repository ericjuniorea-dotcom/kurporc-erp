/**
 * Fuente única de verdad para el estado de cerdas en gestación.
 *
 * Una cerda se clasifica según su ÚLTIMO evento de servicio (120 días):
 *   PREÑADA  → tiene PregnancyCheck PREGNANT  O  plantelState=PREGNANT (datos históricos)
 *   SERVIDA  → sin confirmación de preñez, sin repetición de celo posterior al servicio
 *   DISPONIBLE → tuvo repetición de celo posterior al servicio, o no tiene servicio activo
 */

import { prisma } from "@/lib/db/prisma";

export interface SowGestacionState {
  sowId:         string;
  serviceEventId: string;
  serviceDate:   Date;
  diasDesdeServ: number;
  estado:        "PRENADA" | "SERVIDA" | "DISPONIBLE";
  plantelState:  string | null;
  checkResult:   string | null;
}

export async function getGestacionStates(tenantId: string): Promise<SowGestacionState[]> {
  const today  = new Date();
  const cutoff = new Date(today.getTime() - 120 * 86400000);

  // 1 y 3 son independientes entre sí (ninguna depende del resultado de la
  // otra) — se disparan juntas en vez de una tras otra.
  const [events, enMaternidad] = await Promise.all([
    // 1. Todos los servicios de los últimos 120 días
    prisma.serviceEvent.findMany({
      where: { tenantId, serviceDate: { gte: cutoff }, sow: { isActive: true } },
      include: {
        farrowing:       { select: { id: true } },
        pregnancyChecks: { orderBy: { checkDate: "desc" }, take: 1, select: { result: true } },
        sow: {
          select: {
            id: true, identCode: true, caravanaCode: true,
            galponAssigned: true, corralAssigned: true,
            plantelState: true,
          },
        },
      },
      orderBy: { serviceDate: "desc" },
    }),
    // 3. Sows actualmente en Maternidad — excluir de gestación sin excepción
    prisma.farrowingEvent.findMany({
      where:  { tenantId, weaning: null },
      select: { sowId: true },
    }),
  ]);

  // 2. Deduplicar: solo el evento más reciente por cerda
  const latestBySow = new Map<string, typeof events[0]>();
  for (const ev of events) {
    if (!latestBySow.has(ev.sowId)) latestBySow.set(ev.sowId, ev);
  }
  const enMaternidadIds = new Set(enMaternidad.map(f => f.sowId));

  // 4. Heat repeats (repeticiones de celo registradas explícitamente)
  const sowIds = Array.from(latestBySow.keys());
  const heatRepeats = sowIds.length > 0
    ? await prisma.heatRepeat.findMany({
        where:  { tenantId, sowId: { in: sowIds } },
        select: { sowId: true, repeatDate: true },
      })
    : [];
  const lastHeatRepeat = new Map<string, Date>();
  for (const hr of heatRepeats) {
    const curr = lastHeatRepeat.get(hr.sowId);
    if (!curr || hr.repeatDate > curr) lastHeatRepeat.set(hr.sowId, hr.repeatDate);
  }

  // 4. Clasificar cada cerda
  const result: SowGestacionState[] = [];

  for (const [sowId, ev] of Array.from(latestBySow.entries())) {
    if (ev.farrowing) continue;              // parió → fuera de gestación
    if (enMaternidadIds.has(sowId)) continue; // en maternidad activa → fuera de gestación

    const diasDesdeServ = Math.floor((today.getTime() - ev.serviceDate.getTime()) / 86400000);
    const checkResult   = ev.pregnancyChecks[0]?.result ?? null;
    const plantelState  = ev.sow.plantelState ?? null;

    // PREÑADA: tiene check PREGNANT (nuevo flujo) O plantelState=PREGNANT (flujo histórico)
    const isPreñada = checkResult === "PREGNANT" || plantelState === "PREGNANT";

    // REPETICIÓN DE CELO: existe HeatRepeat posterior al servicio activo
    const hrDate     = lastHeatRepeat.get(sowId);
    const tuvoRepCelo = !!(hrDate && hrDate >= ev.serviceDate);

    let estado: SowGestacionState["estado"];
    if (isPreñada) {
      estado = "PRENADA";
    } else if (tuvoRepCelo) {
      estado = "DISPONIBLE";
    } else {
      estado = "SERVIDA";
    }

    result.push({
      sowId,
      serviceEventId: ev.id,
      serviceDate:    ev.serviceDate,
      diasDesdeServ,
      estado,
      plantelState,
      checkResult,
    });
  }

  return result;
}

/** Datos de la cerda para incluir en las respuestas de detalle */
export async function getGestacionDetail(tenantId: string) {
  const today  = new Date();
  const cutoff = new Date(today.getTime() - 120 * 86400000);

  const events = await prisma.serviceEvent.findMany({
    where: { tenantId, serviceDate: { gte: cutoff }, sow: { isActive: true } },
    include: {
      farrowing:       { select: { id: true } },
      pregnancyChecks: { orderBy: { checkDate: "desc" }, take: 1, select: { result: true } },
      sow: {
        select: {
          id: true, identCode: true, caravanaCode: true,
          galponAssigned: true, corralAssigned: true,
          plantelState: true,
        },
      },
    },
    orderBy: { serviceDate: "desc" },
  });

  const latestBySow = new Map<string, typeof events[0]>();
  for (const ev of events) {
    if (!latestBySow.has(ev.sowId)) latestBySow.set(ev.sowId, ev);
  }

  const sowIds = Array.from(latestBySow.keys());
  const heatRepeats = sowIds.length > 0
    ? await prisma.heatRepeat.findMany({
        where:  { tenantId, sowId: { in: sowIds } },
        select: { sowId: true, repeatDate: true },
      })
    : [];
  const lastHeatRepeat = new Map<string, Date>();
  for (const hr of heatRepeats) {
    const curr = lastHeatRepeat.get(hr.sowId);
    if (!curr || hr.repeatDate > curr) lastHeatRepeat.set(hr.sowId, hr.repeatDate);
  }

  return { latestBySow, lastHeatRepeat, today };
}
