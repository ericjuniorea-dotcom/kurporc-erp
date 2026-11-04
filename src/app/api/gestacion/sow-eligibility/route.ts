import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export type EligibilityBlockerType =
  | "QUARANTINE"
  | "DIAS_INSUFICIENTES"
  | "VACUNAS_FALTANTES";

export type EligibilityBlocker = {
  tipo: EligibilityBlockerType;
  mensaje: string;
};

export type EligibilityResult = {
  eligible: boolean;
  blockers: EligibilityBlocker[];
  sowCode: string;
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenantId = session.user.tenantId;
  const sowId = new URL(req.url).searchParams.get("sowId");
  if (!sowId) return NextResponse.json({ error: "sowId requerido" }, { status: 400 });

  const [sow, requisitosConfig, vacunasRequeridas] = await Promise.all([
    prisma.sow.findFirst({
      where: { id: sowId, tenantId },
      select: {
        identCode: true,
        plantelState: true,
        entryDate: true,
        birthDate: true,
      },
    }),
    prisma.configProceso.findUnique({
      where: {
        tenantId_modulo_procesoKey: {
          tenantId,
          modulo: "GESTACION",
          procesoKey: "requisitos_servicio",
        },
      },
    }),
    // diaGestacion: null excluye las vacunas de protocolo de gestación (Rhiniseng,
    // Suiseng, Porcilis Glässer, etc.) — se aplican durante una preñez ya en curso
    // (día 60-95), nunca antes de un servicio nuevo, así que no pueden bloquearlo.
    prisma.configVacuna.findMany({
      where: {
        tenantId,
        obligatoria: true,
        activa: true,
        diaGestacion: null,
        modulo: { in: ["GESTACION", "ALL"] },
      },
      select: { id: true, nombreVacuna: true },
    }),
  ]);

  if (!sow) return NextResponse.json({ error: "Cerda no encontrada" }, { status: 404 });

  const blockers: EligibilityBlocker[] = [];

  // 1. Cuarentena
  if (sow.plantelState === "QUARANTINE") {
    blockers.push({
      tipo: "QUARANTINE",
      mensaje: "Esta cerda está en cuarentena. No puede ser inseminada hasta recibir el alta sanitaria.",
    });
  }

  const reqValor = (requisitosConfig?.valor as Record<string, unknown>) ?? {};

  // El peso ya no se chequea acá: se pide y valida en vivo en el propio
  // formulario de inseminación (siempre con el dato fresco, no con
  // entryWeightKg que queda desactualizado apenas la cerda engorda).

  // 3. Días mínimos desde ingreso
  const diasMinimos = Number(reqValor.dias_minimos_previo_servicio ?? 0);
  if (diasMinimos > 0) {
    const referenceDate = sow.birthDate ?? sow.entryDate;
    const diasTranscurridos = Math.floor(
      (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diasTranscurridos < diasMinimos) {
      const label = sow.birthDate ? "edad" : "días desde ingreso";
      blockers.push({
        tipo: "DIAS_INSUFICIENTES",
        mensaje: `Días insuficientes: ${diasTranscurridos} días de ${label} (mínimo: ${diasMinimos} días).`,
      });
    }
  }

  // 4. Vacunas reproductivas obligatorias
  if (vacunasRequeridas.length > 0) {
    const vacunasAplicadas = await prisma.animalEvent.findMany({
      where: { sowId, eventType: "VACCINATION" },
      select: { metadata: true },
    });

    const aplicadasIds = new Set(
      vacunasAplicadas
        .map(ev => (ev.metadata as Record<string, unknown> | null)?.configVacunaId as string | undefined)
        .filter(Boolean),
    );

    const faltantes = vacunasRequeridas.filter(v => !aplicadasIds.has(v.id));
    if (faltantes.length > 0) {
      blockers.push({
        tipo: "VACUNAS_FALTANTES",
        mensaje: `Vacunas reproductivas obligatorias sin registrar: ${faltantes.map(v => v.nombreVacuna).join(", ")}.`,
      });
    }
  }

  return NextResponse.json({
    eligible: blockers.length === 0,
    blockers,
    sowCode: sow.identCode,
  } satisfies EligibilityResult);
}
