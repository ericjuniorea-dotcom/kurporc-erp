export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { addDays } from "@/lib/utils";

// Gestación estándar usada para proyectar la fecha de parto del lote a
// partir de su fecha de servicio (misma convención que /api/gestacion/prenadas-detail).
const DIAS_GESTACION = 114;

type Estado =
  | "SERVIDA" | "REPITIO_CELO" | "PRENADA"
  | "EN_MATERNIDAD" | "DESTETADA" | "DESCARTADA";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const batches = await prisma.serviceBatch.findMany({
    where: { tenantId, code: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      serviceEvents: {
        include: {
          sow: {
            select: {
              id: true, identCode: true, caravanaCode: true,
              galponAssigned: true, corralAssigned: true, plantelState: true,
            },
          },
          pregnancyChecks: { orderBy: { checkDate: "desc" }, take: 1, select: { result: true, checkDate: true } },
          farrowing: {
            select: {
              id: true, startDatetime: true, bornAlive: true,
              weaning: { select: { weaningDate: true, pigletsWeaned: true } },
            },
          },
        },
        orderBy: { serviceDate: "asc" },
      },
    },
  });

  const allSowIds = Array.from(new Set(batches.flatMap(b => b.serviceEvents.map(e => e.sowId))));

  const [heatRepeats, vacunaciones] = await Promise.all([
    allSowIds.length > 0
      ? prisma.heatRepeat.findMany({
          where:  { tenantId, sowId: { in: allSowIds } },
          select: { sowId: true, repeatDate: true },
        })
      : Promise.resolve([]),
    allSowIds.length > 0
      ? prisma.animalEvent.findMany({
          where:   { tenantId, sowId: { in: allSowIds }, eventType: "VACCINATION" },
          orderBy: { eventDate: "desc" },
          select:  { sowId: true, eventDate: true, metadata: true },
        })
      : Promise.resolve([]),
  ]);

  const lastHeatRepeatBySow = new Map<string, Date>();
  for (const hr of heatRepeats) {
    const curr = lastHeatRepeatBySow.get(hr.sowId);
    if (!curr || hr.repeatDate > curr) lastHeatRepeatBySow.set(hr.sowId, hr.repeatDate);
  }
  const lastVacunaBySow = new Map<string, { nombre: string | null; fecha: string }>();
  for (const v of vacunaciones) {
    if (!v.sowId || lastVacunaBySow.has(v.sowId)) continue;
    const meta = v.metadata as Record<string, unknown> | null;
    lastVacunaBySow.set(v.sowId, {
      nombre: (meta?.nombreVacuna as string) ?? null,
      fecha:  v.eventDate.toISOString().slice(0, 10),
    });
  }

  const result = batches.map(batch => {
    const cerdas = batch.serviceEvents.map(ev => {
      const sow       = ev.sow;
      const galpon    = sow.galponAssigned ?? "";
      const corral    = sow.corralAssigned ?? "";
      const ubicacion = [galpon, corral].filter(Boolean).join(" – ") || "—";

      const diagnostico = ev.pregnancyChecks[0]
        ? { resultado: ev.pregnancyChecks[0].result, fecha: ev.pregnancyChecks[0].checkDate.toISOString().slice(0, 10) }
        : null;
      const parto = ev.farrowing
        ? { fecha: ev.farrowing.startDatetime.toISOString().slice(0, 10), bornAlive: ev.farrowing.bornAlive }
        : null;
      const destete = ev.farrowing?.weaning
        ? { fecha: ev.farrowing.weaning.weaningDate.toISOString().slice(0, 10), pigletsWeaned: ev.farrowing.weaning.pigletsWeaned }
        : null;

      const hrDate       = lastHeatRepeatBySow.get(sow.id);
      const tuvoRepCelo   = !!(hrDate && hrDate >= ev.serviceDate && !ev.farrowing);
      const esDescartada  = sow.plantelState === "CULLED" || sow.plantelState === "DEAD";

      let estadoGeneral: Estado;
      if (destete)                       estadoGeneral = "DESTETADA";
      else if (parto)                    estadoGeneral = "EN_MATERNIDAD";
      else if (diagnostico?.resultado === "PREGNANT") estadoGeneral = "PRENADA";
      else if (esDescartada)             estadoGeneral = "DESCARTADA";
      else if (tuvoRepCelo)              estadoGeneral = "REPITIO_CELO";
      else                                estadoGeneral = "SERVIDA";

      return {
        sowId:          sow.id,
        caravana:       sow.caravanaCode ?? sow.identCode,
        ubicacion,
        estadoGeneral,
        etapas: {
          servicio:    { fecha: ev.serviceDate.toISOString().slice(0, 10) },
          diagnostico,
          parto,
          destete,
        },
        ultimaVacunacion: lastVacunaBySow.get(sow.id) ?? null,
      };
    });

    const resumen: Record<Estado, number> = {
      SERVIDA: 0, REPITIO_CELO: 0, PRENADA: 0, EN_MATERNIDAD: 0, DESTETADA: 0, DESCARTADA: 0,
    };
    for (const c of cerdas) resumen[c.estadoGeneral]++;

    const fechaServicio = cerdas[0]?.etapas.servicio.fecha ?? null;
    const fechaPartoProyectada = fechaServicio
      ? addDays(new Date(fechaServicio), DIAS_GESTACION).toISOString().slice(0, 10)
      : null;

    return {
      batchId:     batch.id,
      code:        batch.code,
      weekLabel:   batch.weekLabel,
      notes:       batch.notes,
      fechaServicio,
      fechaPartoProyectada,
      totalCerdas: cerdas.length,
      resumen,
      cerdas,
    };
  });

  return NextResponse.json(result);
}
