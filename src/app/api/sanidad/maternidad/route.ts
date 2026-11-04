export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

const PROCEDIMIENTO_LABEL: Record<string, string> = {
  DESCOLMILLADO:  "Descolmillado",
  CORTE_COLA:     "Corte de cola",
  CORTE_OMBLIGO:  "Corte de ombligo",
  HIERRO:         "Hierro",
  CASTRACION:     "Castración",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const registros = await prisma.procedimientoMaternidad.findMany({
    where:   { tenantId },
    orderBy: { fecha: "desc" },
    take:    100,
    include: { farrowing: { select: { sow: { select: { identCode: true, caravanaCode: true } }, bornAlive: true } } },
  });

  const result = registros.map(r => ({
    id:                         r.id,
    farrowingId:                r.farrowingId,
    caravana:                   r.farrowing.sow.caravanaCode ?? r.farrowing.sow.identCode,
    tamanoCamada:               r.farrowing.bornAlive,
    procedimiento:              r.procedimiento,
    procedimientoLabel:         PROCEDIMIENTO_LABEL[r.procedimiento] ?? r.procedimiento,
    cantidadLechonesProcesados: r.cantidadLechonesProcesados,
    edadDiasAlProcedimiento:    r.edadDiasAlProcedimiento,
    observacionesTecnica:       r.observacionesTecnica,
    fecha:                      r.fecha.toISOString(),
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId, id: userId } = session.user;

  const body = await req.json();
  const {
    farrowingId, procedimiento, cantidadLechonesProcesados,
    edadDiasAlProcedimiento, observacionesTecnica, fecha,
  } = body;

  if (!farrowingId || !procedimiento || cantidadLechonesProcesados == null || edadDiasAlProcedimiento == null) {
    return NextResponse.json({ error: "farrowingId, procedimiento, cantidadLechonesProcesados y edadDiasAlProcedimiento son requeridos" }, { status: 400 });
  }
  if (!PROCEDIMIENTO_LABEL[procedimiento]) {
    return NextResponse.json({ error: "Procedimiento inválido" }, { status: 400 });
  }

  const farrowing = await prisma.farrowingEvent.findFirst({
    where:  { id: farrowingId, tenantId },
    select: { sowId: true, sow: { select: { identCode: true, caravanaCode: true } } },
  });
  if (!farrowing) return NextResponse.json({ error: "Camada no encontrada" }, { status: 404 });

  const fechaProc = fecha ? new Date(fecha) : new Date();

  const registro = await prisma.procedimientoMaternidad.create({
    data: {
      tenantId, farrowingId, procedimiento,
      cantidadLechonesProcesados, edadDiasAlProcedimiento,
      observacionesTecnica, fecha: fechaProc, responsableId: userId,
    },
  });

  const caravana = farrowing.sow.caravanaCode ?? farrowing.sow.identCode;
  await prisma.animalEvent.create({
    data: {
      tenantId,
      sowId:        farrowing.sowId,
      eventType:    "MATERNIDAD_PROCEDIMIENTO",
      eventDate:    fechaProc,
      description:  `${PROCEDIMIENTO_LABEL[procedimiento]} — ${cantidadLechonesProcesados} lechón(es) de la camada de ${caravana}`,
      moduleSource: "SANIDAD",
      userId,
      metadata:     { procedimientoMaternidadId: registro.id, farrowingId, procedimiento },
    },
  }).catch(() => {});

  return NextResponse.json(registro, { status: 201 });
}
