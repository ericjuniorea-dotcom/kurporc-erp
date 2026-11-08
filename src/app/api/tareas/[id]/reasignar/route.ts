export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "tareas.tareas.asignar")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "tareas.tareas.asignar" }, { status: 403 });

  const { tenantId } = session.user;
  const { responsableNombre, responsableKey } = await req.json();

  if (!responsableNombre || !responsableKey) {
    return NextResponse.json({ error: "responsableNombre y responsableKey requeridos" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({ where: { id: params.id, tenantId } });
  if (!task) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

  const updated = await prisma.task.update({
    where: { id: params.id },
    data: { responsableNombre, responsableKey },
  });

  return NextResponse.json(updated);
}
