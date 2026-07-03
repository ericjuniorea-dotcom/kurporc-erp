import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId as string;
  const userId   = (session.user as any).id as string;

  const boar = await prisma.boar.findFirst({ where: { id: params.id, tenantId } });
  if (!boar) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { action, cause, notes } = body;

  if (action === "register_death") {
    const updated = await prisma.boar.update({
      where: { id: params.id },
      data: {
        plantelState: "DEAD",
        isActive: false,
        animalEvents: {
          create: {
            tenantId, eventType: "DEATH", eventDate: new Date(),
            previousState: boar.plantelState ?? undefined,
            newState: "DEAD",
            description: `Muerte registrada. Causa: ${cause || "No especificada"}`,
            moduleSource: "PLANTEL", userId,
            metadata: { notes },
          },
        },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "register_discard") {
    const updated = await prisma.boar.update({
      where: { id: params.id },
      data: {
        plantelState: "CULLED",
        isActive: false,
        animalEvents: {
          create: {
            tenantId, eventType: "DISCARD", eventDate: new Date(),
            previousState: boar.plantelState ?? undefined,
            newState: "CULLED",
            description: `Descarte registrado. Causa: ${cause || "No especificada"}`,
            moduleSource: "PLANTEL", userId,
            metadata: { notes },
          },
        },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "quarantine_release") {
    const updated = await prisma.boar.update({
      where: { id: params.id },
      data: {
        plantelState: "ACTIVE",
        animalEvents: {
          create: {
            tenantId, eventType: "STATE_CHANGE", eventDate: new Date(),
            previousState: "QUARANTINE", newState: "ACTIVE",
            description: "Alta sanitaria post-cuarentena",
            moduleSource: "PLANTEL", userId,
          },
        },
      },
    });
    return NextResponse.json(updated);
  }

  const { caravanaCode, tattooCode, rfidChip, breed, geneticLine,
    galponAssigned, corralAssigned, plantelNotes } = body;
  const updated = await prisma.boar.update({
    where: { id: params.id },
    data: { caravanaCode, tattooCode, rfidChip, breed, geneticLine,
      galponAssigned, corralAssigned, plantelNotes },
  });
  return NextResponse.json(updated);
}
