import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const modulo = req.nextUrl.searchParams.get("modulo");
  const where = { tenantId, ...(modulo ? { modulo } : {}) };

  const alertas = await prisma.configAlerta.findMany({ where, orderBy: [{ modulo: "asc" }, { eventoKey: "asc" }] });
  return NextResponse.json(alertas);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { modulo, eventoKey, umbral, canales, activa, gravedad } = body;
  if (!modulo || !eventoKey) {
    return NextResponse.json({ error: "modulo y eventoKey son requeridos" }, { status: 400 });
  }

  const alerta = await prisma.configAlerta.upsert({
    where: { tenantId_modulo_eventoKey: { tenantId, modulo, eventoKey } },
    create: { tenantId, modulo, eventoKey, umbral, canales: canales ?? [], activa: activa ?? true, gravedad: gravedad ?? "WARNING", updatedAt: new Date() },
    update: { umbral, canales: canales ?? [], activa: activa ?? true, gravedad: gravedad ?? "WARNING", updatedAt: new Date() },
  });
  return NextResponse.json(alerta);
}
