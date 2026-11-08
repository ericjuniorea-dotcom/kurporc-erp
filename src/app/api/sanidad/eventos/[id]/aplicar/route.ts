export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { invalidateInventario } from "@/lib/cache";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "sanidad.aplicaciones.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "sanidad.aplicaciones.crear" }, { status: 403 });

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
    const lote = await prisma.loteInventario.findFirst({ where: { id: loteVacunaId, tenantId } });
    if (!lote) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
    if (lote.fechaVencimiento < new Date()) {
      return NextResponse.json({ error: "El lote de vacuna está vencido. No se puede aplicar." }, { status: 422 });
    }
    if (Number(lote.cantidadActual) < dosisAplicadas) {
      return NextResponse.json({ error: `Stock insuficiente. Disponible: ${Number(lote.cantidadActual)} dosis.` }, { status: 422 });
    }
    await prisma.loteInventario.update({
      where: { id: loteVacunaId },
      data: { cantidadActual: { decrement: dosisAplicadas }, abierto: true },
    });
    await prisma.movimientoInventario.create({
      data: { tenantId, productoId: evento.vacunaId, loteId: loteVacunaId, tipo: "SALIDA", cantidad: dosisAplicadas, origen: "VACUNACION", referenciaId: evento.id },
    });
  }

  // Crear registro de aplicación y marcar el evento como aplicado — son
  // escrituras independientes, se disparan juntas en vez de una tras otra.
  await Promise.all([
    prisma.aplicacionVacuna.create({
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
    }),
    prisma.eventoVacunacion.update({
      where: { id: evento.id },
      data:  { estado: "aplicado", updatedAt: new Date() },
    }),
  ]);

  // Si la vacuna tenía bloqueoServicio + hay animal → desbloquear cerda
  if (evento.vacuna.bloqueoServicio && evento.animalId) {
    // Marcar en el animal que vacuna aplicada (via nota en tarea o simplemente dejamos desbloqueo implícito)
    // La verificación de bloqueo busca eventos aplicados, por lo que con esto alcanza
  }

  if (loteVacunaId) invalidateInventario(tenantId);

  return NextResponse.json({ success: true, mensaje: "Vacunación registrada correctamente." });
}
