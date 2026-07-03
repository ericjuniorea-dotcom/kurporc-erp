export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const results: string[] = [];

  // 1. Asegurar vacunas obligatorias de gestación
  const vacunasExistentes = await prisma.configVacuna.count({
    where: { tenantId, obligatoria: true, modulo: { in: ["GESTACION", "ALL"] } },
  });

  if (vacunasExistentes === 0) {
    await prisma.configVacuna.createMany({
      data: [
        {
          tenantId, modulo: "GESTACION", activa: true, obligatoria: true,
          nombreVacuna: "Parvovirus + Leptospira",
          marcaComercial: "Parvolep", laboratorio: "Vetanco",
          principioActivo: "Parvovirus + Leptospira interrogans",
          enfermedadObjetivo: "Parvovirosis y leptospirosis porcina",
          viaAplicacion: "IM", dosisMl: 2,
          momentoAplicacion: "PRE_SERVICIO_21",
          paisProcedencia: "ARG", tempConservacion: "2–8 °C",
          diasEsperaServicio: 21,
          refuerzoDias: 180,
        },
        {
          tenantId, modulo: "GESTACION", activa: true, obligatoria: true,
          nombreVacuna: "Circovirus PCV2",
          marcaComercial: "Ingelvac CircoFLEX", laboratorio: "Boehringer",
          principioActivo: "Antígeno de Circovirus porcino tipo 2",
          enfermedadObjetivo: "Circovirus porcino",
          viaAplicacion: "IM", dosisMl: 1,
          momentoAplicacion: "PRE_SERVICIO_42",
          paisProcedencia: "DEU", tempConservacion: "2–8 °C",
          diasEsperaServicio: 14,
          refuerzoDias: 365,
        },
      ],
      skipDuplicates: true,
    });
    results.push("Creadas 2 vacunas obligatorias pre-servicio");
  } else {
    results.push("Vacunas obligatorias ya existían");
  }

  // 2. Crear 2 cerdas demo en estado EMPTY (listas para servicio pero sin vacunar)
  const demoSows = [
    { identCode: "C-901", raza: "F1 LW×LR", currentParityCount: 0 },
    { identCode: "C-902", raza: "F1 LW×LR", currentParityCount: 1 },
  ];

  for (const s of demoSows) {
    const existing = await prisma.sow.findFirst({ where: { tenantId, identCode: s.identCode } });
    if (!existing) {
      await prisma.sow.create({
        data: {
          tenantId,
          identCode:           s.identCode,
          breed:               s.raza,
          plantelState:        "EMPTY",
          currentParityCount:  s.currentParityCount,
          entryDate:           new Date(),
        },
      });
      results.push(`Cerda ${s.identCode} creada (sin vacunas pendientes — bloqueada para servicio)`);
    } else {
      results.push(`Cerda ${s.identCode} ya existía`);
    }
  }

  return NextResponse.json({ ok: true, resultados: results });
}
