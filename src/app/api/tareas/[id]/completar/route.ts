export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "tareas.tareas.completar")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "tareas.tareas.completar" }, { status: 403 });
  const { tenantId } = session.user;

  const body = await req.json().catch(() => ({}));

  const task = await prisma.task.findFirst({ where: { id: params.id, tenantId } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.task.update({
    where: { id: params.id },
    data: {
      fechaCompletada: new Date(),
      prioridad:       "completada",
      completadaPor:   session.user.name ?? "Sistema",
      notas:           body.notas ?? task.notas ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "tareas.tareas.completar")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "tareas.tareas.completar" }, { status: 403 });
  const { tenantId } = session.user;

  const task = await prisma.task.findFirst({ where: { id: params.id, tenantId } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date();today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((task.fechaVencimiento.getTime() - today.getTime()) / 86400000);
  const prioridad = diff < 0 ? "urgente" : diff === 0 ? "hoy" : "programada";

  await prisma.task.update({
    where: { id: params.id },
    data: { fechaCompletada: null, prioridad, completadaPor: null },
  });

  return NextResponse.json({ ok: true });
}
