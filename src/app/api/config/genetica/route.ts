import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const soloActivas = req.nextUrl.searchParams.get("activas") === "1";
  const funcion = req.nextUrl.searchParams.get("funcion"); // MATERNA | PATERNA
  const genetica = await prisma.genetica.findMany({
    where: {
      tenantId,
      ...(soloActivas ? { activa: true } : {}),
      ...(funcion ? { funcion: funcion as "MATERNA" | "PATERNA" } : {}),
    },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(genetica);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { nombre, tipoGenetico, funcion, composicionRacial } = body;
  if (!nombre || !tipoGenetico || !funcion || !composicionRacial) {
    return NextResponse.json({ error: "nombre, tipoGenetico, funcion y composicionRacial son requeridos" }, { status: 400 });
  }

  const existe = await prisma.genetica.findUnique({ where: { tenantId_nombre: { tenantId, nombre } } });
  if (existe) return NextResponse.json({ error: "Ya existe una genética con ese nombre" }, { status: 409 });

  const genetica = await prisma.genetica.create({
    data: { tenantId, activa: true, ...body },
  });
  return NextResponse.json(genetica, { status: 201 });
}
