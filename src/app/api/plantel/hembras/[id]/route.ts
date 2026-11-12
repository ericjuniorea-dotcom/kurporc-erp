import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { darDeBajaCerda, ErrorBaja } from "@/lib/plantel/baja";

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "plantel.animales.editar")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "plantel.animales.editar" }, { status: 403 });
  const tenantId = (session.user as any).tenantId as string;
  const userId   = (session.user as any).id as string;

  const sow = await prisma.sow.findFirst({ where: { id: params.id, tenantId } });
  if (!sow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { action, cause, notes, newState } = body;

  if (action === "register_death" || action === "register_discard") {
    try {
      const r = await darDeBajaCerda({ tenantId, sowId: params.id, userId, tipo: action === "register_death" ? "MUERTE" : "DESCARTE", fecha: new Date(), motivo: String(cause || "No especificada").slice(0, 300), extra: { observaciones: notes ?? null } });
      return NextResponse.json(r.sow);
    } catch (e) {
      if (e instanceof ErrorBaja) return NextResponse.json({ error: e.message, codigo: e.codigo }, { status: e.codigo === "NO_EXISTE" ? 404 : 409 });
      throw e;
    }
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
