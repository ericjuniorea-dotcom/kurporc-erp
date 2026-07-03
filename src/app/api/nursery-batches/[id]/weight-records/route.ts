import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { weightRecordSchema } from "@/lib/validations/recria";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const records = await prisma.weightRecord.findMany({
    where:   { tenantId: session.user.tenantId, nurseryBatchId: params.id },
    orderBy: { recordDate: "asc" },
  });

  return NextResponse.json(records);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = [1, 2, 4, 5, 12, 13];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = weightRecordSchema.safeParse({ ...body, batchId: params.id, batchType: "NURSERY" });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { recordDate, totalWeightKg, animalCount } = parsed.data;
  const tenantId  = session.user.tenantId;
  const avgWeight = Math.round((totalWeightKg / animalCount) * 1000) / 1000;

  const batch = await prisma.nurseryBatch.findFirst({
    where:   { id: params.id, tenantId },
    include: {
      weightRecords: {
        orderBy: { recordDate: "desc" },
        take:    1,
        select:  { recordDate: true, avgWeightKg: true },
      },
    },
  });
  if (!batch) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  // Calcular GDP respecto al pesaje anterior
  let dailyGainKg: number | null = null;
  const prev = batch.weightRecords[0];
  if (prev) {
    const daysDiff =
      (new Date(recordDate).getTime() - new Date(prev.recordDate).getTime()) / 86400000;
    if (daysDiff > 0) {
      dailyGainKg = Math.round(((avgWeight - Number(prev.avgWeightKg)) / daysDiff) * 1000) / 1000;
    }
  }

  const record = await prisma.$transaction(async (tx) => {
    const r = await tx.weightRecord.create({
      data: {
        tenantId,
        nurseryBatchId: params.id,
        recordDate:     new Date(recordDate),
        totalWeightKg,
        animalCount,
        avgWeightKg:    avgWeight,
        dailyGainKg:    dailyGainKg ?? undefined,
        employeeId:     session.user.id,
      },
    });

    // Actualizar batch con último peso
    await tx.nurseryBatch.update({
      where: { id: params.id },
      data:  { avgWeightKg: avgWeight, currentWeightKg: totalWeightKg },
    });

    return r;
  });

  // Alerta si GDP < 200 g/día (umbral típico en recría)
  if (dailyGainKg !== null && dailyGainKg < 0.2) {
    await prisma.alert.create({
      data: {
        tenantId,
        alertType:  "BATCH_NOT_FED",
        severity:   "WARNING",
        title:      `GDP bajo en lote ${batch.batchCode}`,
        body:       `GDP: ${(dailyGainKg * 1000).toFixed(0)} g/día (mínimo esperado: 200 g/día)`,
        entityId:   params.id,
        entityType: "NURSERY_BATCH",
      },
    });
  }

  return NextResponse.json(record, { status: 201 });
}
