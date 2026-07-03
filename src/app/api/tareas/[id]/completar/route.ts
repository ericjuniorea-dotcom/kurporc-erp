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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const task = await prisma.task.findFirst({ where: { id: params.id, tenantId } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.floor((task.fechaVencimiento.getTime() - today.getTime()) / 86400000);
  const prioridad = diff < 0 ? "urgente" : diff === 0 ? "hoy" : "programada";

  await prisma.task.update({
    where: { id: params.id },
    data: { fechaCompletada: null, prioridad, completadaPor: null },
  });

  return NextResponse.json({ ok: true });
}
