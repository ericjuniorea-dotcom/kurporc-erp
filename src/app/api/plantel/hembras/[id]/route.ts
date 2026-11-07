import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId as string;
  const userId   = (session.user as any).id as string;

  const sow = await prisma.sow.findFirst({ where: { id: params.id, tenantId } });
  if (!sow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { action, cause, notes, newState } = body;

  if (action === "register_death") {
    const prevState = sow.plantelState;
    const updated = await prisma.sow.update({
      where: { id: params.id },
      data: {
        plantelState: "DEAD",
        isActive: false,
        animalEvents: {
          create: {
            tenantId,
            eventType: "DEATH",
            eventDate: new Date(),
            previousState: prevState ?? undefined,
            newState: "DEAD",
            description: `Muerte registrada. Causa: ${cause || "No especificada"}`,
            moduleSource: "PLANTEL",
            userId,
            metadata: { notes },
          },
        },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "register_discard") {
    const prevState = sow.plantelState;
    const updated = await prisma.sow.update({
      where: { id: params.id },
      data: {
        plantelState: "CULLED",
        isActive: false,
        animalEvents: {
          create: {
            tenantId,
            eventType: "DISCARD",
            eventDate: new Date(),
            previousState: prevState ?? undefined,
            newState: "CULLED",
            description: `Descarte registrado. Causa: ${cause || "No especificada"}`,
            moduleSource: "PLANTEL",
            userId,
            metadata: { notes },
          },
        },
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "quarantine_release" && sow.plantelState === "QUARANTINE") {
    const updated = await prisma.sow.update({
      where: { id: params.id },
      data: {
        plantelState: "REPLACEMENT_DEVELOPING",
        animalEvents: {
          create: {
            tenantId,
            eventType: "STATE_CHANGE",
            eventDate: new Date(),
            previousState: "QUARANTINE",
            newState: "REPLACEMENT_DEVELOPING",
            description: "Alta sanitaria post-cuarentena",
            moduleSource: "PLANTEL",
            userId,
          },
        },
      },
    });
    return NextResponse.json(updated);
  }

  // Generic update (identification fields)
  const { caravanaCode, tattooCode, rfidChip, breed, geneticLine,
    galponAssigned, corralAssigned, plantelNotes } = body;

  const updated = await prisma.sow.update({
    where: { id: params.id },
    data: { caravanaCode, tattooCode, rfidChip, breed, geneticLine,
      galponAssigned, corralAssigned, plantelNotes },
  });
  return NextResponse.json(updated);
}
