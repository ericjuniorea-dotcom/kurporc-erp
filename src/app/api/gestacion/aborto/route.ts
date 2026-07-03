export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body = await req.json() as {
    sowId:        string;
    abortionDate: string;
    cause?:       string;
    vetDiagnosis?: string;
  };
  const { sowId, abortionDate, cause, vetDiagnosis } = body;

  if (!sowId || !abortionDate) {
    return NextResponse.json({ error: "sowId y abortionDate son requeridos" }, { status: 400 });
  }

  // Verificar que la cerda pertenece al tenant
  const sow = await prisma.sow.findFirst({
    where: { id: sowId, tenantId },
    select: { id: true },
  });
  if (!sow) return NextResponse.json({ error: "Cerda no encontrada" }, { status: 404 });

  // Buscar el servicio activo más reciente (sin parto registrado)
  const recentServices = await prisma.serviceEvent.findMany({
    where: { tenantId, sowId },
    include: { farrowing: { select: { id: true } } },
    orderBy: { serviceDate: "desc" },
    take: 5,
  });
  const latestService = recentServices.find(s => !s.farrowing);

  await prisma.$transaction([
    prisma.abortionEvent.create({
      data: {
        tenantId,
        sowId,
        serviceEventId: latestService?.id ?? undefined,
        abortionDate:   new Date(abortionDate),
        cause:          cause ?? null,
        vetDiagnosis:   vetDiagnosis ?? null,
      },
    }),
    prisma.sow.update({
      where: { id: sowId },
      data:  { plantelState: "EMPTY" },
    }),
  ]);

  return NextResponse.json({ mensaje: "Aborto registrado correctamente" });
}
