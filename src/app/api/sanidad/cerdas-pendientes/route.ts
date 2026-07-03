export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  // Vacunas obligatorias para gestación
  const vacunasObligatorias = await prisma.configVacuna.findMany({
    where: { tenantId, activa: true, obligatoria: true, modulo: { in: ["GESTACION", "ALL", "PLANTEL"] } },
    orderBy: { nombreVacuna: "asc" },
  });

  if (vacunasObligatorias.length === 0) {
    return NextResponse.json({ cerdas: [], vacunasObligatorias: [] });
  }

  // Cerdas activas en plantel (candidatas a servicio)
  const cerdas = await prisma.sow.findMany({
    where: { tenantId, plantelState: { in: ["EMPTY", "MATED"] } },
    select: {
      id: true, identCode: true, plantelState: true, currentParityCount: true,
      animalEvents: {
        where: { eventType: "VACCINATION" },
        orderBy: { eventDate: "desc" },
        select: { eventDate: true, metadata: true },
      },
    },
    orderBy: { identCode: "asc" },
  });

  const today = new Date();

  const result = cerdas.map(cerda => {
    const vacEstados = vacunasObligatorias.map(v => {
      const aplicaciones = cerda.animalEvents.filter(e => {
        const meta = e.metadata as Record<string, unknown> | null;
        return meta?.configVacunaId === v.id || meta?.nombreVacuna === v.nombreVacuna;
      });

      const lastAplic = aplicaciones[0] ?? null;
      const lastDate  = lastAplic ? new Date(lastAplic.eventDate) : null;

      // Check refuerzo vencido
      let vencida = false;
      if (lastDate && v.refuerzoDias) {
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + v.refuerzoDias);
        vencida = nextDate < today;
      }

      // Check días de espera post-vacuna
      let diasRestantesEspera = 0;
      if (lastDate && v.diasEsperaServicio > 0) {
        const habilitadaDesde = new Date(lastDate);
        habilitadaDesde.setDate(habilitadaDesde.getDate() + v.diasEsperaServicio);
        diasRestantesEspera = Math.max(0, Math.ceil((habilitadaDesde.getTime() - today.getTime()) / 86400000));
      }

      const aplicada = !!lastDate && !vencida;

      return {
        vacunaId:           v.id,
        nombreVacuna:       v.nombreVacuna,
        momentoAplicacion:  v.momentoAplicacion,
        viaAplicacion:      v.viaAplicacion,
        dosisMl:            Number(v.dosisMl),
        diasEsperaServicio: v.diasEsperaServicio,
        aplicada,
        vencida,
        ultimaAplicacion:   lastDate?.toISOString() ?? null,
        diasRestantesEspera,
        bloqueaServicio:    !aplicada || diasRestantesEspera > 0,
      };
    });

    const pendientes    = vacEstados.filter(v => !v.aplicada || v.vencida);
    const enEspera      = vacEstados.filter(v => v.aplicada && v.diasRestantesEspera > 0);
    const bloqueado     = pendientes.length > 0 || enEspera.length > 0;
    const motivoBloqueo = pendientes.length > 0
      ? `Vacuna(s) pendiente(s): ${pendientes.map(v => v.nombreVacuna).join(", ")}`
      : enEspera.length > 0
      ? `En espera post-vacuna: ${enEspera.map(v => `${v.nombreVacuna} (${v.diasRestantesEspera}d)`).join(", ")}`
      : null;

    return {
      id: cerda.id, identCode: cerda.identCode,
      plantelState: cerda.plantelState,
      currentParityCount: cerda.currentParityCount,
      vacEstados,
      pendientes: pendientes.length,
      bloqueado,
      motivoBloqueo,
    };
  });

  // Solo retornar cerdas con algo pendiente o en espera
  const conPendientes = result.filter(c => c.bloqueado);

  return NextResponse.json({
    cerdas: conPendientes,
    vacunasObligatorias: vacunasObligatorias.map(v => ({
      id: v.id, nombreVacuna: v.nombreVacuna, momentoAplicacion: v.momentoAplicacion,
      diasEsperaServicio: v.diasEsperaServicio, viaAplicacion: v.viaAplicacion,
      dosisMl: Number(v.dosisMl),
    })),
  });
}
