import { NextRequest, NextResponse } from "next/server";
import { getSession, canApproveStockAdjustments } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { stockAdjustmentSchema } from "@/lib/validations/maternidad";
import { calculateSowStock } from "@/lib/maternidad/stock";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const adjustments = await prisma.stockAdjustmentRequest.findMany({
    where: {
      tenantId: session.user.tenantId,
      status:   status as any,
    },
    include: {
      sow:      { select: { identCode: true } },
      farrowing: { select: { startDatetime: true } },
    },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  return NextResponse.json(adjustments);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body   = await req.json();
  const parsed = stockAdjustmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { farrowingId, sowId, correctStock, reason, notes } = parsed.data;
  const tenantId = session.user.tenantId;

  // Stock actual calculado por el sistema
  const stock = await calculateSowStock(farrowingId);

  const adjustment = await prisma.stockAdjustmentRequest.create({
    data: {
      tenantId,
      farrowingId,
      sowId,
      currentStock:  stock.currentStock,
      correctStock,
      reason,
      notes:         notes ?? undefined,
      requestedById: session.user.id,
      status:        "PENDING",
    },
  });

  // Notificar al Jefe de producción (alerta en sistema)
  await prisma.alert.create({
    data: {
      tenantId,
      alertType:  "STOCK_ADJUSTMENT_PENDING",
      severity:   "WARNING",
      title:      `Ajuste de stock pendiente — Cerda ${stock.sowCode}`,
      body:       `Stock sistema: ${stock.currentStock} | Stock correcto: ${correctStock}. Motivo: ${reason}`,
      entityId:   adjustment.id,
      entityType: "STOCK_ADJUSTMENT",
    },
  });

  return NextResponse.json(adjustment, { status: 201 });
}
