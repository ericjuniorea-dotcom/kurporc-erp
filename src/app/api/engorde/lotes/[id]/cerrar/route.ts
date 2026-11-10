import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { diasVacioSanitario } from "@/lib/engorde/vacio";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "engorde.lotes.cerrar")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "engorde.lotes.cerrar" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { closedReason } = body;

  const lote = await prisma.growingBatch.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!lote) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  const updated = await prisma.growingBatch.update({
    where: { id: params.id },
    data: { status: "CLOSED", isActive: false, closedAt: new Date(), closedReason: closedReason || null },
  });

  // Vacío sanitario: tarea de limpieza y desinfección del sitio por los días configurados
  const dias = await diasVacioSanitario(tenantId);
  if (dias > 0 && lote.sitio) {
    const hasta = new Date(Date.now() + dias * 86_400_000);
    await prisma.task.create({ data: {
      tenantId, tipo: "vacio-sanitario", sector: "engorde", alcance: "lote", growingBatchId: lote.id, targetLabel: `Sitio ${lote.sitio}`,
      titulo: `Vacío sanitario · ${lote.sitio}`,
      descripcion: `Lote ${lote.batchCode} cerrado: lavar, desinfectar y dejar vacío el sitio ${dias} días. No entra otro lote antes del ${hasta.toLocaleDateString("es-PY", { timeZone: "America/Asuncion" })}.`,
      prioridad: "hoy", fechaVencimiento: new Date(), responsableNombre: "Jefatura de Producción", generadaPor: "sistema", disparador: `vacio-${lote.id}`,
    } }).catch(e => console.error("[vacío sanitario]", e));
  }

  return NextResponse.json(updated);
}
