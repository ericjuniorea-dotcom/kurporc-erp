export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const sp    = req.nextUrl.searchParams;
  const year  = parseInt(sp.get("year")  ?? String(new Date().getFullYear()));
  const month = parseInt(sp.get("month") ?? String(new Date().getMonth() + 1));

  const desde = new Date(year, month - 1, 1);
  const hasta = new Date(year, month, 0, 23, 59, 59);

  const eventos = await prisma.eventoVacunacion.findMany({
    where: { tenantId, fecha: { gte: desde, lte: hasta }, estado: { not: "omitido" } },
    include: { vacuna: { select: { nombre: true, enfermedad: true, criticidad: true } } },
    orderBy: { fecha: "asc" },
  });

  // Group by day
  const byDay: Record<number, typeof eventos> = {};
  for (const e of eventos) {
    const day = e.fecha.getDate();
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(e);
  }

  const days = Object.entries(byDay).map(([day, evs]) => ({
    day: parseInt(day),
    eventos: evs.map(e => ({
      id:             e.id,
      vacunaNombre:   e.vacuna.nombre,
      enfermedad:     e.vacuna.enfermedad,
      criticidad:     e.vacuna.criticidad,
      sector:         e.sector,
      targetLabel:    e.targetLabel,
      dosisNecesarias: e.dosisNecesarias,
      estado:         e.estado,
      fecha:          e.fecha.toISOString(),
    })),
    totalDosis: evs.reduce((s, e) => s + e.dosisNecesarias, 0),
    tieneUrgente: evs.some(e => e.estado === "pendiente" || e.estado === "retrasado"),
    todoAplicado: evs.every(e => e.estado === "aplicado"),
  }));

  return NextResponse.json({ year, month, days });
}
