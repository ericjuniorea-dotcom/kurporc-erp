export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { invalidateInventario } from "@/lib/cache";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const sp       = req.nextUrl.searchParams;
  const vacunaId = sp.get("vacunaId") ?? undefined;

  const lotes = await prisma.loteInventario.findMany({
    where: { tenantId, ...(vacunaId ? { vacunaId } : {}) },
    include: { vacuna: { select: { id: true, nombre: true, enfermedad: true } } },
    orderBy: { fechaVencimiento: "asc" },
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const result = lotes.map(l => ({
    ...l,
    cantidadInicial:  Number(l.cantidadInicial),
    cantidadActual:   Number(l.cantidadActual),
    fechaVencimiento: l.fechaVencimiento.toISOString(),
    fechaIngreso:     l.fechaIngreso.toISOString(),
    diasParaVencer:   Math.floor((l.fechaVencimiento.getTime() - today.getTime()) / 86400000),
    vencido:          l.fechaVencimiento < today,
    alertaVencimiento: Math.floor((l.fechaVencimiento.getTime() - today.getTime()) / 86400000) <= 30,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body = await req.json();
  const { vacunaId, numeroLote, proveedor, fechaVencimiento, cantidad, observaciones, costoUnitario } = body;
  if (!vacunaId || !numeroLote || !fechaVencimiento || !cantidad) {
    return NextResponse.json({ error: "vacunaId, numeroLote, fechaVencimiento y cantidad son requeridos" }, { status: 400 });
  }

  const lote = await prisma.loteInventario.create({
    data: {
      tenantId, vacunaId, numeroLote, proveedor,
      fechaVencimiento: new Date(fechaVencimiento),
      cantidadInicial:  cantidad,
      cantidadActual:   cantidad,
      costoUnitario:    costoUnitario != null ? Number(costoUnitario) : undefined,
      observaciones,
    },
    include: { vacuna: { select: { nombre: true } } },
  });
  await prisma.movimientoInventario.create({
    data: { tenantId, productoId: vacunaId, loteId: lote.id, tipo: "ENTRADA", cantidad, origen: "COMPRA", referenciaId: lote.id },
  });
  invalidateInventario(tenantId);

  return NextResponse.json({ ...lote, cantidadInicial: Number(lote.cantidadInicial), cantidadActual: Number(lote.cantidadActual) }, { status: 201 });
}
