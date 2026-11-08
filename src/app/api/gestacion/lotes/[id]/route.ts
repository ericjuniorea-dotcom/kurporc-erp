export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

// Super Admin (1), Admin de granja (2), Jefe de Producción (5) — únicos
// roles que pueden eliminar un lote reproductivo.

/**
 * Elimina un lote de servicio (código explícito). Las cerdas que ya fueron
 * servidas dentro de ese lote NO pierden su registro de servicio — si el
 * lote tiene ServiceEvents asociados, solo se le quita el nombre/código
 * (vuelve a ser un agrupado automático por semana, invisible en "Lotes"),
 * sin tocar los ServiceEvent. Si el lote está vacío (nunca se sirvió
 * ninguna cerda), se borra por completo.
 */
export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!puede(await getPermisos(), "gestacion.lotes_reproductivos.editar")) {
    return NextResponse.json({ error: "Solo un Administrador o el Jefe de Producción puede eliminar lotes" }, { status: 403 });
  }

  const tenantId = session.user.tenantId;

  const batch = await prisma.serviceBatch.findFirst({
    where: { id: params.id, tenantId, code: { not: null } },
  });
  if (!batch) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  const serviceCount = await prisma.serviceEvent.count({ where: { serviceBatchId: batch.id } });

  if (serviceCount === 0) {
    await prisma.serviceBatch.delete({ where: { id: batch.id } });
    return NextResponse.json({ deleted: true, keptServiced: 0 });
  }

  // No se puede borrar la fila (hay ServiceEvent referenciándola) ni se debe:
  // las cerdas servidas deben conservar su registro. Se le quita el
  // código/observaciones para que deje de figurar como "lote" con nombre.
  await prisma.serviceBatch.update({
    where: { id: batch.id },
    data:  { code: null, notes: null },
  });

  return NextResponse.json({ deleted: true, keptServiced: serviceCount });
}
