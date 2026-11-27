export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "gestacion.diagnosticos.crear")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { tenantId } = session.user;
  const body = await req.json();
  const {
    sowId, serviceEventId, fechaDeteccion, diasPostServicio,
    causaProbable, repiteServicio, nuevaFecha, reproductor, observaciones,
  } = body;

  if (!sowId) return NextResponse.json({ error: "sowId requerido" }, { status: 400 });

  // La cerda tiene que ser de esta granja
  const cerda = await prisma.sow.findFirst({ where: { id: sowId, tenantId }, select: { id: true } });
  if (!cerda) return NextResponse.json({ error: "Esa cerda no es de tu granja." }, { status: 404 });

  // Fecha al mediodía UTC (se ve el mismo día en cualquier zona horaria)
  const hoyIso = new Date().toISOString().slice(0, 10);
  const fechaIso = typeof fechaDeteccion === "string" && /^\d{4}-\d{2}-\d{2}/.test(fechaDeteccion) ? fechaDeteccion.slice(0, 10) : hoyIso;
  const detDate = new Date(`${fechaIso}T12:00:00Z`);
  if (fechaIso > hoyIso) return NextResponse.json({ error: "La fecha de la repetición no puede ser futura." }, { status: 400 });

  // El servicio que repitió: el indicado o, si no vino, el último servicio de la cerda
  const servicio = serviceEventId
    ? await prisma.serviceEvent.findFirst({ where: { id: serviceEventId, tenantId, sowId }, select: { id: true, serviceDate: true } })
    : await prisma.serviceEvent.findFirst({ where: { tenantId, sowId }, orderBy: { serviceDate: "desc" }, select: { id: true, serviceDate: true } });
  if (!servicio) return NextResponse.json({ error: "Esta cerda no tiene un servicio para marcar como repetido." }, { status: 400 });
  if (fechaIso < servicio.serviceDate.toISOString().slice(0, 10)) {
    return NextResponse.json({ error: `La repetición no puede ser anterior al servicio (${servicio.serviceDate.toISOString().slice(0, 10).split("-").reverse().join("/")}).` }, { status: 400 });
  }
  // Una sola repetición por servicio
  const ya = await prisma.heatRepeat.findFirst({ where: { tenantId, serviceEventId: servicio.id }, select: { repeatDate: true } });
  if (ya) return NextResponse.json({ error: `La repetición de este servicio ya está registrada (${ya.repeatDate.toISOString().slice(0, 10).split("-").reverse().join("/")}).` }, { status: 409 });

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
      serviceEventId: servicio.id,
      repeatDate:     detDate,
      cause:          causaProbable || "Repetición de celo confirmada",
      employeeId:     session.user.id ?? undefined,
    },
  }).catch(() => {});

  // Marcar tarea de diagnóstico como completada (repetición de celo = diagnóstico implícito)
  {
    const tarea = await prisma.task.findFirst({
      where: { tenantId, disparador: `servicio-${servicio.id}-diagnostico` },
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
        responsableNombre: "Encargado de Gestación",
        responsableKey:    "gestacion",
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
