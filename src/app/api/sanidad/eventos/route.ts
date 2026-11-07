export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const sp      = req.nextUrl.searchParams;
  const estado  = sp.get("estado") ?? undefined;     // pendiente | aplicado | retrasado
  const sector  = sp.get("sector") ?? undefined;
  const desde   = sp.get("desde")  ?? undefined;
  const hasta   = sp.get("hasta")  ?? undefined;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in30  = new Date(today); in30.setDate(in30.getDate() + 30);

  const where: Record<string, unknown> = {
    tenantId,
    ...(sector ? { sector } : {}),
    ...(estado ? { estado } : { estado: { not: "omitido" } }),
    fecha: {
      gte: desde ? new Date(desde) : new Date("2020-01-01"),
      lte: hasta ? new Date(hasta) : in30,
    },
  };

  const eventos = await prisma.eventoVacunacion.findMany({
    where,
    include: {
      vacuna: { select: { id: true, nombre: true, enfermedad: true, dosisMl: true, viaAplicacion: true, criticidad: true } },
      aplicaciones: { select: { id: true, dosisAplicadas: true, responsable: true, fechaAplicacion: true, loteVacunaId: true } },
    },
    orderBy: { fecha: "asc" },
    take: 300,
  });

  // Recalculate estado for display
  const result = eventos.map(e => {
    let estado = e.estado;
    if (estado === "pendiente") {
      const diff = Math.floor((e.fecha.getTime() - today.getTime()) / 86400000);
      if (diff < 0) estado = "retrasado";
    }
    return {
      ...e,
      estado,
      fecha:     e.fecha.toISOString(),
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      vacuna: { ...e.vacuna, dosisMl: Number(e.vacuna.dosisMl) },
      diasRestantes: Math.floor((e.fecha.getTime() - today.getTime()) / 86400000),
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body = await req.json();
  const { vacunaId, sector, fecha, targetLabel, dosisNecesarias, animalId, farrowingId, nurseryBatchId } = body;
  if (!vacunaId || !fecha) return NextResponse.json({ error: "vacunaId y fecha requeridos" }, { status: 400 });

  const evento = await prisma.eventoVacunacion.create({
    data: {
      tenantId, vacunaId, sector: sector ?? "granja",
      fecha: new Date(fecha), targetLabel, dosisNecesarias: dosisNecesarias ?? 1,
      animalId, farrowingId, nurseryBatchId,
      estado: "pendiente",
    },
  });
  return NextResponse.json(evento, { status: 201 });
}
