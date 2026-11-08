import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export const dynamic = "force-dynamic";

const CAUSE_LABELS: Record<string, string> = {
  WEAKNESS: "Flaqueza", CRUSHING: "Aplastamiento", DIARRHEA: "Diarrea",
  DEFICIENT: "Deficiente", DISEASE: "Enfermedad", SHELTER: "Refugio",
  HYPOTHERMIA: "Hipotermia", ACCIDENT: "Accidente", CONGENITAL: "Defecto congénito",
  ELIMINATED: "Eliminado", OTHER: "Otra",
};

const deathSchema = z.object({
  deathDate:  z.string().min(1),
  quantity:   z.number().int().min(1),
  cause:      z.enum(["WEAKNESS","CRUSHING","DIARRHEA","DEFICIENT","DISEASE","SHELTER","HYPOTHERMIA","ACCIDENT","CONGENITAL","ELIMINATED","OTHER"]),
  ageAtDeath: z.number().int().min(0).optional(),
  notes:      z.string().optional(),
});

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "destete.eventos.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "destete.eventos.crear" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const batch = await prisma.nurseryBatch.findFirst({ where: { id: params.id, tenantId } });
  if (!batch) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  const body  = await req.json();
  const parse = deathSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Datos inválidos", details: parse.error.issues }, { status: 422 });

  const { deathDate, quantity, cause, ageAtDeath, notes } = parse.data;

  if (quantity > batch.currentCount) {
    return NextResponse.json({ error: `Cantidad (${quantity}) supera el stock actual (${batch.currentCount})` }, { status: 422 });
  }

  const causeLabel = CAUSE_LABELS[cause] ?? cause;

  await prisma.$transaction([
    prisma.nurseryBatch.update({
      where: { id: params.id },
      data:  { currentCount: { decrement: quantity } },
    }),
    prisma.animalEvent.create({
      data: {
        tenantId,
        eventType:   "DEATH",
        eventDate:   new Date(deathDate),
        description: `Muerte en lote ${batch.batchCode}: ${quantity} animal${quantity > 1 ? "es" : ""} — ${causeLabel}`,
        moduleSource: "RECRIA",
        userId:       session.user.id,
        metadata: { batchId: batch.id, batchCode: batch.batchCode, quantity, cause, ageAtDeath, notes },
      },
    }),
  ]);

  return NextResponse.json({ newCount: batch.currentCount - quantity });
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const events = await prisma.animalEvent.findMany({
    where: { tenantId, eventType: "DEATH", moduleSource: "RECRIA" },
    orderBy: { eventDate: "desc" },
  });

  const deaths = events.filter(e => {
    const meta = e.metadata as Record<string, unknown> | null;
    return meta?.batchId === params.id;
  });

  return NextResponse.json(deaths);
}
