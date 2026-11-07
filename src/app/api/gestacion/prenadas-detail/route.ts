export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const today = new Date();

  // Misma fuente de verdad que el KPI
  const states = await getGestacionStates(tenantId);
  const prenadas = states.filter(s => s.estado === "PRENADA");

  // Cargar datos de sow para las preñadas
  const sowIds = prenadas.map(s => s.sowId);
  const sows = sowIds.length > 0
    ? await prisma.sow.findMany({
        where:  { id: { in: sowIds } },
        select: { id: true, identCode: true, caravanaCode: true, galponAssigned: true, corralAssigned: true },
      })
    : [];
  const sowMap = new Map(sows.map(s => [s.id, s]));

  const result = prenadas.map(s => {
    const sow = sowMap.get(s.sowId);
    const fechaPartoProyectada = new Date(s.serviceDate.getTime() + 114 * 86400000)
      .toISOString().slice(0, 10);
    const galpon    = sow?.galponAssigned ?? "";
    const corral    = sow?.corralAssigned ?? "";
    return {
      sowId:               s.sowId,
      caravana:            sow?.caravanaCode ?? sow?.identCode ?? s.sowId,
      ubicacion:           [galpon, corral].filter(Boolean).join(" – ") || "—",
      galpon,
      corral,
      diasGestacion:       s.diasDesdeServ,
      fechaPartoProyectada,
    };
  }).sort((a, b) => b.diasGestacion - a.diasGestacion);

  return NextResponse.json(result);
}
