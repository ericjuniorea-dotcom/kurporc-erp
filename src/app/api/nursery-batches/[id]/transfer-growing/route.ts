import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { transferToGrowingSchema } from "@/lib/validations/recria";

// Traslado de recría a engorde: crea un GrowingBatch y desactiva el NurseryBatch
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = [1, 2, 4, 5, 12];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = transferToGrowingSchema.safeParse({ ...body, nurseryBatchId: params.id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { entryDate, entryWeightKg, animalCount, penId, batchCode } = parsed.data;
  const tenantId = session.user.tenantId;

  const nurseryBatch = await prisma.nurseryBatch.findFirst({
    where: { id: params.id, tenantId, isActive: true },
  });
  if (!nurseryBatch) {
    return NextResponse.json({ error: "Lote de recría no encontrado o ya inactivo" }, { status: 404 });
  }

  // Verificar que el código de lote de engorde no exista
  const codeExists = await prisma.growingBatch.findUnique({
    where: { tenantId_batchCode: { tenantId, batchCode } },
  });
  if (codeExists) {
    return NextResponse.json({ error: "Ya existe un lote de engorde con ese código" }, { status: 409 });
  }

  const growingBatch = await prisma.$transaction(async (tx) => {
    const g = await tx.growingBatch.create({
      data: {
        tenantId,
        nurseryBatchId: params.id,
        batchCode,
        entryDate:      new Date(entryDate),
        entryWeightKg,
        currentCount:   animalCount,
        penId:          penId ?? undefined,
        isActive:       true,
      },
    });

    await tx.nurseryBatch.update({
      where: { id: params.id },
      data:  { isActive: false },
    });

    return g;
  });

  // Alerta de peso de transferencia: si el promedio supera el umbral configurado
  const config = await prisma.tenant.findUnique({
    where:  { id: tenantId },
    select: { config: true },
  });
  const cfg = config?.config as Record<string, unknown> | null;
  const transferTarget = cfg?.transferWeightKg ? Number(cfg.transferWeightKg) : 25;
  const avgWeight = entryWeightKg / animalCount;

  if (avgWeight >= transferTarget) {
    await prisma.alert.create({
      data: {
        tenantId,
        alertType:  "BATCH_REACHED_TRANSFER_WEIGHT",
        severity:   "INFO",
        title:      `Lote ${batchCode} trasladado a engorde`,
        body:       `Peso medio: ${avgWeight.toFixed(1)} kg — umbral: ${transferTarget} kg`,
        entityId:   growingBatch.id,
        entityType: "GROWING_BATCH",
      },
    });
  }

  return NextResponse.json(growingBatch, { status: 201 });
}
