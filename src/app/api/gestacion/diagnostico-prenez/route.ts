export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { generarTareasServicio } from "@/lib/tasks/generate";
import { evaluarAlertaConcepcion } from "@/lib/gestacion/tasa-concepcion";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = [1, 2, 3, 4, 5, 10, 11, 13];
  if (!session.user.roles.some((r: number) => allowedRoles.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { tenantId } = session.user;
  const body = await req.json();
  const { serviceEventId, sowId, fechaDiagnostico, resultado, metodo, observaciones, veterinario } = body;

  if (!serviceEventId || !resultado) {
    return NextResponse.json({ error: "serviceEventId y resultado son requeridos" }, { status: 400 });
  }

  const serviceEvent = await prisma.serviceEvent.findFirst({
    where: { id: serviceEventId, tenantId },
    include: { sow: { select: { id: true, identCode: true } } },
  });
  if (!serviceEvent) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

  const diagDate = fechaDiagnostico ? new Date(fechaDiagnostico) : new Date();

  // Registrar PregnancyCheck (permite filtrar correctamente en pendientes-diagnostico)
  const checkResult = resultado === "Positivo" ? "PREGNANT"
    : resultado === "Negativo" ? "NOT_PREGNANT"
    : "RECHECK";
  const checkMethod = (metodo ?? "").toLowerCase().includes("sangre") ? "BLOOD_TEST"
    : (metodo ?? "").toLowerCase().includes("visual") ? "VISUAL"
    : "ULTRASOUND";
  await prisma.pregnancyCheck.create({
    data: {
      tenantId,
      sowId: serviceEvent.sow.id,
      serviceEventId,
      checkDate:  diagDate,
      method:     checkMethod,
      result:     checkResult,
      employeeId: session.user.id ?? null,
      notes:      observaciones ?? null,
    },
  }).catch(() => {});

  // Recalcular tasa de concepción de la granja y alertar si cayó del umbral
  await evaluarAlertaConcepcion(tenantId).catch(() => {});

  // Marcar tarea de diagnóstico como completada
  const tarea = await prisma.task.findFirst({
    where: { tenantId, disparador: `servicio-${serviceEventId}-diagnostico` },
    select: { id: true },
  });
  if (tarea) {
    await prisma.task.update({
      where: { id: tarea.id },
      data: {
        fechaCompletada: diagDate,
        completadaPor:   veterinario ?? "Dr. Erwin Segovia",
        notas: `${metodo ?? "Ecografía"}: ${resultado}${observaciones ? ` — ${observaciones}` : ""}`,
        prioridad: "completada",
      },
    });
  }

  // Actualizar estado de la cerda según resultado
  let nuevoPlantelState: "PREGNANT" | "EMPTY" | null = null;
  if (resultado === "Positivo") {
    nuevoPlantelState = "PREGNANT";
    await generarTareasServicio(
      tenantId, serviceEventId,
      new Date(serviceEvent.serviceDate),
      `Cerda ${serviceEvent.sow.identCode}`,
      sowId,
    ).catch(() => {});
  } else if (resultado === "Negativo") {
    nuevoPlantelState = "EMPTY";
    await prisma.task.create({
      data: {
        tenantId,
        tipo:              "repeticion-celo",
        sector:            "gestacion",
        alcance:           "animal",
        titulo:            `Nuevo servicio necesario — Cerda ${serviceEvent.sow.identCode}`,
        descripcion:       `Diagnóstico negativo. Programar nuevo servicio.`,
        prioridad:         "hoy",
        fechaVencimiento:  diagDate,
        animalId:          sowId,
        targetLabel:       `Cerda ${serviceEvent.sow.identCode}`,
        responsableNombre: "Bartolomé Vera",
        responsableKey:    "bartolome-vera",
        generadaPor:       "diagnostico-prenez",
        disparador:        `diag-neg-${serviceEventId}-nuevo-servicio`,
      },
    }).catch(() => {});
  } else if (resultado === "Dudoso") {
    const rediagDate = new Date(diagDate); rediagDate.setDate(rediagDate.getDate() + 7);
    await prisma.task.create({
      data: {
        tenantId,
        tipo:              "diagnostico-prenez",
        sector:            "gestacion",
        alcance:           "animal",
        titulo:            `Re-diagnóstico preñez — Cerda ${serviceEvent.sow.identCode}`,
        descripcion:       `Resultado dudoso. Re-diagnosticar en 7 días.`,
        prioridad:         "programada",
        fechaVencimiento:  rediagDate,
        animalId:          sowId,
        targetLabel:       `Cerda ${serviceEvent.sow.identCode}`,
        responsableNombre: "Dr. Erwin Segovia",
        responsableKey:    "erwin-segovia",
        generadaPor:       "diagnostico-prenez",
        disparador:        `diag-dudoso-${serviceEventId}-rediag`,
      },
    }).catch(() => {});
  }

  if (nuevoPlantelState && sowId) {
    await prisma.sow.update({
      where: { id: sowId },
      data: { plantelState: nuevoPlantelState },
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    resultado,
    mensaje: resultado === "Positivo"
      ? "Preñez confirmada. Cerda pasa a gestación confirmada."
      : resultado === "Negativo"
      ? "Diagnóstico negativo. Se programó tarea de nuevo servicio."
      : "Resultado dudoso. Re-diagnóstico programado en 7 días.",
  });
}
