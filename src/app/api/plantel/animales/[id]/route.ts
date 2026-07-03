import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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

  return NextResponse.json(sow);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const canEdit = session.user.roles.some((r: number) => [1, 2].includes(r));
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
