import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const soloActivas = req.nextUrl.searchParams.get("activas") === "1";
  const razas = await prisma.configRaza.findMany({
    where: { tenantId, ...(soloActivas ? { activa: true } : {}) },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(razas);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { nombre, tipoLinea, usoPrincipal } = body;
  if (!nombre || !tipoLinea || !usoPrincipal) {
    return NextResponse.json({ error: "nombre, tipoLinea y usoPrincipal son requeridos" }, { status: 400 });
  }

  const existe = await prisma.configRaza.findUnique({ where: { tenantId_nombre: { tenantId, nombre } } });
  if (existe) return NextResponse.json({ error: "Ya existe una raza con ese nombre" }, { status: 409 });

  const raza = await prisma.configRaza.create({
    data: { tenantId, nombre, tipoLinea, usoPrincipal, activa: true, ...body },
  });
  return NextResponse.json(raza, { status: 201 });
}
