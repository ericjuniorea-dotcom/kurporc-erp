import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { addDays } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenantId = session.user.tenantId;

  const batches = await prisma.serviceBatch.findMany({
    where: { tenantId },
    orderBy: { weekLabel: "desc" },
    take: 20,
    include: {
      serviceEvents: {
        include: {
          sow: { select: { identCode: true } },
          farrowing: {
            select: { id: true, startDatetime: true, bornAlive: true, bornDead: true },
          },
          pregnancyChecks: {
            orderBy: { checkDate: "desc" },
            take: 1,
            select: { result: true, checkDate: true },
          },
          semenDose: { select: { doseCode: true } },
        },
      },
    },
  });

  // ── Enriquecer con nombre de usuario y datos de repetición de celo ─
  const allSowIds     = Array.from(new Set(batches.flatMap(b => b.serviceEvents.map(e => e.sowId))));
  const allEmployeeIds = Array.from(new Set(
    batches.flatMap(b => b.serviceEvents.map(e => e.employeeId).filter(Boolean)),
  )) as string[];

  // Nombres de usuario
  const users = allEmployeeIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: allEmployeeIds } },
        select: { id: true, name: true },
      })
    : [];
  const userMap = new Map(users.map(u => [u.id, u.name]));

  // HeatRepeats para saber qué servicios "fallaron" y cuáles son repeticiones
  const allEventIds    = batches.flatMap(b => b.serviceEvents.map(e => e.id));
  const allHeatRepeats = allSowIds.length > 0
    ? await prisma.heatRepeat.findMany({
        where: { tenantId, sowId: { in: allSowIds } },
        select: { sowId: true, serviceEventId: true, repeatDate: true },
      })
    : [];

  const repeatCountByEvent = new Map<string, number>();
  const totalRepeatsBySow  = new Map<string, number>();
  const repeatDatesBySow   = new Map<string, Date[]>();
  for (const hr of allHeatRepeats) {
    if (hr.serviceEventId) {
      repeatCountByEvent.set(hr.serviceEventId, (repeatCountByEvent.get(hr.serviceEventId) ?? 0) + 1);
    }
    totalRepeatsBySow.set(hr.sowId, (totalRepeatsBySow.get(hr.sowId) ?? 0) + 1);
    if (!repeatDatesBySow.has(hr.sowId)) repeatDatesBySow.set(hr.sowId, []);
    repeatDatesBySow.get(hr.sowId)!.push(new Date(hr.repeatDate));
  }

  // Servicio más reciente por cerda (para detectar si hay uno posterior)
  const allServices = allSowIds.length > 0
    ? await prisma.serviceEvent.findMany({
        where: { tenantId, sowId: { in: allSowIds } },
        select: { id: true, sowId: true, serviceDate: true, serviceBatch: { select: { weekLabel: true } } },
        orderBy: { serviceDate: "desc" },
      })
    : [];

  const latestServiceBySow = new Map<string, { id: string; weekLabel: string }>();
  for (const s of allServices) {
    if (!latestServiceBySow.has(s.sowId)) {
      latestServiceBySow.set(s.sowId, { id: s.id, weekLabel: s.serviceBatch.weekLabel });
    }
  }

  // ── Estadísticas por lote ─────────────────────────────────────────
  const result = batches.map((batch) => {
    const total     = batch.serviceEvents.length;
    const confirmed = batch.serviceEvents.filter((e) => e.farrowing).length;
    const rate      = total > 0 ? Math.round((confirmed / total) * 100) : 0;

    const events = batch.serviceEvents.map((e) => {
      const projectedFarrowingDate = addDays(new Date(e.serviceDate), 114);
      const isOverdue              = !e.farrowing && new Date() > projectedFarrowingDate;

      const heatRepeatCount  = repeatCountByEvent.get(e.id) ?? 0;
      const totalHeatRepeats = totalRepeatsBySow.get(e.sowId) ?? 0;

      const latestSvc             = latestServiceBySow.get(e.sowId);
      const hasSubsequentService  = !!latestSvc && latestSvc.id !== e.id;
      const subsequentBatchLabel  = hasSubsequentService ? latestSvc!.weekLabel : null;

      const eventDate   = new Date(e.serviceDate);
      const repeatDates = repeatDatesBySow.get(e.sowId) ?? [];
      const isRepeatService = repeatDates.some(
        rd => Math.abs(rd.getTime() - eventDate.getTime()) < 2 * 24 * 60 * 60 * 1000,
      );

      // Servicios del mismo ciclo (para mostrar "inseminación N° X")
      // Todos los servicios de esta cerda en este lote (misma semana)
      const siblingCount = batch.serviceEvents.filter(s => s.sowId === e.sowId).length;

      return {
        id:                    e.id,
        sowId:                 e.sowId,
        sowCode:               e.sow.identCode,
        serviceDate:           e.serviceDate,
        serviceType:           e.serviceType,
        durationMinutes:       e.durationMinutes ?? null,
        doseCode:              e.semenDose?.doseCode ?? null,
        employeeName:          e.employeeId ? (userMap.get(e.employeeId) ?? null) : null,
        projectedFarrowingDate,
        hasConfirmedFarrowing: !!e.farrowing,
        farrowingDate:         e.farrowing?.startDatetime ?? null,
        bornAlive:             e.farrowing?.bornAlive     ?? null,
        lastPregnancyCheck:    e.pregnancyChecks[0]       ?? null,
        isOverdue,
        heatRepeatCount,
        totalHeatRepeats,
        hasSubsequentService,
        subsequentBatchLabel,
        isRepeatService,
        siblingCount,
      };
    });

    return {
      id:              batch.id,
      weekLabel:       batch.weekLabel,
      totalServiced:   total,
      confirmedBirths: confirmed,
      paritionRate:    rate,
      events,
    };
  });

  return NextResponse.json(result);
}
