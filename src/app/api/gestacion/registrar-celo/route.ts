export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = [1, 2, 3, 4, 5, 11, 13];
  if (!session.user.roles.some((r: number) => allowedRoles.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { tenantId, id: userId } = session.user;
  const body = await req.json();
  const { sowId, heatDate, notes } = body;

  if (!sowId)   return NextResponse.json({ error: "sowId requerido" }, { status: 400 });
  if (!heatDate) return NextResponse.json({ error: "Fecha del último celo requerida" }, { status: 400 });

  const sow = await prisma.sow.findFirst({
    where:  { id: sowId, tenantId },
    select: { id: true, currentParityCount: true, identCode: true },
  });
  if (!sow) return NextResponse.json({ error: "Cerda no encontrada" }, { status: 404 });
  if (sow.currentParityCount !== 0) {
    return NextResponse.json({ error: "El registro de último celo solo aplica a cerdas primerizas" }, { status: 400 });
  }

  const eventDate = new Date(heatDate);
  if (eventDate.getTime() > Date.now()) {
    return NextResponse.json({ error: "La fecha del celo no puede ser futura" }, { status: 400 });
  }

  const event = await prisma.animalEvent.create({
    data: {
      tenantId,
      sowId,
      eventType:    "HEAT_OBSERVED",
      eventDate,
      description:  "Último celo observado (primeriza)",
      moduleSource: "GESTACION",
      userId,
      metadata:     notes ? { notes } : undefined,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
