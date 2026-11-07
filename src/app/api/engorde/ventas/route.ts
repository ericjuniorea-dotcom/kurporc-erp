import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { growingBatchId, saleDate, buyerName, animalCount, totalWeightKg, pricePerKg, transferGuide, employeeId } = body;

  if (!growingBatchId || !saleDate || !animalCount || !totalWeightKg || !pricePerKg) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const count = Number(animalCount);
  const totalKg = Number(totalWeightKg);
  const precio = Number(pricePerKg);
  const total = Math.round(totalKg * precio * 100) / 100;

  const [venta] = await prisma.$transaction([
    prisma.batchSale.create({
      data: {
        tenantId,
        growingBatchId,
        saleDate: new Date(saleDate),
        animalCount: count,
        totalWeightKg: totalKg,
        pricePerKg: precio,
        totalAmount: total,
        buyerName: buyerName || null,
        transferGuide: transferGuide || null,
        employeeId: employeeId || null,
      },
    }),
    prisma.growingBatch.update({
      where: { id: growingBatchId },
      data: { currentCount: { decrement: count }, updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json(venta, { status: 201 });
}
