import prisma from "@/lib/db/prisma";
import { isoWeekLabel, addDays } from "@/lib/utils";
import { generarTareasServicio } from "@/lib/tasks/generate";
import { generarEventosServicio } from "@/lib/sanidad/generate-eventos";
import { ROLES } from "@/lib/auth/config";

// Roles autorizados a forzar una inseminación aunque la cerda no cumpla
// los requisitos de elegibilidad (ej. vacunas pendientes). El resto de los
// roles queda bloqueado sin excepción.
export const FORCE_OVERRIDE_ROLES: number[] = [ROLES.SUPER_ADMIN, ROLES.FARM_ADMIN, ROLES.VET_CHIEF];

export interface CreateServiceEventInput {
  sowId:            string;
  serviceDate:      string;
  serviceType:      "AI" | "NATURAL_MOUNT";
  boarCode?:        string;
  doseCode?:        string;
  elaborationDate?: string;
  expiryDate?:      string;
  durationMinutes?: number;
  notes?:           string;
  currentWeightKg?: number;
}

export type CreateServiceEventResult =
  | {
      ok: true;
      event: unknown;
      doseExpiredAlert: boolean;
      heatRepeatAlert: boolean;
      previousServiceDate: string | null;
      cicloInfo: { numeroInseminacion: number; total: number; esMismoCiclo: boolean };
      warnings: string[];
    }
  | { ok: false; error: string };

/**
 * Registra el servicio de UNA cerda. Extraído de la lógica que antes vivía
 * directo en POST /api/service-events para poder reutilizarla tanto para el
 * registro individual como para la creación de un lote (varias cerdas, un
 * único ServiceBatch explícito pasado en opts.serviceBatchId).
 *
 * Si opts.serviceBatchId no viene, se mantiene el comportamiento histórico:
 * agrupar por semana ISO — pero solo reutilizando batches SIN código (los
 * lotes con nombre explícito nunca se mezclan con el auto-agrupado semanal).
 *
 * opts.forceOverride permite continuar aunque la cerda no cumpla los
 * requisitos de elegibilidad (ej. vacunas pendientes). El caller es
 * responsable de verificar que el usuario tenga el rol autorizado para esto
 * ANTES de pasar forceOverride: true — esta función no vuelve a chequear
 * permisos, solo aplica la lógica y deja registro del bypass.
 */
