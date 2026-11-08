import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["sanidad.aplicaciones.ver", "sanidad.tratamientos.ver", "sanidad.protocolos.ver", "sanidad.necropsias.ver", "sanidad.botiquin.ver", "tareas.tareas.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const onlyPending = searchParams.get("pending") !== "false";
  const farrowingId = searchParams.get("farrowingId");
  const overdueOnly = searchParams.get("overdue") === "true";

  const today = new Date();

  const tasks = await prisma.healthTask.findMany({
    where: {
      tenantId:    session.user.tenantId,
      ...(onlyPending ? { isCompleted: false } : {}),
      ...(farrowingId ? { farrowingId } : {}),
      ...(overdueOnly ? { dueDate: { lt: today } } : {}),
    },
    include: {
      protocolTask: {
        select: {
          taskName: true,
          taskType: true,
          doseMl:   true,
          route:    true,
          medicine: { select: { name: true, withdrawalDays: true } },
        },
      },
      farrowing: {
        select: {
          id:    true,
          startDatetime: true,
          sow:   { select: { identCode: true } },
          pen:   { select: { number: true } },
        },
      },
      completion: true,
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: [{ isCompleted: "asc" }, { dueDate: "asc" }],
    take:    300,
  });

  const enriched = tasks.map((t) => ({
    ...t,
    isOverdue:    !t.isCompleted && t.dueDate < today,
    daysUntilDue: Math.ceil((t.dueDate.getTime() - today.getTime()) / 86400000),
  }));

  return NextResponse.json(enriched);
}
