export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["gestacion.servicios.ver", "gestacion.diagnosticos.ver", "gestacion.lotes_reproductivos.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const { tenantId } = session.user;

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  // Misma fuente de verdad que el KPI y la modal de servidas
  const states   = await getGestacionStates(tenantId);
  const pendientes = states.filter(s => s.estado === "SERVIDA");

  // Cargar identCode de cerdas
  const sowIds = pendientes.map(s => s.sowId);
  const sows = sowIds.length > 0
    ? await prisma.sow.findMany({
        where:  { id: { in: sowIds } },
        select: { id: true, identCode: true },
      })
    : [];
  const sowMap = new Map(sows.map(s => [s.id, s.identCode]));

  // Cargar último check que no sea PREGNANT (para mostrar badge)
  const serviceEventIds = pendientes.map(s => s.serviceEventId);
  const lastChecks = serviceEventIds.length > 0
    ? await prisma.pregnancyCheck.findMany({
        where:   { serviceEventId: { in: serviceEventIds } },
        orderBy: { checkDate: "desc" },
        select:  { serviceEventId: true, result: true },
      })
    : [];
  const lastCheckByEvent = new Map<string, string>();
  for (const c of lastChecks) {
    if (!lastCheckByEvent.has(c.serviceEventId)) {
      lastCheckByEvent.set(c.serviceEventId, c.result);
    }
  }

  const result = pendientes.map(s => {
    const diasPostServicio = s.diasDesdeServ;
    const diasVencimiento  = diasPostServicio - 28;
    const ultimoDiagnostico = lastCheckByEvent.get(s.serviceEventId) ?? null;
    return {
      serviceEventId:    s.serviceEventId,
      sowId:             s.sowId,
      identCode:         sowMap.get(s.sowId) ?? s.sowId,
      plantelState:      s.plantelState,
      fechaServicio:     s.serviceDate.toISOString(),
      diasPostServicio,
      diasVencimiento,
      ultimoDiagnostico,
    };
  });

  return NextResponse.json(result);
}
