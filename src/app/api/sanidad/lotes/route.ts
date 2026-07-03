export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const sp       = req.nextUrl.searchParams;
  const vacunaId = sp.get("vacunaId") ?? undefined;

  const lotes = await prisma.loteVacuna.findMany({
    where: { tenantId, ...(vacunaId ? { vacunaId } : {}) },
    include: { vacuna: { select: { id: true, nombre: true, enfermedad: true } } },
    orderBy: { fechaVencimiento: "asc" },
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const result = lotes.map(l => ({
    ...l,
    fechaVencimiento: l.fechaVencimiento.toISOString(),
    fechaIngreso:     l.fechaIngreso.toISOString(),
    diasParaVencer:   Math.floor((l.fechaVencimiento.getTime() - today.getTime()) / 86400000),
    vencido:          l.fechaVencimiento < today,
    alertaVencimiento: Math.floor((l.fechaVencimiento.getTime() - today.getTime()) / 86400000) <= 30,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body = await req.json();
  const { vacunaId, numeroLote, proveedor, fechaVencimiento, cantidad, observaciones } = body;
  if (!vacunaId || !numeroLote || !fechaVencimiento || !cantidad) {
    return NextResponse.json({ error: "vacunaId, numeroLote, fechaVencimiento y cantidad son requeridos" }, { status: 400 });
  }

  const lote = await prisma.loteVacuna.create({
    data: {
      tenantId, vacunaId, numeroLote, proveedor,
      fechaVencimiento: new Date(fechaVencimiento),
      cantidadInicial:  cantidad,
      cantidadActual:   cantidad,
      observaciones,
    },
    include: { vacuna: { select: { nombre: true } } },
  });

  return NextResponse.json(lote, { status: 201 });
}
