import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { growingBatchId, exitType, exitDate, count, estimatedWeightKg, reason, employeeId } = body;

  if (!growingBatchId || !exitType || !exitDate || !count || !reason) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const n = Number(count);

  // Los animales en Hospital NO se descuentan del stock
  const descontarStock = exitType !== "HOSPITAL";

  const salida = await prisma.growingOtherExit.create({
    data: {
      tenantId,
      growingBatchId,
      exitType,
      exitDate: new Date(exitDate),
      count: n,
      estimatedWeightKg: estimatedWeightKg ? Number(estimatedWeightKg) : null,
      reason,
      employeeId: employeeId || null,
    },
  });

  if (descontarStock) {
    await prisma.growingBatch.update({
      where: { id: growingBatchId },
      data: { currentCount: { decrement: n }, updatedAt: new Date() },
    });
  }

  return NextResponse.json(salida, { status: 201 });
}
