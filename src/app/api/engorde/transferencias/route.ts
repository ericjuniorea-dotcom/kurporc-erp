import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { sourceBatchId, targetBatchId, targetSite, transferDate, count, totalWeightKg, reason, employeeId } = body;

  if (!sourceBatchId || !transferDate || !count || !reason) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const n = Number(count);
  const totalKg = totalWeightKg ? Number(totalWeightKg) : null;
  const avgKg = totalKg && n > 0 ? totalKg / n : null;

  const transferencia = await prisma.growingTransfer.create({
    data: {
      tenantId,
      sourceBatchId,
      targetBatchId: targetBatchId || null,
      targetSite: targetSite || null,
      transferDate: new Date(transferDate),
      count: n,
      totalWeightKg: totalKg,
      avgWeightKg: avgKg,
      reason,
      employeeId: employeeId || null,
    },
  });

  await prisma.growingBatch.update({
    where: { id: sourceBatchId },
    data: { currentCount: { decrement: n }, updatedAt: new Date() },
  });

  if (targetBatchId) {
    await prisma.growingBatch.update({
      where: { id: targetBatchId },
      data: { currentCount: { increment: n }, updatedAt: new Date() },
    });
  }

  return NextResponse.json(transferencia, { status: 201 });
}
