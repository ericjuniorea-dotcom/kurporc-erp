export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

const BUCKETS = [
  { rango: "≤21",   min: 0,  max: 21  },
  { rango: "22-42", min: 22, max: 42  },
  { rango: "43-63", min: 43, max: 63  },
  { rango: "64-90", min: 64, max: 90  },
  { rango: ">90",   min: 91, max: 999 },
];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["gestacion.servicios.ver", "gestacion.diagnosticos.ver", "gestacion.lotes_reproductivos.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const { tenantId } = session.user;

  // Misma fuente de verdad que todos los demás endpoints
  const states = await getGestacionStates(tenantId);

  const bucketCounts = BUCKETS.map(b => ({ ...b, count: 0 }));
  const inconsistencias: {
    sowId: string; caravana: string; ubicacion: string;
    diasGestacion: number; fechaPartoProyectada: string; problema: string;
  }[] = [];

  // Cargar datos de sow para las preñadas e inconsistencias
  const relevantSowIds = states.map(s => s.sowId);
  const sows = relevantSowIds.length > 0
    ? await prisma.sow.findMany({
        where:  { id: { in: relevantSowIds } },
        select: { id: true, identCode: true, caravanaCode: true, galponAssigned: true, corralAssigned: true },
      })
    : [];
  const sowMap = new Map(sows.map(s => [s.id, s]));

  for (const s of states) {
    const sow      = sowMap.get(s.sowId);
    const caravana = sow?.caravanaCode ?? sow?.identCode ?? s.sowId;
    const ubicacion = [sow?.galponAssigned, sow?.corralAssigned].filter(Boolean).join(" – ") || "—";
    const fechaPartoProyectada = new Date(s.serviceDate.getTime() + 114 * 86400000)
      .toISOString().slice(0, 10);

    if (s.estado === "PRENADA") {
      // Solo las preñadas van al gráfico de distribución
      const dias = s.diasDesdeServ;
      if (dias >= 114) {
        // Gestación muy larga sin parto registrado — inconsistencia
        inconsistencias.push({
          sowId: s.sowId, caravana, ubicacion,
          diasGestacion: dias, fechaPartoProyectada,
          problema: `Gestación con ${dias} días sin parto registrado`,
        });
      } else {
        for (const b of bucketCounts) {
          if (dias >= b.min && dias <= b.max) { b.count++; break; }
        }
      }
    } else if (s.estado === "SERVIDA" && s.diasDesdeServ > 28) {
      // Cerda servida con más de 28 días sin diagnóstico — inconsistencia operativa
      inconsistencias.push({
        sowId: s.sowId, caravana, ubicacion,
        diasGestacion: s.diasDesdeServ, fechaPartoProyectada,
        problema: `Sin diagnóstico de preñez (${s.diasDesdeServ} días post-servicio)`,
      });
    }
  }

  inconsistencias.sort((a, b) => b.diasGestacion - a.diasGestacion);

  return NextResponse.json({
    inconsistencias,
    distribucion: bucketCounts.map(b => ({ rango: b.rango, cantidad: b.count })),
  });
}
