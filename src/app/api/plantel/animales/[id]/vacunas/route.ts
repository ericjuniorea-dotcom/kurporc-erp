import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const sow = await prisma.sow.findFirst({
    where: { id: params.id, tenantId },
    select: { id: true },
  });
  if (!sow) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [vacunas, vaccinationEvents] = await Promise.all([
    prisma.configVacuna.findMany({
      where: { tenantId, activa: true, modulo: { in: ["GESTACION", "ALL", "PLANTEL"] } },
      orderBy: [{ obligatoria: "desc" }, { nombreVacuna: "asc" }],
    }),
    prisma.animalEvent.findMany({
      where: { tenantId, sowId: params.id, eventType: "VACCINATION" },
      orderBy: { eventDate: "desc" },
    }),
  ]);

  const today = new Date();

  const carnet = vacunas.map(v => {
    const applied = vaccinationEvents.filter(e => {
      const meta = e.metadata as Record<string, unknown> | null;
      return meta?.configVacunaId === v.id || meta?.nombreVacuna === v.nombreVacuna;
    });

    const lastApplied = applied[0] ?? null;
    const lastDate = lastApplied ? new Date(lastApplied.eventDate) : null;

    let proximaAplicacion: string | null = null;
    let estado: "AL_DIA" | "PROXIMA" | "VENCIDA" | "NO_APLICADA" = "NO_APLICADA";

    if (lastDate && v.refuerzoDias) {
      const nextDate = new Date(lastDate);
      nextDate.setDate(nextDate.getDate() + v.refuerzoDias);
      proximaAplicacion = nextDate.toISOString();

      const daysUntilNext = Math.floor((nextDate.getTime() - today.getTime()) / 86400000);
      if (daysUntilNext < 0)       estado = "VENCIDA";
      else if (daysUntilNext <= 30) estado = "PROXIMA";
      else                           estado = "AL_DIA";
    } else if (lastDate) {
      estado = "AL_DIA";
    }

    const meta = (lastApplied?.metadata as Record<string, unknown> | null) ?? null;

    return {
      id:                  v.id,
      nombreVacuna:        v.nombreVacuna,
      marcaComercial:      v.marcaComercial,
      obligatoria:         v.obligatoria,
      diasEsperaServicio:  v.diasEsperaServicio,
      viaAplicacion:       v.viaAplicacion,
      dosisMl:             String(v.dosisMl),
      momentoAplicacion:   v.momentoAplicacion,
      refuerzoDias:        v.refuerzoDias,
      ultimaAplicacion:    lastDate?.toISOString() ?? null,
      proximaAplicacion,
      estado,
      ultimaAplic: lastApplied ? {
        fecha:        lastApplied.eventDate.toISOString(),
        responsable:  (meta?.responsable as string) ?? null,
        lote:         (meta?.lote as string) ?? null,
        eventoId:     lastApplied.id,
      } : null,
    };
  });

  return NextResponse.json({ carnet });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const sow = await prisma.sow.findFirst({
    where: { id: params.id, tenantId },
    select: { id: true },
  });
  if (!sow) return NextResponse.json({ error: "Cerda no encontrada" }, { status: 404 });

  const body = await req.json();
  const { configVacunaId, fechaAplicacion, responsable, lote, observaciones } = body;

  if (!configVacunaId || !fechaAplicacion || !responsable) {
    return NextResponse.json({ error: "configVacunaId, fechaAplicacion y responsable son requeridos" }, { status: 400 });
  }

  const vacuna = await prisma.configVacuna.findFirst({
    where: { id: configVacunaId, tenantId },
    select: { id: true, nombreVacuna: true, diasEsperaServicio: true },
  });
  if (!vacuna) return NextResponse.json({ error: "Vacuna no encontrada" }, { status: 404 });

  const evento = await prisma.animalEvent.create({
    data: {
      tenantId,
      sowId:     params.id,
      eventType: "VACCINATION",
      eventDate: new Date(fechaAplicacion),
      metadata: {
        configVacunaId: vacuna.id,
        nombreVacuna:   vacuna.nombreVacuna,
        responsable,
        lote:           lote ?? null,
        observaciones:  observaciones ?? null,
        diasEsperaServicio: vacuna.diasEsperaServicio,
      },
    },
  });

  return NextResponse.json({ evento, vacuna }, { status: 201 });
}
