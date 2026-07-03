import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { serviceEventSchema } from "@/lib/validations/gestacion";
import { isoWeekLabel, addDays } from "@/lib/utils";
import { generarTareasServicio } from "@/lib/tasks/generate";
import { generarEventosServicio } from "@/lib/sanidad/generate-eventos";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const sowId   = searchParams.get("sowId");
  const batchId = searchParams.get("batchId");

  const events = await prisma.serviceEvent.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(sowId   ? { sowId }                     : {}),
      ...(batchId ? { serviceBatchId: batchId }   : {}),
    },
    include: {
      sow:          { select: { identCode: true } },
      serviceBatch: { select: { weekLabel: true } },
      semenDose:    { select: { doseCode: true, expiryDate: true } },
      farrowing:    { select: { id: true, startDatetime: true, bornAlive: true } },
      pregnancyChecks: {
        orderBy: { checkDate: "desc" },
        take: 1,
      },
    },
    orderBy: { serviceDate: "desc" },
    take: 200,
  });

  // Enriquecer con nombre del usuario que inseminó
  const userIds = Array.from(new Set(events.map(e => e.employeeId).filter(Boolean))) as string[];
  const users = userIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const userMap = new Map(users.map(u => [u.id, u.name]));

  const result = events.map(e => ({
    ...e,
    employeeName:    e.employeeId ? (userMap.get(e.employeeId) ?? null) : null,
    durationMinutes: e.durationMinutes ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = [1, 2, 3, 4, 5, 11, 13];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = serviceEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    sowId, serviceDate, serviceType, boarCode, doseCode,
    elaborationDate, expiryDate, durationMinutes, notes,
  } = parsed.data;
  const tenantId = session.user.tenantId;
  const date     = new Date(serviceDate);

  // ── Verificar elegibilidad de la cerda ────────────────────────────
  const [sowData, requisitosConfig, vacunasRequeridas] = await Promise.all([
    prisma.sow.findFirst({
      where: { id: sowId, tenantId },
      select: { identCode: true, plantelState: true, entryWeightKg: true, entryDate: true, birthDate: true },
    }),
    prisma.configProceso.findUnique({
      where: { tenantId_modulo_procesoKey: { tenantId, modulo: "GESTACION", procesoKey: "requisitos_servicio" } },
    }),
    prisma.configVacuna.findMany({
      where: { tenantId, obligatoria: true, activa: true, modulo: { in: ["GESTACION", "ALL"] } },
      select: { id: true, nombreVacuna: true, diasEsperaServicio: true, refuerzoDias: true },
    }),
  ]);

  if (sowData) {
    const blockMessages: string[] = [];
    const reqValor = (requisitosConfig?.valor as Record<string, unknown>) ?? {};

    if (sowData.plantelState === "QUARANTINE") {
      blockMessages.push("Esta cerda está en cuarentena.");
    }

    const pesoMinimo = Number(reqValor.peso_minimo_kg ?? 0);
    if (pesoMinimo > 0 && sowData.entryWeightKg !== null && sowData.entryWeightKg !== undefined) {
      if (Number(sowData.entryWeightKg) < pesoMinimo) {
        blockMessages.push(`Peso insuficiente: ${Number(sowData.entryWeightKg)} kg (mínimo ${pesoMinimo} kg).`);
      }
    }

    const diasMinimos = Number(reqValor.dias_minimos_previo_servicio ?? 0);
    if (diasMinimos > 0) {
      const refDate = sowData.birthDate ?? sowData.entryDate;
      const diasTranscurridos = Math.floor(
        (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diasTranscurridos < diasMinimos) {
        blockMessages.push(`Días insuficientes: ${diasTranscurridos} días (mínimo ${diasMinimos}).`);
      }
    }

    if (vacunasRequeridas.length > 0) {
      const vacunasReqFull = await prisma.configVacuna.findMany({
        where: { id: { in: vacunasRequeridas.map(v => v.id) } },
        select: { id: true, nombreVacuna: true, diasEsperaServicio: true, refuerzoDias: true },
      });
      const vacunasAplicadas = await prisma.animalEvent.findMany({
        where: { sowId, eventType: "VACCINATION" },
        orderBy: { eventDate: "desc" },
        select: { eventDate: true, metadata: true },
      });

      for (const vac of vacunasReqFull) {
        const aplic = vacunasAplicadas.find(e => {
          const meta = e.metadata as Record<string, unknown> | null;
          return meta?.configVacunaId === vac.id;
        });

        if (!aplic) {
          blockMessages.push(`Vacuna obligatoria no aplicada: ${vac.nombreVacuna}.`);
          continue;
        }

        // Verificar refuerzo vencido
        if (vac.refuerzoDias) {
          const vence = new Date(aplic.eventDate);
          vence.setDate(vence.getDate() + vac.refuerzoDias);
          if (vence < date) {
            blockMessages.push(`Vacuna vencida (refuerzo): ${vac.nombreVacuna} (venció ${vence.toLocaleDateString("es-PY")}).`);
            continue;
          }
        }

        // Verificar días de espera post-vacuna
        if (vac.diasEsperaServicio > 0) {
          const habilitadaDesde = new Date(aplic.eventDate);
          habilitadaDesde.setDate(habilitadaDesde.getDate() + vac.diasEsperaServicio);
          if (habilitadaDesde > date) {
            const diasFaltan = Math.ceil((habilitadaDesde.getTime() - date.getTime()) / 86400000);
            blockMessages.push(`En espera post-vacuna: ${vac.nombreVacuna} — faltan ${diasFaltan} día(s) para poder inseminar.`);
          }
        }
      }
    }

    if (blockMessages.length > 0) {
      return NextResponse.json(
        { error: `La cerda no cumple los requisitos para ser inseminada. ${blockMessages.join(" ")}` },
        { status: 422 },
      );
    }
  }

  // ── Leer configuración del protocolo de inseminación ─────────────
  const procesoConfig = await prisma.configProceso.findUnique({
    where: { tenantId_modulo_procesoKey: { tenantId, modulo: "GESTACION", procesoKey: "protocolo_inseminacion" } },
  });
  const procesoValor = (procesoConfig?.valor as Record<string, unknown>) ?? {};
  const inseminacionesPorCiclo = Number(procesoValor.inseminaciones_por_ciclo ?? 3);
  const intervaloHoras         = Number(procesoValor.intervalo_horas ?? 12);

  // Ventana del ciclo completo: (n-1) dosis × intervalo + 50% buffer
  const cicloWindowMs = (inseminacionesPorCiclo - 1) * intervaloHoras * 60 * 60 * 1000 * 1.5;
  const cicloStart    = new Date(date.getTime() - Math.max(cicloWindowMs, 12 * 60 * 60 * 1000));

  // Servicios previos de esta cerda dentro de la ventana del ciclo
  const serviciosEnCiclo = await prisma.serviceEvent.count({
    where: { tenantId, sowId, serviceDate: { gte: cicloStart } },
  });

  const esMismoCiclo = serviciosEnCiclo > 0;

  // ── REGLA 8: Alertar si la dosis está vencida ─────────────────────
  let doseExpiredAlert = false;
  if (expiryDate && new Date(expiryDate) < date) {
    doseExpiredAlert = true;
    await prisma.alert.create({
      data: {
        tenantId,
        alertType:  "SEMEN_DOSE_EXPIRED",
        severity:   "WARNING",
        title:      "Dosis de semen vencida",
        body:       `La dosis ${doseCode} venció el ${new Date(expiryDate).toLocaleDateString("es-PY")}. Verificar antes de continuar.`,
        entityId:   sowId,
        entityType: "SOW",
      },
    });
  }

  // ── Repetición de celo: solo si NO estamos en el mismo ciclo ──────
  let heatRepeatAlert    = false;
  let previousServiceDate: Date | null = null;
  let previousEventId: string | null   = null;

  if (!esMismoCiclo) {
    const recentService = await prisma.serviceEvent.findFirst({
      where: {
        tenantId,
        sowId,
        serviceDate: { gte: addDays(date, -60) },
        farrowing:   null,
      },
      include: {
        pregnancyChecks: { orderBy: { checkDate: "desc" }, take: 1 },
      },
      orderBy: { serviceDate: "desc" },
    });

    if (recentService) {
      const confirmedPregnant = recentService.pregnancyChecks[0]?.result === "PREGNANT";
      if (!confirmedPregnant) {
        heatRepeatAlert      = true;
        previousServiceDate  = recentService.serviceDate;
        previousEventId      = recentService.id;
      }
    }
  }

  // ── Obtener o crear el lote de servicio ───────────────────────────
  const weekLabel    = isoWeekLabel(date);
  const serviceBatch = await prisma.serviceBatch.upsert({
    where:  { tenantId_weekLabel: { tenantId, weekLabel } },
    update: {},
    create: { tenantId, weekLabel },
  });

  // ── Resolver reproductor / dosis ──────────────────────────────────
  let boarId:      string | undefined;
  let semenDoseId: string | undefined;

  if (serviceType === "NATURAL_MOUNT" && boarCode) {
    const boar = await prisma.boar.upsert({
      where:  { tenantId_identCode: { tenantId, identCode: boarCode } },
      update: {},
      create: { tenantId, identCode: boarCode },
    });
    boarId = boar.id;
  }

  if (serviceType === "AI" && doseCode) {
    const dose = await prisma.semenDose.create({
      data: {
        tenantId,
        doseCode,
        elaborationDate: elaborationDate ? new Date(elaborationDate) : date,
        expiryDate:      expiryDate      ? new Date(expiryDate)      : addDays(date, 60),
        boarId: boarId ?? undefined,
      },
    });
    semenDoseId = dose.id;
  }

  // ── Crear el evento de servicio ───────────────────────────────────
  const event = await prisma.serviceEvent.create({
    data: {
      tenantId,
      sowId,
      serviceBatchId:  serviceBatch.id,
      serviceDate:     date,
      serviceType:     serviceType as "AI" | "NATURAL_MOUNT",
      boarId,
      semenDoseId,
      durationMinutes: durationMinutes ?? undefined,
      employeeId:      session.user.id,
      notes,
    },
    include: {
      sow:          { select: { identCode: true } },
      serviceBatch: { select: { weekLabel: true } },
    },
  });

  // ── Registrar repetición + verificar umbral ───────────────────────
  if (heatRepeatAlert) {
    await prisma.heatRepeat.create({
      data: {
        tenantId,
        sowId,
        serviceEventId: previousEventId ?? undefined,
        repeatDate:     date,
        cause:          "Nuevo servicio sin parto previo confirmado",
        employeeId:     session.user.id ?? undefined,
      },
    });

    const totalRepeticiones = await prisma.heatRepeat.count({ where: { tenantId, sowId } });
    const alertaConfig = await prisma.configAlerta.findUnique({
      where: { tenantId_modulo_eventoKey: { tenantId, modulo: "GESTACION", eventoKey: "repeticiones_celo_descarte" } },
    });
    const umbral = alertaConfig?.umbral ? Number(alertaConfig.umbral) : 4;

    if (totalRepeticiones >= umbral) {
      const sow = await prisma.sow.findUnique({ where: { id: sowId }, select: { identCode: true } });
      await prisma.alert.create({
        data: {
          tenantId,
          alertType:  "HEAT_REPEAT_DISCARD",
          severity:   "WARNING",
          title:      "Cerda con repeticiones de celo excesivas",
          body:       `La cerda ${sow?.identCode ?? sowId} acumula ${totalRepeticiones} repeticiones de celo (umbral: ${umbral}). Evaluar descarte.`,
          entityId:   sowId,
          entityType: "SOW",
        },
      });
    }
  }

  // Actualizar estado de la cerda a MATED (en servicio activo)
  await prisma.sow.update({
    where: { id: sowId },
    data:  { plantelState: "MATED" },
  }).catch(() => {});

  // Generar órdenes de trabajo automáticas (diagnóstico preñez + parto esperado)
  await Promise.all([
    generarTareasServicio(tenantId, event.id, date, `Cerda ${event.sow.identCode}`, sowId).catch(() => {}),
    generarEventosServicio(tenantId, event.id, date, `Cerda ${event.sow.identCode}`, sowId).catch(() => {}),
  ]);

  return NextResponse.json(
    {
      event,
      doseExpiredAlert,
      heatRepeatAlert,
      previousServiceDate: previousServiceDate?.toISOString() ?? null,
      cicloInfo: {
        numeroInseminacion: serviciosEnCiclo + 1,
        total:              inseminacionesPorCiclo,
        esMismoCiclo,
      },
    },
    { status: 201 },
  );
}
