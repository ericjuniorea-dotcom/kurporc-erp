import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const modulo = req.nextUrl.searchParams.get("modulo");
  const where = { tenantId, ...(modulo ? { modulo } : {}), activa: true };

  const vacunas = await prisma.configVacuna.findMany({ where, orderBy: [{ modulo: "asc" }, { nombreVacuna: "asc" }] });
  return NextResponse.json(vacunas);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "sanidad.protocolos.editar")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "sanidad.protocolos.editar" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { modulo, nombreVacuna, marcaComercial, laboratorio, principioActivo, viaAplicacion, dosisMl, momentoAplicacion, paisProcedencia, tempConservacion } = body;

  if (!modulo || !nombreVacuna || !marcaComercial || !laboratorio || !principioActivo || !viaAplicacion || !dosisMl || !momentoAplicacion || !paisProcedencia || !tempConservacion) {
    return NextResponse.json({ error: "Campos obligatorios incompletos" }, { status: 400 });
  }

  const vacuna = await prisma.configVacuna.create({
    data: { tenantId, activa: true, ...body },
  });
  return NextResponse.json(vacuna, { status: 201 });
}
