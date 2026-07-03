export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const vacunas = await prisma.vacuna.findMany({
    where: { tenantId, isActive: true },
    include: {
      lotes: {
        where: { cantidadActual: { gt: 0 } },
        select: { id: true, cantidadActual: true, fechaVencimiento: true, abierto: true, numeroLote: true },
      },
      _count: { select: { eventosVacunacion: { where: { estado: "pendiente" } } } },
    },
    orderBy: { nombre: "asc" },
  });

  const result = vacunas.map(v => ({
    ...v,
    dosisMl: Number(v.dosisMl),
    stockTotal: v.lotes.reduce((s, l) => s + l.cantidadActual, 0),
    eventosPendientes: v._count.eventosVacunacion,
    lotes: v.lotes.map(l => ({
      ...l,
      fechaVencimiento: l.fechaVencimiento.toISOString(),
      diasParaVencer: Math.floor((l.fechaVencimiento.getTime() - Date.now()) / 86400000),
    })),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body = await req.json();
  const { nombre, enfermedad, categoria, viaAplicacion, dosisMl, criticidad, bloqueoServicio, observaciones, intervaloRefuerzo } = body;
  if (!nombre || !enfermedad) return NextResponse.json({ error: "nombre y enfermedad requeridos" }, { status: 400 });

  const vacuna = await prisma.vacuna.create({
    data: { tenantId, nombre, enfermedad, categoria: categoria ?? "plantel", viaAplicacion: viaAplicacion ?? "IM", dosisMl: dosisMl ?? 2, criticidad: criticidad ?? "alta", bloqueoServicio: bloqueoServicio ?? false, observaciones, intervaloRefuerzo },
  });
  return NextResponse.json(vacuna, { status: 201 });
}
