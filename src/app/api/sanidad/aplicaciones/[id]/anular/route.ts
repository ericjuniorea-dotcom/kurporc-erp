// Sanidad · anular una aplicación de vacuna (nunca se borra): vuelve al lote lo que se descontó, el evento queda
// otra vez pendiente y queda quién la anuló, cuándo y por qué. Solo con el permiso «anular» (lo da el Administrador General).
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { invalidateInventario } from "@/lib/cache";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { registrarAuditoria } from "@/lib/seguridad/auditoria";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), "sanidad.aplicaciones.anular")) return NextResponse.json({ error: "No tenés permiso para anular. Lo da el Administrador General." }, { status: 403 });
  const tenantId = session.user.tenantId;
  const body = await req.json().catch(() => ({})) as { motivo?: string };
  const motivo = String(body.motivo ?? "").trim().slice(0, 300);
  if (motivo.length < 3) return NextResponse.json({ error: "Escribí por qué la anulás." }, { status: 400 });

  const a = await prisma.aplicacionVacuna.findFirst({
    where: { id: String(id).slice(0, 40), tenantId },
    select: { id: true, eventoId: true, loteVacunaId: true, vacunaId: true, dosisAplicadas: true, anuladaEn: true, fechaAplicacion: true,
      vacuna: { select: { nombre: true } }, evento: { select: { fecha: true, targetLabel: true } } },
  });
  if (!a) return NextResponse.json({ error: "Esa aplicación no existe." }, { status: 404 });
  if (a.anuladaEn) return NextResponse.json({ error: "Esa aplicación ya estaba anulada." }, { status: 409 });

  await conActor(session.user.id, async tx => {
    if (a.loteVacunaId && a.dosisAplicadas > 0) {
      await tx.loteInventario.update({ where: { id: a.loteVacunaId }, data: { cantidadActual: { increment: a.dosisAplicadas } } });
      await tx.movimientoInventario.create({ data: { tenantId, productoId: a.vacunaId, loteId: a.loteVacunaId, tipo: "ENTRADA", cantidad: a.dosisAplicadas,
        origen: "VACUNACION", referenciaId: a.eventoId, usuarioId: session.user.id, nota: `Aplicación anulada: ${motivo}` } });
    }
    await tx.aplicacionVacuna.update({ where: { id: a.id }, data: { anuladaEn: new Date(), anuladaPor: session.user.id, motivoAnulacion: motivo } });
    // El evento vuelve a pendiente (o atrasado) si no le queda otra aplicación vigente
    const otras = await tx.aplicacionVacuna.count({ where: { eventoId: a.eventoId, anuladaEn: null } });
    if (otras === 0) await tx.eventoVacunacion.update({ where: { id: a.eventoId }, data: { estado: a.evento.fecha < new Date() ? "retrasado" : "pendiente" } });
  });
  await registrarAuditoria("MOVIMIENTO_ANULADO", "aplicacion_vacuna", a.id,
    { motivo, vacuna: a.vacuna.nombre, a: a.evento.targetLabel, dosis: a.dosisAplicadas, fecha: a.fechaAplicacion.toISOString().slice(0, 10) },
    { actorId: session.user.id, organizacionId: tenantId });
  invalidateInventario(tenantId);
  return NextResponse.json({ ok: true });
}
