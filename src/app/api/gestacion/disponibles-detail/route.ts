export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

const ESTADO_LABEL: Record<string, string> = {
  EMPTY:                   "Vacía",
  REPLACEMENT_READY:       "Lista para primer servicio",
  REPLACEMENT_DEVELOPING:  "En desarrollo",
  QUARANTINE:              "En cuarentena",
};

// Ciclo estral estándar usado para proyectar la fecha de servicio de primerizas
// a partir del último celo observado. Fijo por ahora (no configurable).
const CICLO_CELO_DIAS = 21;

// Badge prioritario de la fila (mutuamente excluyente). Se evalúa en orden:
// aborto > repitió celo > sale de maternidad > primeriza; el primero que
// aplica gana. Todo se deriva de las tablas fuente (servicios, diagnósticos
// de preñez, abortos, partos, destetes) — nada se setea manualmente.
type BadgeEstado = "ABORTO" | "REPITIO_CELO" | "SALE_MATERNIDAD" | "PRIMERIZA" | null;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["gestacion.servicios.ver", "gestacion.diagnosticos.ver", "gestacion.lotes_reproductivos.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const { tenantId } = session.user;

  const today   = new Date();
  const cutoff60 = new Date(today.getTime() - 60 * 86400000);

  // Misma fuente de verdad que el KPI: excluir PRENADA, SERVIDA y las que están en Maternidad
  const [states, enMaternidad] = await Promise.all([
    getGestacionStates(tenantId),
    prisma.farrowingEvent.findMany({
      where:  { tenantId, weaning: null },
      select: { sowId: true },
    }),
  ]);
  const enMaternidadIds = new Set(enMaternidad.map(f => f.sowId));
  const noDisponibleIds = new Set([
    ...states
      .filter(s => s.estado === "PRENADA" || s.estado === "SERVIDA")
      .map(s => s.sowId),
    ...Array.from(enMaternidadIds),
  ]);

  // Todas las cerdas activas
  const todasActivas = await prisma.sow.findMany({
    where:  { tenantId, isActive: true },
    select: {
      id: true, identCode: true, caravanaCode: true,
      galponAssigned: true, corralAssigned: true, plantelState: true,
      currentParityCount: true, entryWeightKg: true, currentWeightKg: true,
    },
  });

  // Destetes recientes para calcular días desde destete y fecha recomendada
  const weaningsRecientes = await prisma.weaningEvent.findMany({
    where: {
      farrowing:      { tenantId },
      weaningDate:    { gte: cutoff60 },
      sowDestination: "GESTATION",
    },
    include: { farrowing: { select: { sowId: true } } },
    orderBy: { weaningDate: "desc" },
  });

  const lastWeaningBySow = new Map<string, Date>();
  for (const w of weaningsRecientes) {
    const sowId = w.farrowing.sowId;
    if (!lastWeaningBySow.has(sowId)) {
      lastWeaningBySow.set(sowId, new Date(w.weaningDate));
    }
  }

  // Disponibles = activas que no son PRENADA, SERVIDA, en MATERNIDAD ni en CUARENTENA
  const EXCLUIR_STATES = new Set(["LACTATING", "FARROWING", "QUARANTINE"]);

  const disponiblesPrevios = todasActivas.filter(s =>
    !noDisponibleIds.has(s.id) &&
    !EXCLUIR_STATES.has(s.plantelState ?? ""),
  );

  const allIds = disponiblesPrevios.map(s => s.id);

  // ── Datos fuente para "Último servicio", "N partos" y el badge prioritario ──
  const [ultimosServicios, partosPorCerda, abortos, diagnosticos, repeticionesCelo, destetes] = allIds.length > 0
    ? await Promise.all([
        prisma.serviceEvent.findMany({
          where:   { tenantId, sowId: { in: allIds } },
          orderBy: { serviceDate: "desc" },
          select:  { sowId: true, serviceDate: true },
        }),
        prisma.farrowingEvent.groupBy({
          by:    ["sowId"],
          where: { tenantId, sowId: { in: allIds } },
          _count: { id: true },
        }),
        prisma.abortionEvent.findMany({
          where:  { tenantId, sowId: { in: allIds } },
          select: { sowId: true, abortionDate: true },
        }),
        prisma.pregnancyCheck.findMany({
          where:  { tenantId, sowId: { in: allIds } },
          select: { sowId: true, checkDate: true, result: true },
        }),
        prisma.heatRepeat.findMany({
          where:  { tenantId, sowId: { in: allIds } },
          select: { sowId: true, repeatDate: true },
        }),
        prisma.weaningEvent.findMany({
          where:  { farrowing: { tenantId, sowId: { in: allIds } } },
          select: { weaningDate: true, farrowing: { select: { sowId: true } } },
        }),
      ])
    : [[], [], [], [], [], []];

  const lastServicioBySow = new Map<string, Date>();
  for (const ev of ultimosServicios) {
    if (!lastServicioBySow.has(ev.sowId)) lastServicioBySow.set(ev.sowId, new Date(ev.serviceDate));
  }

  const partosCountBySow = new Map<string, number>();
  for (const p of partosPorCerda) partosCountBySow.set(p.sowId, p._count.id);

  const maxAbortoBySow = new Map<string, Date>();
  for (const a of abortos) {
    const curr = maxAbortoBySow.get(a.sowId);
    const fecha = new Date(a.abortionDate);
    if (!curr || fecha > curr) maxAbortoBySow.set(a.sowId, fecha);
  }

  const negChecksBySow = new Map<string, Date[]>();
  for (const d of diagnosticos) {
    if (d.result !== "NOT_PREGNANT") continue;
    if (!negChecksBySow.has(d.sowId)) negChecksBySow.set(d.sowId, []);
    negChecksBySow.get(d.sowId)!.push(new Date(d.checkDate));
  }

  const heatRepeatsBySow = new Map<string, Date[]>();
  for (const hr of repeticionesCelo) {
    if (!heatRepeatsBySow.has(hr.sowId)) heatRepeatsBySow.set(hr.sowId, []);
    heatRepeatsBySow.get(hr.sowId)!.push(new Date(hr.repeatDate));
  }

  const maxDesteteBySow = new Map<string, Date>();
  for (const w of destetes) {
    const sowId = w.farrowing.sowId;
    const curr  = maxDesteteBySow.get(sowId);
    const fecha = new Date(w.weaningDate);
    if (!curr || fecha > curr) maxDesteteBySow.set(sowId, fecha);
  }

  // Último celo observado (AnimalEvent HEAT_OBSERVED) para las primerizas disponibles
  const primerizaIds = disponiblesPrevios
    .filter(s => (partosCountBySow.get(s.id) ?? 0) === 0)
    .map(s => s.id);

  const celosObservados = primerizaIds.length > 0
    ? await prisma.animalEvent.findMany({
        where:   { tenantId, sowId: { in: primerizaIds }, eventType: "HEAT_OBSERVED" },
        orderBy: { eventDate: "desc" },
        select:  { sowId: true, eventDate: true },
      })
    : [];
  const lastCeloBySow = new Map<string, Date>();
  for (const c of celosObservados) {
    if (!c.sowId) continue;
    if (!lastCeloBySow.has(c.sowId)) lastCeloBySow.set(c.sowId, new Date(c.eventDate));
  }

  const disponibles = disponiblesPrevios
    .map(s => {
      const galpon    = s.galponAssigned ?? "";
      const corral    = s.corralAssigned ?? "";
      const ubicacion = [galpon, corral].filter(Boolean).join(" – ") || "—";

      const lastWeaning = lastWeaningBySow.get(s.id) ?? null;
      const diasDesdeDestete = lastWeaning
        ? Math.floor((today.getTime() - lastWeaning.getTime()) / 86400000)
        : null;

      const totalPartos  = partosCountBySow.get(s.id) ?? 0;
      const esPrimeriza  = totalPartos === 0;
      const ultimoCelo   = esPrimeriza ? (lastCeloBySow.get(s.id) ?? null) : null;

      const ultimoServicio = lastServicioBySow.get(s.id) ?? null;

      // Badge prioritario: aborto > repitió celo > sale de maternidad > primeriza.
      const maxAborto        = maxAbortoBySow.get(s.id) ?? null;
      const hasNegCheckAfter = (negChecksBySow.get(s.id) ?? []).some(d => !!ultimoServicio && d > ultimoServicio);
      const hasHeatRepeatAfter = (heatRepeatsBySow.get(s.id) ?? []).some(d => !!ultimoServicio && d > ultimoServicio);
      const maxDestete       = maxDesteteBySow.get(s.id) ?? null;

      let badgeEstado: BadgeEstado = null;
      if (maxAborto && ultimoServicio && maxAborto > ultimoServicio) {
        badgeEstado = "ABORTO";
      } else if (hasNegCheckAfter || hasHeatRepeatAfter) {
        badgeEstado = "REPITIO_CELO";
      } else if (maxDestete && (!ultimoServicio || ultimoServicio <= maxDestete)) {
        badgeEstado = "SALE_MATERNIDAD";
      } else if (totalPartos === 0) {
        badgeEstado = "PRIMERIZA";
      }

      // Fecha estimada en la que la cerda estará lista para servicio:
      // post-destete → destete + 5d; primeriza con celo → celo + ciclo estral;
      // primeriza sin celo → sin dato (se ordena al final); resto → hoy (comportamiento previo).
      let fechaPrioridad: Date;
      if (lastWeaning) {
        fechaPrioridad = new Date(lastWeaning.getTime() + 5 * 86400000);
      } else if (esPrimeriza && ultimoCelo) {
        fechaPrioridad = new Date(ultimoCelo.getTime() + CICLO_CELO_DIAS * 86400000);
      } else if (esPrimeriza) {
        fechaPrioridad = null as unknown as Date; // sin dato
      } else {
        fechaPrioridad = today;
      }

      const fechaRecomendada = lastWeaning
        ? new Date(lastWeaning.getTime() + 5 * 86400000).toISOString().slice(0, 10)
        : today.toISOString().slice(0, 10);

      return {
        sowId:                        s.id,
        caravana:                     s.caravanaCode ?? s.identCode,
        ubicacion,
        galpon,
        estadoReproductivo:           ESTADO_LABEL[s.plantelState ?? ""] ?? "Disponible",
        plantelState:                 s.plantelState ?? "",
        diasDesdeDestete,
        ultimaFechaDestete:           lastWeaning ? lastWeaning.toISOString().slice(0, 10) : null,
        fechaRecomendadaInseminacion: fechaRecomendada,
        esPostDestete:                !!lastWeaning,
        currentParityCount:           s.currentParityCount,
        esPrimeriza,
        ultimoCeloFecha:              ultimoCelo ? ultimoCelo.toISOString().slice(0, 10) : null,
        fechaPrioridad:               fechaPrioridad ? fechaPrioridad.toISOString().slice(0, 10) : null,
        ultimoServicioFecha:          ultimoServicio ? ultimoServicio.toISOString().slice(0, 10) : null,
        totalPartos,
        badgeEstado,
        entryWeightKg:   s.entryWeightKg   != null ? Number(s.entryWeightKg)   : null,
        currentWeightKg: s.currentWeightKg != null ? Number(s.currentWeightKg) : null,
      };
    })
    .sort((a, b) => {
      if (a.fechaPrioridad === null && b.fechaPrioridad === null) return a.caravana.localeCompare(b.caravana);
      if (a.fechaPrioridad === null) return 1;
      if (b.fechaPrioridad === null) return -1;
      const cmp = a.fechaPrioridad.localeCompare(b.fechaPrioridad);
      return cmp !== 0 ? cmp : a.caravana.localeCompare(b.caravana);
    });

  return NextResponse.json(disponibles);
}
