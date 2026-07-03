import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { addDays, diffDays } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const soloActivos = req.nextUrl.searchParams.get("estado") === "activo";

  const lotes = await prisma.growingBatch.findMany({
    where: {
      tenantId,
      ...(soloActivos ? { status: "ACTIVE" } : {}),
    },
    include: {
      weightRecords: {
        orderBy: { recordDate: "desc" },
        take: 2,
      },
      deaths: { select: { count: true } },
      otherExits: { select: { exitType: true, count: true } },
      sales: { select: { animalCount: true } },
    },
    orderBy: { entryDate: "desc" },
  });

  const today = new Date();

  const result = lotes.map((l) => {
    const diasAlojamiento = diffDays(new Date(l.entryDate), today);
    const lastPesaje = l.weightRecords[0] ?? null;
    const prevPesaje = l.weightRecords[1] ?? null;

    const totalDeaths = l.deaths.reduce((s, d) => s + d.count, 0);
    const hospitalCount = l.otherExits
      .filter((e) => e.exitType === "HOSPITAL")
      .reduce((s, e) => s + e.count, 0);
    const discardedCount = l.otherExits
      .filter((e) => e.exitType === "DISCARD")
      .reduce((s, e) => s + e.count, 0);

    const avgWeightKg = lastPesaje ? Number(lastPesaje.avgWeightKg) : Number(l.entryWeightKg) / l.currentCount;
    const targetWeightKg = l.targetWeightKg ? Number(l.targetWeightKg) : 120;

    let gdpGramsDia: number | null = null;
    let estimatedExitDate: string | null = null;
    let gdpStatus: "ok" | "warn" | "bad" | null = null;
    let progressPct: number | null = null;

    if (lastPesaje?.dailyGainKg) {
      gdpGramsDia = Math.round(Number(lastPesaje.dailyGainKg) * 1000);
      gdpStatus = gdpGramsDia >= 800 ? "ok" : gdpGramsDia >= 700 ? "warn" : "bad";

      if (gdpGramsDia > 0) {
        const diasRestantes = Math.ceil(((targetWeightKg - avgWeightKg) * 1000) / gdpGramsDia);
        const exitDate = addDays(today, Math.max(0, diasRestantes));
        estimatedExitDate = exitDate.toISOString().split("T")[0];

        const diasTotalesEstimados = diasAlojamiento + Math.max(0, diasRestantes);
        progressPct = diasTotalesEstimados > 0
          ? Math.min(100, Math.round((diasAlojamiento / diasTotalesEstimados) * 100))
          : 0;
      }
    } else if (prevPesaje && lastPesaje) {
      // Calcular GDP manualmente si dailyGainKg no está guardado
      const dias = diffDays(new Date(prevPesaje.recordDate), new Date(lastPesaje.recordDate));
      if (dias > 0) {
        const diff = Number(lastPesaje.avgWeightKg) - Number(prevPesaje.avgWeightKg);
        gdpGramsDia = Math.round((diff / dias) * 1000);
        gdpStatus = gdpGramsDia >= 800 ? "ok" : gdpGramsDia >= 700 ? "warn" : "bad";
      }
    }

    return {
      id: l.id,
      batchCode: l.batchCode,
      sitio: l.sitio,
      procedencia: l.procedencia,
      status: l.status,
      entryDate: l.entryDate.toISOString().split("T")[0],
      currentCount: l.currentCount,
      avgAgeAtEntryDays: l.avgAgeAtEntryDays,
      targetWeightKg,
      employeeId: l.employeeId,
      observations: l.observations,
      closedAt: l.closedAt?.toISOString().split("T")[0] ?? null,
      closedReason: l.closedReason,
      diasAlojamiento,
      avgWeightKg: Math.round(avgWeightKg * 10) / 10,
      lastPesajeFecha: lastPesaje ? lastPesaje.recordDate.toISOString().split("T")[0] : null,
      gdpGramsDia,
      gdpStatus,
      estimatedExitDate,
      progressPct,
      totalDeaths,
      hospitalCount,
      discardedCount,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const {
    batchCode, sitio, procedencia, entryDate, nurseryBatchId,
    currentCount, entryWeightKg, avgAgeAtEntryDays,
    targetWeightKg, employeeId, observations,
  } = body;

  if (!batchCode || !currentCount || !entryWeightKg || !entryDate) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const existe = await prisma.growingBatch.findUnique({
    where: { tenantId_batchCode: { tenantId, batchCode } },
  });
  if (existe) return NextResponse.json({ error: "Ya existe un lote con ese código" }, { status: 409 });

  const lote = await prisma.growingBatch.create({
    data: {
      tenantId,
      batchCode,
      sitio: sitio || null,
      procedencia: procedencia || "RECRIA_PROPIA",
      entryDate: new Date(entryDate),
      nurseryBatchId: nurseryBatchId || null,
      currentCount: Number(currentCount),
      entryWeightKg: Number(entryWeightKg),
      avgAgeAtEntryDays: avgAgeAtEntryDays ? Number(avgAgeAtEntryDays) : null,
      targetWeightKg: targetWeightKg ? Number(targetWeightKg) : 120,
      employeeId: employeeId || null,
      observations: observations || null,
      status: "ACTIVE",
    },
  });

  return NextResponse.json(lote, { status: 201 });
}
