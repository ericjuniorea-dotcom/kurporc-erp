import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const genetica = await prisma.genetica.findFirst({ where: { id: params.id, tenantId } });
  if (!genetica) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Nunca se aceptan desde el cliente: id, organización ni fechas de sistema (evita mover el registro a otra organización)
  const { id: _id, tenantId: _t, createdAt: _c, updatedAt: _u, ...body } = await req.json();
  const updated = await prisma.genetica.update({ where: { id: params.id }, data: { ...body, updatedAt: new Date() } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const genetica = await prisma.genetica.findFirst({ where: { id: params.id, tenantId } });
  if (!genetica) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.genetica.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
