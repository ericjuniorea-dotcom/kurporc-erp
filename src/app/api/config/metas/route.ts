import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const modulo = req.nextUrl.searchParams.get("modulo");
  const where = modulo ? { tenantId, modulo } : { tenantId };

  const metas = await prisma.configMeta.findMany({ where, orderBy: [{ modulo: "asc" }, { kpiKey: "asc" }] });
  return NextResponse.json(metas);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;
  const userId = session.user.id;

  const body = await req.json();
  const { modulo, kpiKey, valor } = body;
  if (!modulo || !kpiKey || valor === undefined) {
    return NextResponse.json({ error: "modulo, kpiKey y valor son requeridos" }, { status: 400 });
  }

  const meta = await prisma.configMeta.upsert({
    where: { tenantId_modulo_kpiKey: { tenantId, modulo, kpiKey } },
    create: { tenantId, modulo, kpiKey, valor, updatedBy: userId },
    update: { valor, updatedBy: userId, updatedAt: new Date() },
  });
  return NextResponse.json(meta);
}
