import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

// PATCH /api/sanidad/assign — asignar responsable a una tarea sanitaria
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isChief = puede(await getPermisos(), "tareas.tareas.asignar");
  if (!isChief) return NextResponse.json({ error: "Solo el jefe de producción puede asignar tareas" }, { status: 403 });

  const { healthTaskId, assignedToId } = await req.json();
  if (!healthTaskId) return NextResponse.json({ error: "healthTaskId requerido" }, { status: 400 });

  const task = await prisma.healthTask.findFirst({
    where: { id: healthTaskId, tenantId: session.user.tenantId },
  });
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

  const updated = await prisma.healthTask.update({
    where: { id: healthTaskId },
    data: { assignedToId: assignedToId ?? null },
  });
  return NextResponse.json(updated);
}
