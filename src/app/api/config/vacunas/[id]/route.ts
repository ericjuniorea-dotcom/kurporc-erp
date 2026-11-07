import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const v = await prisma.configVacuna.findFirst({ where: { id: params.id, tenantId } });
  if (!v) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Nunca se aceptan desde el cliente: id, organización ni fechas de sistema (evita mover el registro a otra organización)
  const { id: _id, tenantId: _t, createdAt: _c, updatedAt: _u, ...body } = await req.json();
  const updated = await prisma.configVacuna.update({ where: { id: params.id }, data: { ...body, updatedAt: new Date() } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const v = await prisma.configVacuna.findFirst({ where: { id: params.id, tenantId } });
  if (!v) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.configVacuna.update({ where: { id: params.id }, data: { activa: false } });
  return NextResponse.json({ ok: true });
}
