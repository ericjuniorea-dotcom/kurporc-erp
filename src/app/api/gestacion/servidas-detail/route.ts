export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  // Configuración de plazos de seguimiento
  const config = await prisma.configProceso.findFirst({
    where: { tenantId, modulo: "GESTACION", procesoKey: "protocolo_seguimiento_servicio" },
  });
  const cv            = (config?.valor ?? {}) as Record<string, unknown>;
  const diasCelo      = Number(cv.dias_confirmacion_celo ?? 21);
  const diasEcografia = Number(cv.dias_ecografia         ?? 28);

  // Misma fuente de verdad que el KPI
  const states  = await getGestacionStates(tenantId);
  const servidas = states.filter(s => s.estado === "SERVIDA");

  // Cargar datos de sow
  const sowIds = servidas.map(s => s.sowId);
  const sows = sowIds.length > 0
    ? await prisma.sow.findMany({
        where:  { id: { in: sowIds } },
        select: { id: true, identCode: true, caravanaCode: true, galponAssigned: true, corralAssigned: true },
      })
    : [];
  const sowMap = new Map(sows.map(s => [s.id, s]));

  const result = servidas.map(s => {
    const sow           = sowMap.get(s.sowId);
    const msServicio    = s.serviceDate.getTime();
    const galpon        = sow?.galponAssigned ?? "";
    const corral        = sow?.corralAssigned ?? "";
    return {
      sowId:                s.sowId,
      caravana:             sow?.caravanaCode ?? sow?.identCode ?? s.sowId,
      ubicacion:            [galpon, corral].filter(Boolean).join(" – ") || "—",
      galpon,
      serviceDate:          s.serviceDate.toISOString().slice(0, 10),
      diasDesdeServicio:    s.diasDesdeServ,
      fechaConfirmacionCelo: new Date(msServicio + diasCelo      * 86400000).toISOString().slice(0, 10),
      fechaEcografia:        new Date(msServicio + diasEcografia * 86400000).toISOString().slice(0, 10),
      diagnostico:           s.checkResult,
    };
  }).sort((a, b) => b.diasDesdeServicio - a.diasDesdeServicio);

  return NextResponse.json({ servidas: result, diasCelo, diasEcografia });
}
