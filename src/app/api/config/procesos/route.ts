import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const modulo = req.nextUrl.searchParams.get("modulo");
  const where = { tenantId, ...(modulo ? { modulo } : {}) };

  const procesos = await prisma.configProceso.findMany({ where, orderBy: [{ modulo: "asc" }, { procesoKey: "asc" }] });
  return NextResponse.json(procesos);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;
  const userId = session.user.id;

  const body = await req.json();
  const { modulo, procesoKey, valor } = body;
  if (!modulo || !procesoKey || valor === undefined) {
    return NextResponse.json({ error: "modulo, procesoKey y valor son requeridos" }, { status: 400 });
  }

  const proceso = await prisma.configProceso.upsert({
    where: { tenantId_modulo_procesoKey: { tenantId, modulo, procesoKey } },
    create: { tenantId, modulo, procesoKey, valor, updatedBy: userId },
    update: { valor, updatedBy: userId, updatedAt: new Date() },
  });
  return NextResponse.json(proceso);
}
