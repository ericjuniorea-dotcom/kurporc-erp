import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

function colorForModule(module: string): string {
  switch (module) {
    case "PLANTEL":   return "var(--success)";
    case "GESTACION": return "var(--info)";
    case "MATERNIDAD":return "var(--accent)";
    case "SANIDAD":   return "var(--warning)";
    default:           return "var(--text-muted)";
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const sow = await prisma.sow.findFirst({
    where: { id: params.id, tenantId },
    select: { id: true },
  });
  if (!sow) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const [animalEvents, servicios, partos] = await Promise.all([
    prisma.animalEvent.findMany({
      where: { tenantId, sowId: params.id },
      orderBy: { eventDate: "desc" },
    }),
    prisma.serviceEvent.findMany({
      where: { sowId: params.id, tenantId },
      orderBy: { serviceDate: "desc" },
      select: { id: true, serviceDate: true, serviceType: true, notes: true },
    }),
    prisma.farrowingEvent.findMany({
      where: { sowId: params.id, tenantId },
      orderBy: { startDatetime: "desc" },
      select: { id: true, startDatetime: true, bornAlive: true, bornDead: true, totalBorn: true },
    }),
  ]);

  const events: Array<{
    id: string;
    date: string;
    type: string;
    description: string;
    module: string;
    color: string;
  }> = [];

  for (const e of animalEvents) {
    events.push({
      id:          e.id,
      date:        e.eventDate.toISOString(),
      type:        e.eventType,
      description: e.description ?? e.eventType,
      module:      e.moduleSource ?? "PLANTEL",
      color:       colorForModule(e.moduleSource ?? "PLANTEL"),
    });
  }

  // Add service events not already present as AnimalEvents
  const seenServiceIds = new Set(
    animalEvents
      .map(ae => (ae.metadata as Record<string, unknown> | null)?.serviceEventId as string | undefined)
      .filter(Boolean),
  );
  for (const s of servicios) {
    if (!seenServiceIds.has(s.id)) {
      events.push({
        id:          `svc-${s.id}`,
        date:        s.serviceDate.toISOString(),
        type:        "SERVICE",
        description: `Servicio ${s.serviceType === "AI" ? "IA" : "Monta Natural"}${s.notes ? ` — ${s.notes}` : ""}`,
        module:      "GESTACION",
        color:       "var(--info)",
      });
    }
  }

  // Add farrowing events not already present
  const seenFarrowingIds = new Set(
    animalEvents
      .map(ae => (ae.metadata as Record<string, unknown> | null)?.farrowingId as string | undefined)
      .filter(Boolean),
  );
  for (const p of partos) {
    if (!seenFarrowingIds.has(p.id)) {
      events.push({
        id:          `far-${p.id}`,
        date:        p.startDatetime.toISOString(),
        type:        "FARROWING",
        description: `Parto — ${p.bornAlive} nacidos vivos, ${p.bornDead} muertos (total ${p.totalBorn})`,
        module:      "MATERNIDAD",
        color:       "var(--accent)",
      });
    }
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ events });
}