export async function createServiceEventForSow(
  tenantId: string,
  userId: string,
  input: CreateServiceEventInput,
  opts?: { serviceBatchId?: string; forceOverride?: boolean },
): Promise<CreateServiceEventResult> {
  const {
    sowId, serviceDate, serviceType, boarCode, doseCode,
    elaborationDate, expiryDate, durationMinutes, notes, currentWeightKg,
  } = input;
  const date = new Date(serviceDate);

  // ── Verificar elegibilidad de la cerda ────────────────────────────
  const [sowData, requisitosConfig, vacunasRequeridas] = await Promise.all([
    prisma.sow.findFirst({
      where: { id: sowId, tenantId },
      select: { identCode: true, plantelState: true, entryWeightKg: true, currentWeightKg: true, entryDate: true, birthDate: true },
    }),
    prisma.configProceso.findUnique({
      where: { tenantId_modulo_procesoKey: { tenantId, modulo: "GESTACION", procesoKey: "requisitos_servicio" } },
    }),
    // diaGestacion: null excluye las vacunas de protocolo de gestación (Rhiniseng,
    // Suiseng, Porcilis Glässer, etc.) — se aplican durante una preñez ya en curso
    // (día 60-95), nunca antes de un servicio nuevo, así que no pueden bloquearlo.
    prisma.configVacuna.findMany({
      where: { tenantId, obligatoria: true, activa: true, diaGestacion: null, modulo: { in: ["GESTACION", "ALL"] } },
      select: { id: true, nombreVacuna: true, diasEsperaServicio: true, refuerzoDias: true },
    }),
  ]);

  const blockMessages: string[] = [];
  if (sowData) {
    const reqValor = (requisitosConfig?.valor as Record<string, unknown>) ?? {};

    if (sowData.plantelState === "QUARANTINE") {
      blockMessages.push("Esta cerda está en cuarentena.");
    }

    // Preferí el peso recién cargado en este mismo formulario (siempre al día);
    // si no vino, caé al último peso conocido — nunca al entryWeightKg fijo del
    // alta, que se vuelve obsoleto apenas la cerda engorda.
    const pesoParaChequeo = currentWeightKg ?? (sowData.currentWeightKg != null ? Number(sowData.currentWeightKg) : null)
      ?? (sowData.entryWeightKg != null ? Number(sowData.entryWeightKg) : null);
    const pesoMinimo = Number(reqValor.peso_minimo_kg ?? 0);
    if (pesoMinimo > 0 && pesoParaChequeo !== null) {
      if (pesoParaChequeo < pesoMinimo) {
        blockMessages.push(`Peso insuficiente: ${pesoParaChequeo} kg (mínimo ${pesoMinimo} kg).`);
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

        if (vac.refuerzoDias) {
          const vence = new Date(aplic.eventDate);
          vence.setDate(vence.getDate() + vac.refuerzoDias);
          if (vence < date) {
            blockMessages.push(`Vacuna vencida (refuerzo): ${vac.nombreVacuna} (venció ${vence.toLocaleDateString("es-PY")}).`);
            continue;
          }
        }

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

    if (blockMessages.length > 0 && !opts?.forceOverride) {
      return { ok: false, error: `La cerda no cumple los requisitos para ser inseminada. ${blockMessages.join(" ")}` };
    }
  }

  // ── Leer configuración del protocolo de inseminación ─────────────
  const procesoConfig = await prisma.configProceso.findUnique({
    where: { tenantId_modulo_procesoKey: { tenantId, modulo: "GESTACION", procesoKey: "protocolo_inseminacion" } },
  });
  const procesoValor = (procesoConfig?.valor as Record<string, unknown>) ?? {};
  const inseminacionesPorCiclo = Number(procesoValor.inseminaciones_por_ciclo ?? 3);
  const intervaloHoras         = Number(procesoValor.intervalo_horas ?? 12);

  const cicloWindowMs = (inseminacionesPorCiclo - 1) * intervaloHoras * 60 * 60 * 1000 * 1.5;
  const cicloStart    = new Date(date.getTime() - Math.max(cicloWindowMs, 12 * 60 * 60 * 1000));

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
  const weekLabel = isoWeekLabel(date);
  let serviceBatchId = opts?.serviceBatchId;
  if (!serviceBatchId) {
    // Auto-agrupado semanal: solo reutiliza batches SIN código (nunca se mezcla con un lote con nombre).
    const existing = await prisma.serviceBatch.findFirst({ where: { tenantId, weekLabel, code: null } });
    const serviceBatch = existing ?? await prisma.serviceBatch.create({ data: { tenantId, weekLabel } });
    serviceBatchId = serviceBatch.id;
  }

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
      serviceBatchId,
      serviceDate:     date,
      serviceType:     serviceType as "AI" | "NATURAL_MOUNT",
      boarId,
      semenDoseId,
      durationMinutes: durationMinutes ?? undefined,
      employeeId:      userId,
      notes,
    },
    include: {
      sow:          { select: { identCode: true } },
      serviceBatch: { select: { weekLabel: true, code: true } },
    },
  });

  // ── Dejar registro del bypass de elegibilidad (si se forzó) ───────
  if (blockMessages.length > 0) {
    await prisma.animalEvent.create({
      data: {
        tenantId,
        sowId,
        eventType:    "ELIGIBILITY_OVERRIDE",
        eventDate:    date,
        description:  `Inseminación forzada pese a: ${blockMessages.join(" ")}`,
        moduleSource: "GESTACION",
        userId,
        metadata:     { serviceEventId: event.id, blockMessages },
      },
    }).catch(() => {});
  }

  // ── Registrar repetición + verificar umbral ───────────────────────
  if (heatRepeatAlert) {
    await prisma.heatRepeat.create({
      data: {
        tenantId,
        sowId,
        serviceEventId: previousEventId ?? undefined,
        repeatDate:     date,
        cause:          "Nuevo servicio sin parto previo confirmado",
        employeeId:     userId ?? undefined,
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

  // Actualizar estado de la cerda a MATED (en servicio activo) y dejar
  // guardado el peso recién cargado, si vino, como el último peso conocido.
  await prisma.sow.update({
    where: { id: sowId },
    data:  { plantelState: "MATED", ...(currentWeightKg != null ? { currentWeightKg } : {}) },
  }).catch(() => {});

  // Generar órdenes de trabajo automáticas (diagnóstico preñez + parto esperado)
  await Promise.all([
    generarTareasServicio(tenantId, event.id, date, `Cerda ${event.sow.identCode}`, sowId).catch(() => {}),
    generarEventosServicio(tenantId, event.id, date, `Cerda ${event.sow.identCode}`, sowId).catch(() => {}),
  ]);

  return {
    ok: true,
    event,
    doseExpiredAlert,
    heatRepeatAlert,
    previousServiceDate: previousServiceDate?.toISOString() ?? null,
    cicloInfo: {
      numeroInseminacion: serviciosEnCiclo + 1,
      total:              inseminacionesPorCiclo,
      esMismoCiclo,
    },
    warnings: blockMessages,
  };
}
