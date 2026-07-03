export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";

const ESTADO_LABEL: Record<string, string> = {
  EMPTY:                   "Vacía",
  REPLACEMENT_READY:       "Lista para primer servicio",
  REPLACEMENT_DEVELOPING:  "En desarrollo",
  QUARANTINE:              "En cuarentena",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const today   = new Date();
  const cutoff60 = new Date(today.getTime() - 60 * 86400000);

  // Misma fuente de verdad que el KPI: excluir PRENADA, SERVIDA y LACTANTE
  const states = await getGestacionStates(tenantId);
  const noDisponibleIds = new Set(
    states
      .filter(s => s.estado === "PRENADA" || s.estado === "SERVIDA")
      .map(s => s.sowId),
  );

  // Todas las cerdas activas
  const todasActivas = await prisma.sow.findMany({
    where:  { tenantId, isActive: true },
    select: {
      id: true, identCode: true, caravanaCode: true,
      galponAssigned: true, corralAssigned: true, plantelState: true,
    },
  });

  // Destetes recientes para calcular días desde destete y fecha recomendada
  const weaningsRecientes = await prisma.weaningEvent.findMany({
    where: {
      farrowing:      { tenantId },
      weaningDate:    { gte: cutoff60 },
      sowDestination: "GESTATION",
    },
    include: { farrowing: { select: { sowId: true } } },
    orderBy: { weaningDate: "desc" },
  });

  const lastWeaningBySow = new Map<string, Date>();
  for (const w of weaningsRecientes) {
    const sowId = w.farrowing.sowId;
    if (!lastWeaningBySow.has(sowId)) {
      lastWeaningBySow.set(sowId, new Date(w.weaningDate));
    }
  }

  // Disponibles = activas que no son PRENADA, SERVIDA ni LACTANTE/FARROWING
  const LACTANTE_STATES = new Set(["LACTATING", "FARROWING"]);

  const disponibles = todasActivas
    .filter(s =>
      !noDisponibleIds.has(s.id) &&
      !LACTANTE_STATES.has(s.plantelState ?? ""),
    )
    .map(s => {
      const galpon    = s.galponAssigned ?? "";
      const corral    = s.corralAssigned ?? "";
      const ubicacion = [galpon, corral].filter(Boolean).join(" – ") || "—";

      const lastWeaning = lastWeaningBySow.get(s.id) ?? null;
      const diasDesdeDestete = lastWeaning
        ? Math.floor((today.getTime() - lastWeaning.getTime()) / 86400000)
        : null;

      const fechaRecomendada = lastWeaning
        ? new Date(lastWeaning.getTime() + 5 * 86400000).toISOString().slice(0, 10)
        : today.toISOString().slice(0, 10);

      return {
        sowId:                        s.id,
        caravana:                     s.caravanaCode ?? s.identCode,
        ubicacion,
        galpon,
        estadoReproductivo:           ESTADO_LABEL[s.plantelState ?? ""] ?? "Disponible",
        plantelState:                 s.plantelState ?? "",
        diasDesdeDestete,
        ultimaFechaDestete:           lastWeaning ? lastWeaning.toISOString().slice(0, 10) : null,
        fechaRecomendadaInseminacion: fechaRecomendada,
        esPostDestete:                !!lastWeaning,
      };
    })
    .sort((a, b) => {
      if (a.esPostDestete !== b.esPostDestete) return a.esPostDestete ? -1 : 1;
      return a.caravana.localeCompare(b.caravana);
    });

  return NextResponse.json(disponibles);
}
