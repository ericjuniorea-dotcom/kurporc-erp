import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { completeHealthTaskSchema } from "@/lib/validations/sanidad";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = [1, 2, 4, 5, 10, 12, 13];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = completeHealthTaskSchema.safeParse({ ...body, healthTaskId: params.id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const {
    applicationDate, quantityApplied, ageAtApplicationDays,
    productLot, productExpiry, medicineStockId, notes,
  } = parsed.data;

  const tenantId = session.user.tenantId;

  const task = await prisma.healthTask.findFirst({
    where:   { id: params.id, tenantId },
    include: {
      protocolTask: { include: { medicine: { select: { withdrawalDays: true } } } },
      farrowing:    { select: { id: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
  if (task.isCompleted) return NextResponse.json({ error: "Tarea ya completada" }, { status: 409 });

  const completion = await prisma.$transaction(async (tx) => {
    const c = await tx.healthTaskCompletion.create({
      data: {
        healthTaskId:         params.id,
        applicationDate:      new Date(applicationDate),
        ageAtApplicationDays: ageAtApplicationDays ?? undefined,
        quantityApplied,
        productLot:           productLot    ?? undefined,
        productExpiry:        productExpiry ? new Date(productExpiry) : undefined,
        medicineStockId:      medicineStockId ?? undefined,
        employeeId:           session.user.id,
        notes:                notes         ?? undefined,
      },
    });

    await tx.healthTask.update({
      where: { id: params.id },
      data:  { isCompleted: true, completedAt: new Date() },
    });

    // Si el medicamento tiene período de retiro, crearlo automáticamente
    const withdrawalDays = task.protocolTask.medicine?.withdrawalDays ?? 0;
    if (withdrawalDays > 0 && task.farrowing) {
      const start = new Date(applicationDate);
      const end   = new Date(start);
      end.setDate(end.getDate() + withdrawalDays);
      await tx.withdrawalPeriod.create({
        data: {
          tenantId,
          farrowingId:   task.farrowing.id,
          medicineId:    task.protocolTask.medicineId!,
          withdrawalDays,
          startDate:     start,
          endDate:       end,
          isActive:      true,
        },
      });
    }

    return c;
  });

  // Resolver alerta de tarea vencida si existía
  await prisma.alert.updateMany({
    where: {
      tenantId,
      alertType:  "HEALTH_TASK_OVERDUE",
      entityId:   params.id,
      isResolved: false,
    },
    data: { isResolved: true, resolvedAt: new Date() },
  });

  return NextResponse.json(completion, { status: 201 });
}
