export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { generarTareasDiarias } from "@/lib/tasks/generate";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const sp          = req.nextUrl.searchParams;
  const periodo     = sp.get("periodo") ?? "semana";  // hoy | semana | mes
  const sector      = sp.get("sector")  ?? "";
  const responsable = sp.get("responsable") ?? "";

  const now     = new Date();
  const today   = new Date(now); today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

  let until: Date;
  if (periodo === "hoy") {
    until = todayEnd;
  } else if (periodo === "mes") {
    until = new Date(today); until.setDate(until.getDate() + 30); until.setHours(23, 59, 59, 999);
  } else {
    until = new Date(today); until.setDate(until.getDate() + 7); until.setHours(23, 59, 59, 999);
  }

  // Generar tareas diarias si no existen
  await generarTareasDiarias(tenantId).catch(() => {});

  const where: Record<string, unknown> = {
    tenantId,
    ...(sector      ? { sector }                              : {}),
    ...(responsable ? { responsableKey: responsable }         : {}),
    OR: [
      { fechaCompletada: null, fechaVencimiento: { lte: until } },
      { fechaCompletada: { gte: today, lte: todayEnd } },
    ],
  };

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { fechaVencimiento: "asc" },
    take: 300,
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
      fechaVencimiento: t.fechaVencimiento.toISOString(),
      fechaCompletada:  t.fechaCompletada?.toISOString() ?? null,
      createdAt:        t.createdAt.toISOString(),
      updatedAt:        t.updatedAt.toISOString(),
    };
  });

  const urgente    = result.filter(t => t.prioridad === "urgente").length;
  const hoy        = result.filter(t => t.prioridad === "hoy").length;
  const programada = result.filter(t => t.prioridad === "programada").length;
  const completada = result.filter(t => t.prioridad === "completada").length;
  const sinResp    = result.filter(t => !t.responsableNombre && t.prioridad !== "completada").length;
  const manana     = result.filter(t => {
    const diff = Math.floor((new Date(t.fechaVencimiento).getTime() - today.getTime()) / 86400000);
    return diff === 1 && !t.fechaCompletada;
  }).length;

  return NextResponse.json({ tasks: result, kpis: { urgente, hoy, programada, completada, sinResp, manana } });
}
