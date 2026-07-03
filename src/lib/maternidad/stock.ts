import prisma from "@/lib/db/prisma";

export interface SowStock {
  farrowingId:    string;
  sowId:          string;
  sowCode:        string;
  bornAlive:      number;
  received:       number;   // movimientos de entrada + nodriza
  donated:        number;   // movimientos de salida
  deaths:         number;
  weaned:         number;
  currentStock:   number;   // Regla 4: bornAlive + received - donated - deaths - weaned
  lactationDays:  number;
  expectedWeaningDate: Date;
  hasActiveWithdrawal: boolean;
}

// Calcula el stock en tiempo real de lechones para una cerda en maternidad.
// REGLA 4: stock = nacidos_vivos + recibidos - donados - muertos - destetados
// Si currentStock < 0 → debe bloquearse en el llamador.
export async function calculateSowStock(farrowingId: string): Promise<SowStock> {
  const farrowing = await prisma.farrowingEvent.findUniqueOrThrow({
    where: { id: farrowingId },
    include: {
      sow:    { select: { id: true, identCode: true } },
      deaths: { select: { quantity: true } },
      movementsAsDestination: { select: { quantity: true } }, // recibidos
      movementsAsOrigin:      { select: { quantity: true } }, // donados
      fosterAsReceiver: {
        include: { donations: { select: { quantity: true } } },
      },
      weaning: { select: { pigletsWeaned: true, weaningDate: true } },
    },
  });

  const received =
    farrowing.movementsAsDestination.reduce((s, m) => s + m.quantity, 0) +
    farrowing.fosterAsReceiver.reduce(
      (s, fe) => s + fe.donations.reduce((ds, d) => ds + d.quantity, 0),
      0
    );

  const donated =
    farrowing.movementsAsOrigin.reduce((s, m) => s + m.quantity, 0);

  const deaths = farrowing.deaths.reduce((s, d) => s + d.quantity, 0);
  const weaned = farrowing.weaning?.pigletsWeaned ?? 0;

  const currentStock = farrowing.bornAlive + received - donated - deaths - weaned;

  const startDate    = new Date(farrowing.startDatetime);
  const today        = new Date();
  const lactationDays = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const expectedWeaningDate = new Date(startDate);
  expectedWeaningDate.setDate(expectedWeaningDate.getDate() + 21);

  // Verificar período de retiro activo
  const activeWithdrawal = await prisma.withdrawalPeriod.findFirst({
    where: {
      farrowingId,
      isActive: true,
      endDate:  { gte: today },
    },
  });

  return {
    farrowingId,
    sowId:              farrowing.sowId,
    sowCode:            farrowing.sow.identCode,
    bornAlive:          farrowing.bornAlive,
    received,
    donated,
    deaths,
    weaned,
    currentStock,
    lactationDays,
    expectedWeaningDate,
    hasActiveWithdrawal: !!activeWithdrawal,
  };
}

// Genera las tareas sanitarias del protocolo al registrar un parto.
export async function generateHealthTasks(
  tenantId:   string,
  farrowingId: string,
  farrowingDate: Date
): Promise<void> {
  const config = await prisma.healthProtocolConfig.findUnique({
    where:   { tenantId },
    include: { vaccinationTasks: { where: { isActive: true } } },
  });

  if (!config) return;

  const tasks: { protocolTaskId: string; dueDate: Date }[] = [];

  // Procedimientos de lechones (col, dientes, castración, hierro)
  const procedureTasks = await prisma.healthProtocolTask.findMany({
    where: {
      protocolId: config.id,
      taskType:   { in: ["TAIL_DOCKING","TOOTH_CLIPPING","CASTRATION","IRON_INJECTION"] },
      isActive:   true,
    },
  });

  for (const task of [...procedureTasks, ...config.vaccinationTasks]) {
    const dueDate = new Date(farrowingDate);
    dueDate.setDate(dueDate.getDate() + task.dayOfLife);
    tasks.push({ protocolTaskId: task.id, dueDate });
  }

  if (tasks.length === 0) return;

  await prisma.healthTask.createMany({
    data: tasks.map((t) => ({
      tenantId,
      farrowingId,
      protocolTaskId: t.protocolTaskId,
      dueDate:        t.dueDate,
    })),
    skipDuplicates: true,
  });
}

// Crea alertas estándar al registrar un parto fuera de rango.
export async function checkFarrowingAlerts(
  tenantId:   string,
  farrowingId: string,
  data: {
    gestationDays?:     number | null;
    durationMinutes?:   number | null;
    avgPigletWeightKg?: number | null;
  }
): Promise<void> {
  const alerts: {
    alertType: string;
    severity:  string;
    title:     string;
    body:      string;
  }[] = [];

  if (data.gestationDays != null &&
      (data.gestationDays < 110 || data.gestationDays > 118)) {
    alerts.push({
      alertType: "GESTATION_DAYS_OUT_OF_RANGE",
      severity:  "WARNING",
      title:     "Gestación fuera de rango",
      body:      `Días de gestación: ${data.gestationDays}. El rango normal es 110–118 días.`,
    });
  }

  if (data.durationMinutes != null && data.durationMinutes > 240) {
    alerts.push({
      alertType: "FARROWING_LONG_DURATION",
      severity:  "CRITICAL",
      title:     "Parto prolongado (posible distocia)",
      body:      `Duración: ${Math.round(data.durationMinutes / 60)}h ${data.durationMinutes % 60}min. Supera las 4 horas.`,
    });
  }

  if (data.avgPigletWeightKg != null && data.avgPigletWeightKg < 1.10) {
    alerts.push({
      alertType: "LOW_BIRTH_WEIGHT",
      severity:  "WARNING",
      title:     "Bajo peso al nacimiento",
      body:      `Peso medio: ${data.avgPigletWeightKg.toFixed(2)} kg. El mínimo recomendado es 1,10 kg.`,
    });
  }

  if (alerts.length === 0) return;

  await prisma.alert.createMany({
    data: alerts.map((a) => ({
      tenantId,
      alertType:  a.alertType as any,
      severity:   a.severity  as any,
      title:      a.title,
      body:       a.body,
      entityId:   farrowingId,
      entityType: "FARROWING",
    })),
  });
}
