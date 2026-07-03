export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowedRoles = [1, 2, 3, 4, 5, 10, 11, 13];
  if (!session.user.roles.some((r: number) => allowedRoles.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { tenantId } = session.user;
  const body = await req.json();
  const {
    sowId, serviceEventId, fechaDeteccion, diasPostServicio,
    causaProbable, repiteServicio, nuevaFecha, reproductor, observaciones,
  } = body;

  if (!sowId) return NextResponse.json({ error: "sowId requerido" }, { status: 400 });

  const detDate = fechaDeteccion ? new Date(fechaDeteccion) : new Date();

  // Actualizar estado cerda a EMPTY (requiere nuevo servicio)
  await prisma.sow.update({
    where: { id: sowId },
    data: { plantelState: "EMPTY" },
  }).catch(() => {});

  // Registrar HeatRepeat para que pendientes-diagnostico la excluya correctamente
  await prisma.heatRepeat.create({
    data: {
      tenantId,
      sowId,
      serviceEventId: serviceEventId ?? undefined,
      repeatDate:     detDate,
      cause:          causaProbable || "Repetición de celo confirmada",
      employeeId:     session.user.id ?? undefined,
    },
  }).catch(() => {});

  // Marcar tarea de diagnóstico como completada (repetición de celo = diagnóstico implícito)
  if (serviceEventId) {
    const tarea = await prisma.task.findFirst({
      where: { tenantId, disparador: `servicio-${serviceEventId}-diagnostico` },
      select: { id: true },
    });
    if (tarea) {
      await prisma.task.update({
        where: { id: tarea.id },
        data: {
          fechaCompletada: detDate,
          notas: `Repetición de celo detectada${causaProbable ? ` — ${causaProbable}` : ""}`,
          prioridad: "completada",
        },
      }).catch(() => {});
    }
  }

  // Crear tarea de nuevo servicio si repite
  const sow = await prisma.sow.findUnique({ where: { id: sowId }, select: { identCode: true } });
  if (repiteServicio && nuevaFecha) {
    const fechaNuevo = new Date(nuevaFecha);
    await prisma.task.create({
      data: {
        tenantId,
        tipo:              "repeticion-celo",
        sector:            "gestacion",
        alcance:           "animal",
        titulo:            `Nuevo servicio — Cerda ${sow?.identCode ?? sowId}`,
        descripcion:       `Repetición de celo. Nuevo servicio programado${reproductor ? ` con ${reproductor}` : ""}.`,
        instrucciones:     causaProbable ? `Causa probable: ${causaProbable}` : undefined,
        prioridad:         "programada",
        fechaVencimiento:  fechaNuevo,
        animalId:          sowId,
        targetLabel:       `Cerda ${sow?.identCode ?? sowId}`,
        responsableNombre: "Bartolomé Vera",
        responsableKey:    "bartolome-vera",
        generadaPor:       "repeticion-celo",
        disparador:        `rep-celo-${sowId}-${fechaNuevo.toISOString().slice(0, 10)}`,
      },
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    mensaje: repiteServicio
      ? "Repetición de celo registrada. Nuevo servicio programado."
      : "Repetición de celo registrada. Cerda en estado vacía.",
  });
}
