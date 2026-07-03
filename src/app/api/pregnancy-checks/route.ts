import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const schema = z.object({
  sowId:          z.string().min(1),
  serviceEventId: z.string().min(1),
  checkDate:      z.string().min(1),
  method:         z.enum(["ULTRASOUND", "BLOOD_TEST", "VISUAL"]),
  result:         z.enum(["PREGNANT", "NOT_PREGNANT", "RECHECK"]),
  notes:          z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const canRegister = session.user.roles.some((r: number) => [1, 2, 3, 4, 5, 11].includes(r));
  if (!canRegister) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const tenantId = session.user.tenantId;
  const userId   = session.user.id;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { sowId, serviceEventId, checkDate, method, result, notes } = parsed.data;

  // Verify sow and service event belong to tenant
  const [sow, svcEvent] = await Promise.all([
    prisma.sow.findFirst({ where: { id: sowId, tenantId }, select: { id: true, identCode: true } }),
    prisma.serviceEvent.findFirst({ where: { id: serviceEventId, tenantId, sowId }, select: { id: true } }),
  ]);

  if (!sow)      return NextResponse.json({ error: "Cerda no encontrada" }, { status: 404 });
  if (!svcEvent) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

  const check = await prisma.pregnancyCheck.create({
    data: {
      tenantId,
      sowId,
      serviceEventId,
      checkDate:  new Date(checkDate),
      method,
      result,
      notes,
      employeeId: userId,
    },
  });

  // Register animal event for traceability
  await prisma.animalEvent.create({
    data: {
      tenantId,
      sowId,
      eventType:   "PREGNANCY_CHECK",
      eventDate:   new Date(checkDate),
      description: `Diagnóstico de preñez: ${result === "PREGNANT" ? "Preñada" : result === "NOT_PREGNANT" ? "No preñada" : "Re-control"} (${method === "ULTRASOUND" ? "Ecografía" : method === "BLOOD_TEST" ? "Análisis sangre" : "Visual"})`,
      moduleSource: "GESTACION",
      userId,
      metadata:    { pregnancyCheckId: check.id, result, method },
    },
  });

  // Update sow plantelState if result is PREGNANT
  if (result === "PREGNANT") {
    await prisma.sow.update({
      where: { id: sowId },
      data:  { plantelState: "PREGNANT" },
    });
  }

  return NextResponse.json(check, { status: 201 });
}
