import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { pigletMovementSchema } from "@/lib/validations/maternidad";
import { calculateSowStock } from "@/lib/maternidad/stock";

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
  const parsed = pigletMovementSchema.safeParse({ ...body, originId: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { originId, destinationId, movementDate, quantity } = parsed.data;
  const tenantId = session.user.tenantId;

  // Verificar que ambos partos pertenecen al mismo tenant
  const [origin, dest] = await Promise.all([
    prisma.farrowingEvent.findFirst({ where: { id: originId, tenantId } }),
    prisma.farrowingEvent.findFirst({ where: { id: destinationId, tenantId } }),
  ]);

  if (!origin) return NextResponse.json({ error: "Cerda donadora no encontrada" }, { status: 404 });
  if (!dest)   return NextResponse.json({ error: "Cerda receptora no encontrada" }, { status: 404 });

  // REGLA 4: stock suficiente en la donadora
  const originStock = await calculateSowStock(originId);
  if (originStock.currentStock < quantity) {
    return NextResponse.json(
      {
        error: `Stock insuficiente en la cerda ${originStock.sowCode}. Disponibles: ${originStock.currentStock}.`,
        currentStock: originStock.currentStock,
      },
      { status: 422 }
    );
  }

  const movement = await prisma.pigletMovement.create({
    data: {
      tenantId,
      originId,
      destinationId,
      movementDate: new Date(movementDate),
      quantity,
      employeeId:   session.user.id,
    },
  });

  const [updatedOrigin, updatedDest] = await Promise.all([
    calculateSowStock(originId),
    calculateSowStock(destinationId),
  ]);

  return NextResponse.json({ movement, updatedOrigin, updatedDest }, { status: 201 });
}
