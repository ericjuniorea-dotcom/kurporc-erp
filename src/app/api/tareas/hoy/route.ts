export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { generarTareasDiarias } from "@/lib/tasks/generate";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const sector  = req.nextUrl.searchParams.get("sector") ?? undefined;
  const horizon = 7;

  const now     = new Date();
  const today   = new Date(now); today.setHours(0, 0, 0, 0);
  const until   = new Date(today); until.setDate(until.getDate() + horizon); until.setHours(23, 59, 59, 999);
  const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

  // Generar tareas diarias si no existen aún
  await generarTareasDiarias(tenantId).catch(() => {});

  const tasks = await prisma.task.findMany({
    where: {
      tenantId,
      ...(sector ? { sector } : {}),
      OR: [
        { fechaCompletada: null, fechaVencimiento: { lte: until } },
        { fechaCompletada: { gte: today, lte: todayEnd } },
      ],
    },
    orderBy: { fechaVencimiento: "asc" },
    take: 100,
  });

  const result = tasks.map(t => {
    let prioridad = t.prioridad;
    if (!t.fechaCompletada) {
      const diff = Math.floor((t.fechaVencimiento.getTime() - today.getTime()) / 86400000);
      if (diff < 0)        prioridad = "urgente";
      else if (diff === 0) prioridad = "hoy";
      else                 prioridad = "programada";
    } else {
      prioridad = "completada";
    }
    return {
      ...t,
      prioridad,
      fechaVencimiento:  t.fechaVencimiento.toISOString(),
      fechaCompletada:   t.fechaCompletada?.toISOString() ?? null,
      createdAt:         t.createdAt.toISOString(),
      updatedAt:         t.updatedAt.toISOString(),
    };
  });

  const urgente    = result.filter(t => t.prioridad === "urgente").length;
  const hoy        = result.filter(t => t.prioridad === "hoy").length;
  const programada = result.filter(t => t.prioridad === "programada").length;
  const completada = result.filter(t => t.prioridad === "completada").length;

  return NextResponse.json({ tasks: result, urgente, hoy, programada, completada });
}
