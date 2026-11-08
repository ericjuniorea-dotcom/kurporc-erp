import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import { jsonConMontos } from "@/lib/permisos/montos";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["plantel.animales.ver", "gestacion.servicios.ver", "maternidad.partos.ver", "sanidad.aplicaciones.ver", "destete.lotes.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const sow = await prisma.sow.findFirst({
    where: { id: params.id, tenantId },
    include: {
      animalEvents: {
        orderBy: { eventDate: "desc" },
        take: 5,
        select: { id: true, eventType: true, eventDate: true, description: true, moduleSource: true },
      },
    },
  });

  if (!sow) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return jsonConMontos(sow);
}

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const canEdit = puede(await getPermisos(), "plantel.animales.editar");
  if (!canEdit) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const tenantId = session.user.tenantId;
  const body = await req.json();
  const { caravanaCode, tattooCode, rfidChip, breed, geneticLine,
    galponAssigned, corralAssigned, plantelNotes, sourceProvider,
    damCodeOrigin, sireCodeOrigin, birthDate } = body;

  const updated = await prisma.sow.update({
    where: { id: params.id },
    data: {
      caravanaCode, tattooCode, rfidChip, breed, geneticLine,
      galponAssigned, corralAssigned, plantelNotes, sourceProvider,
      damCodeOrigin, sireCodeOrigin,
      ...(birthDate ? { birthDate: new Date(birthDate) } : {}),
    },
  });

  // Verify belongs to tenant
  if (updated.tenantId !== tenantId) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  return NextResponse.json(updated);
}
