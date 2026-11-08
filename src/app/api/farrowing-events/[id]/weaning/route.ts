import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { weaningEventSchema } from "@/lib/validations/maternidad";
import { calculateSowStock } from "@/lib/maternidad/stock";
import { diffDays, isoWeekLabel } from "@/lib/utils";
import { generarTareasNurseryBatch } from "@/lib/tasks/generate";
import { generarEventosNursery } from "@/lib/sanidad/generate-eventos";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), "maternidad.destetes.crear")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = weaningEventSchema.safeParse({ ...body, farrowingId: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d        = parsed.data;
  const tenantId = session.user.tenantId;

  const farrowing = await prisma.farrowingEvent.findFirst({
    where: { id: params.id, tenantId },
    select: { startDatetime: true, sowId: true, weaning: { select: { id: true } } },
  });

  if (!farrowing) return NextResponse.json({ error: "Parto no encontrado" }, { status: 404 });
  if (farrowing.weaning) return NextResponse.json({ error: "Este parto ya tiene un destete registrado" }, { status: 409 });

  // REGLA 5: Bloquear si hay período de retiro activo
  const weaningDate = new Date(d.weaningDate);
  const activeWithdrawal = await prisma.withdrawalPeriod.findFirst({
    where: {
      farrowingId: params.id,
      isActive:    true,
      endDate:     { gte: weaningDate },
    },
    include: { medicine: { select: { name: true } } },
  });

  if (activeWithdrawal) {
    return NextResponse.json(
      {
        error: `BLOQUEO: Período de retiro activo para ${activeWithdrawal.medicine.name}. El período vence el ${activeWithdrawal.endDate.toLocaleDateString("es-PY")}. No se puede destetar hasta esa fecha.`,
        blockedUntil: activeWithdrawal.endDate,
      },
      { status: 422 }
    );
  }

  // Calcular stock disponible incluyendo movimientos de último momento
  const stock = await calculateSowStock(params.id);
  const pigletsAvailable =
    stock.currentStock + d.lastMinuteReceived - d.lastMinuteDonated - d.lastMinuteDeaths;

  // REGLA 4: Destetados no puede superar disponibles
  if (d.pigletsWeaned > pigletsAvailable) {
    return NextResponse.json(
      {
        error: `Los lechones destetados (${d.pigletsWeaned}) superan los disponibles (${pigletsAvailable}).`,
        pigletsAvailable,
      },
      { status: 422 }
    );
  }

  const lactationDays  = diffDays(new Date(farrowing.startDatetime), weaningDate);
  const avgPigletWeightKg = d.pigletsWeaned > 0
    ? Math.round((d.totalLitterWeightKg / d.pigletsWeaned) * 1000) / 1000
    : 0;

  // Auto-crear lote de recría Fase 1 para la semana del destete
  const batchCode = `REC-${isoWeekLabel(weaningDate)}`;
  const nurseryBatch = await prisma.nurseryBatch.upsert({
    where:  { tenantId_batchCode: { tenantId, batchCode } },
    update: { currentCount: { increment: d.pigletsWeaned } },
    create: {
      tenantId,
      batchCode,
      phase:        "PHASE_1",
      entryDate:    weaningDate,
      currentCount: d.pigletsWeaned,
    },
  });

  const weaning = await prisma.weaningEvent.create({
    data: {
      tenantId,
      farrowingId:         params.id,
      weaningDate,
      lactationDays,
      pigletsAvailable,
      lastMinuteDeaths:    d.lastMinuteDeaths,
      lastMinuteReceived:  d.lastMinuteReceived,
      lastMinuteDonated:   d.lastMinuteDonated,
      pigletsWeaned:       d.pigletsWeaned,
      totalLitterWeightKg: d.totalLitterWeightKg,
      avgPigletWeightKg,
      nurseryBatchId:      nurseryBatch.id,
      sowDestination:      d.sowDestination   as any,
      bodyConditionScore:  d.bodyConditionScore as any ?? undefined,
      sowWeightKg:         d.sowWeightKg      ?? undefined,
      employeeId:          session.user.id,
      notes:               d.notes            ?? undefined,
    },
  });

  // Generar tareas de iniciación para el lote (si es nuevo)
  const isNewBatch = nurseryBatch.currentCount === d.pigletsWeaned;
  if (isNewBatch) {
    generarTareasNurseryBatch(tenantId, nurseryBatch.id, batchCode, weaningDate).catch(() => {});
    generarEventosNursery(tenantId, nurseryBatch.id, batchCode, weaningDate, d.pigletsWeaned).catch(() => {});
  }

  // La cerda sale de "Lactante" al destetar — debe reflejarse de inmediato
  // en Plantel Reproductivo (mismo bug de sincronización que en el parto).
  await prisma.sow.update({
    where: { id: farrowing.sowId },
    data:  { plantelState: d.sowDestination === "CULL" ? "CULLED" : "EMPTY" },
  }).catch(() => {});

  return NextResponse.json({ weaning, nurseryBatch, lactationDays, avgPigletWeightKg }, { status: 201 });
}
