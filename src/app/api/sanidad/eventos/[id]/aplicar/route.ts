export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId } = session.user;
  const body = await req.json();
  const { loteVacunaId, dosisAplicadas, responsable, fechaAplicacion, observaciones } = body;

  if (!dosisAplicadas || !responsable) {
    return NextResponse.json({ error: "dosisAplicadas y responsable requeridos" }, { status: 400 });
  }

  const evento = await prisma.eventoVacunacion.findFirst({
    where: { id: params.id, tenantId },
    include: { vacuna: { select: { bloqueoServicio: true } } },
  });
  if (!evento) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  if (evento.estado === "aplicado") return NextResponse.json({ error: "Ya fue aplicado" }, { status: 409 });

  const fechaApp = fechaAplicacion ? new Date(fechaAplicacion) : new Date();

  // Descontar stock del lote
  if (loteVacunaId) {
    const lote = await prisma.loteVacuna.findFirst({ where: { id: loteVacunaId, tenantId } });
    if (!lote) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    if (lote.fechaVencimiento < new Date()) {
      return NextResponse.json({ error: "El lote de vacuna está vencido. No se puede aplicar." }, { status: 422 });
    }
    if (lote.cantidadActual < dosisAplicadas) {
      return NextResponse.json({ error: `Stock insuficiente. Disponible: ${lote.cantidadActual} dosis.` }, { status: 422 });
    }
    await prisma.loteVacuna.update({
      where: { id: loteVacunaId },
      data: { cantidadActual: { decrement: dosisAplicadas }, abierto: true },
    });
  }

  // Crear registro de aplicación
  await prisma.aplicacionVacuna.create({
    data: {
      tenantId,
      eventoId:       evento.id,
      loteVacunaId,
      vacunaId:       evento.vacunaId,
      dosisAplicadas,
      fechaAplicacion: fechaApp,
      responsable,
      observaciones,
    },
  });

  // Marcar evento como aplicado
  await prisma.eventoVacunacion.update({
    where: { id: evento.id },
    data:  { estado: "aplicado", updatedAt: new Date() },
  });

  // Si la vacuna tenía bloqueoServicio + hay animal → desbloquear cerda
  if (evento.vacuna.bloqueoServicio && evento.animalId) {
    // Marcar en el animal que vacuna aplicada (via nota en tarea o simplemente dejamos desbloqueo implícito)
    // La verificación de bloqueo busca eventos aplicados, por lo que con esto alcanza
  }

  return NextResponse.json({ success: true, mensaje: "Vacunación registrada correctamente." });
}
