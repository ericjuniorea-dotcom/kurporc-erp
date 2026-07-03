import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { pigletDeathSchema } from "@/lib/validations/maternidad";
import { calculateSowStock } from "@/lib/maternidad/stock";
import { diffDays } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = [1, 2, 3, 4, 5, 10, 13];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = pigletDeathSchema.safeParse({ ...body, farrowingId: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { farrowingId, quantity, cause, deathDatetime, pigletId, notes, evidenceUrl } = parsed.data;
  const tenantId = session.user.tenantId;

  // REGLA 4: Verificar que hay stock suficiente antes de registrar la muerte
  const stock = await calculateSowStock(farrowingId);
  if (stock.currentStock < quantity) {
    return NextResponse.json(
      {
        error: `Stock insuficiente. La cerda ${stock.sowCode} tiene ${stock.currentStock} lechón/es disponibles. No se puede registrar ${quantity} muerte(s).`,
        currentStock: stock.currentStock,
      },
      { status: 422 }
    );
  }

  const farrowing = await prisma.farrowingEvent.findUnique({
    where: { id: farrowingId },
    select: { startDatetime: true },
  });

  const ageAtDeathDays = farrowing
    ? diffDays(new Date(farrowing.startDatetime), new Date(deathDatetime))
    : null;

  const death = await prisma.pigletDeath.create({
    data: {
      tenantId,
      farrowingId,
      pigletId:     pigletId    ?? undefined,
      deathDatetime: new Date(deathDatetime),
      quantity,
      ageAtDeathDays,
      cause:        cause as any,
      employeeId:   session.user.id,
      evidenceUrl:  evidenceUrl  ?? undefined,
    },
  });

  // Stock actualizado tras la muerte
  const updatedStock = await calculateSowStock(farrowingId);

  // Alerta si el stock queda en 0 sin destete registrado
  if (updatedStock.currentStock === 0 && !updatedStock.weaned) {
    await prisma.alert.create({
      data: {
        tenantId,
        alertType:  "SOW_ZERO_PIGLETS_NO_WEANING",
        severity:   "WARNING",
        title:      `Cerda ${stock.sowCode} sin lechones activos`,
        body:       "El stock llegó a 0 pero no hay destete registrado. Verificar.",
        entityId:   farrowingId,
        entityType: "FARROWING",
      },
    });
  }

  return NextResponse.json({ death, updatedStock }, { status: 201 });
}
