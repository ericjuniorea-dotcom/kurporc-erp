import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { farrowingEventSchema } from "@/lib/validations/maternidad";
import { generateHealthTasks, checkFarrowingAlerts } from "@/lib/maternidad/stock";
import { generarTareasParto } from "@/lib/tasks/generate";
import { generarEventosParto } from "@/lib/sanidad/generate-eventos";
import { addDays, diffDays } from "@/lib/utils";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";

import { idsCamadasAbiertas } from "@/lib/maternidad/camadas";
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["maternidad.partos.ver", "maternidad.lechones.ver", "maternidad.destetes.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const onlyActive = searchParams.get("active") !== "false";
  const sowId      = searchParams.get("sowId");

  const farrowings = await prisma.farrowingEvent.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(sowId ? { sowId } : {}),
      ...(onlyActive ? { id: { in: await idsCamadasAbiertas(session.user.tenantId) } } : {}),
    },
    include: {
      sow:    { select: { id: true, identCode: true, currentParityCount: true } },
      pen:    { select: { number: true, location: { select: { name: true } } } },
      deaths: { select: { quantity: true } },
      movementsAsDestination: { select: { quantity: true } },
      movementsAsOrigin:      { select: { quantity: true } },
      fosterAsReceiver: { include: { donations: { select: { quantity: true } } } },
      weaning:     { select: { weaningDate: true, pigletsWeaned: true } },
      healthTasks: {
        where: { isCompleted: false },
        orderBy: { dueDate: "asc" },
        take: 3,
        include: { protocolTask: { select: { taskName: true, taskType: true } } },
      },
      withdrawalPeriods: {
        where: { isActive: true, endDate: { gte: new Date() } },
        select: { endDate: true, medicine: { select: { name: true } } },
      },
    },
    orderBy: { startDatetime: "desc" },
    take: 100,
  });

  // Calcular stock dinámico inline (evita N+1 — ya tenemos los datos)
  const result = farrowings.map((f) => {
    const received =
      f.movementsAsDestination.reduce((s, m) => s + m.quantity, 0) +
      f.fosterAsReceiver.reduce(
        (s, fe) => s + fe.donations.reduce((ds, d) => ds + d.quantity, 0), 0
      );
    const donated  = f.movementsAsOrigin.reduce((s, m) => s + m.quantity, 0);
    const deaths   = f.deaths.reduce((s, d) => s + d.quantity, 0);
    const weaned   = f.weaning?.pigletsWeaned ?? 0;
    const stock    = f.bornAlive + received - donated - deaths - weaned;

    const today    = new Date();
    const startDate = new Date(f.startDatetime);
    return {
      ...f,
      currentStock:        stock,
      lactationDays:       diffDays(startDate, today),
      expectedWeaningDate: addDays(startDate, 21),
      hasActiveWithdrawal: f.withdrawalPeriods.length > 0,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), "maternidad.partos.crear")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = farrowingEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;
  const tenantId   = session.user.tenantId;
  const startDate  = new Date(d.startDatetime);
  const endDate    = d.endDatetime ? new Date(d.endDatetime) : null;
  const totalBorn  = d.bornAlive + d.bornDead + d.mummified;

  // Calcular días de gestación si hay servicio vinculado
  let gestationDays: number | null = null;
  if (d.serviceEventId) {
    const svc = await prisma.serviceEvent.findUnique({
      where: { id: d.serviceEventId },
      select: { serviceDate: true },
    });
    if (svc) gestationDays = diffDays(new Date(svc.serviceDate), startDate);
  }

  const durationMinutes = endDate
    ? Math.round((endDate.getTime() - startDate.getTime()) / 60000)
    : null;

  const avgPigletWeightKg =
    d.bornAlive > 0
      ? Math.round((d.totalLitterWeightKg / d.bornAlive) * 1000) / 1000
      : null;

  const farrowing = await prisma.$transaction(async (tx) => {
    const f = await tx.farrowingEvent.create({
      data: {
        tenantId,
        sowId:               d.sowId,
        serviceEventId:      d.serviceEventId ?? undefined,
        farrowingType:       d.farrowingType,
        startDatetime:       startDate,
        endDatetime:         endDate ?? undefined,
        gestationDays,
        durationMinutes,
        bornAlive:           d.bornAlive,
        bornDead:            d.bornDead,
        mummified:           d.mummified,
        totalBorn,
        femalesBornAlive:    d.femalesBornAlive ?? undefined,
        malesBornAlive:      d.malesBornAlive   ?? undefined,
        lowViabilityCount:   d.lowViabilityCount,
        totalLitterWeightKg: d.totalLitterWeightKg,
        avgPigletWeightKg:   avgPigletWeightKg  ?? undefined,
        penId:               d.penId             ?? undefined,
        sowWeightKg:         d.sowWeightKg       ?? undefined,
        employeeId:          session.user.id,
        notes:               d.notes             ?? undefined,
      },
    });

    // Incrementar contador de partos y pasar la cerda a "Lactante" —
    // debe reflejarse de inmediato en Plantel Reproductivo (bug: quedaba
    // en "Gestante" porque nada actualizaba plantelState al parir).
    await tx.sow.update({
      where: { id: d.sowId },
      data:  { currentParityCount: { increment: 1 }, plantelState: "LACTATING" },
    });

    return f;
  });

  // Post-create: generar tareas sanitarias, alertas y órdenes de trabajo
  const sowForTask = await prisma.sow.findUnique({ where: { id: d.sowId }, select: { identCode: true } });
  await Promise.all([
    generateHealthTasks(tenantId, farrowing.id, startDate),
    checkFarrowingAlerts(tenantId, farrowing.id, {
      gestationDays,
      durationMinutes,
      avgPigletWeightKg,
    }),
    generarTareasParto(tenantId, farrowing.id, startDate, `Cerda ${sowForTask?.identCode ?? d.sowId}`),
    generarEventosParto(tenantId, farrowing.id, startDate, `Cerda ${sowForTask?.identCode ?? d.sowId}`, d.bornAlive, d.sowId).catch(() => {}),
  ]);

  return NextResponse.json(farrowing, { status: 201 });
}
