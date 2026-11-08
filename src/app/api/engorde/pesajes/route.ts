import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { diffDays } from "@/lib/utils";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "engorde.eventos.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "engorde.eventos.crear" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { growingBatchId, recordDate, animalCount, totalWeightKg, employeeId } = body;

  if (!growingBatchId || !recordDate || !animalCount || !totalWeightKg) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const count = Number(animalCount);
  const totalKg = Number(totalWeightKg);
  const avgKg = totalKg / count;

  // Obtener último pesaje para calcular GDP
  const lastPesaje = await prisma.weightRecord.findFirst({
    where: { growingBatchId, tenantId },
    orderBy: { recordDate: "desc" },
  });

  let dailyGainKg: number | null = null;
  if (lastPesaje) {
    const dias = diffDays(new Date(lastPesaje.recordDate), new Date(recordDate));
    if (dias > 0) {
      dailyGainKg = (avgKg - Number(lastPesaje.avgWeightKg)) / dias;
    }
  }

  const pesaje = await prisma.weightRecord.create({
    data: {
      tenantId,
      growingBatchId,
      recordDate: new Date(recordDate),
      totalWeightKg: totalKg,
      animalCount: count,
      avgWeightKg: avgKg,
      dailyGainKg: dailyGainKg !== null ? dailyGainKg : undefined,
      employeeId: employeeId || null,
    },
  });

  const gdpGramsDia = dailyGainKg !== null ? Math.round(dailyGainKg * 1000) : null;

  return NextResponse.json({ ...pesaje, gdpGramsDia }, { status: 201 });
}
