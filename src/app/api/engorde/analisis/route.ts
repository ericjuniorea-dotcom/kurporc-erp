import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { isoWeekLabel, diffDays } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const defDesde = new Date(now); defDesde.setDate(defDesde.getDate() - 90);
  const desde = sp.get("desde") ? new Date(sp.get("desde")!) : defDesde;
  const hasta = sp.get("hasta") ? new Date(sp.get("hasta")!) : now;
  hasta.setHours(23, 59, 59, 999);

  const [pesajes, muertes, lotes] = await Promise.all([
    prisma.weightRecord.findMany({
      where: { tenantId, growingBatchId: { not: null }, recordDate: { gte: desde, lte: hasta } },
      include: { growingBatch: { select: { batchCode: true, sitio: true, targetWeightKg: true } } },
      orderBy: { recordDate: "asc" },
    }),
    prisma.growingDeath.findMany({
      where: { tenantId, deathDate: { gte: desde, lte: hasta } },
    }),
    prisma.growingBatch.findMany({
      where: { tenantId, status: "ACTIVE" },
      include: {
        weightRecords: { orderBy: { recordDate: "desc" }, take: 1 },
        deaths: { select: { count: true } },
      },
    }),
  ]);

  // GDP semanal (promedio de pesajes por semana)
  const gdpSemMap = new Map<string, number[]>();
  for (const p of pesajes) {
    if (!p.dailyGainKg) continue;
    const sem = isoWeekLabel(new Date(p.recordDate));
    if (!gdpSemMap.has(sem)) gdpSemMap.set(sem, []);
    gdpSemMap.get(sem)!.push(Math.round(Number(p.dailyGainKg) * 1000));
  }
  const gdpSemanal = Array.from(gdpSemMap.entries())
    .map(([semana, vals]) => ({
      semana: semana.replace(/^\d{4}-/, ""),
      gdp: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }))
    .sort((a, b) => a.semana.localeCompare(b.semana));

  // Mortalidad semanal
  const mortSemMap = new Map<string, number>();
  for (const m of muertes) {
    const sem = isoWeekLabel(new Date(m.deathDate)).replace(/^\d{4}-/, "");
    mortSemMap.set(sem, (mortSemMap.get(sem) ?? 0) + m.count);
  }
  const mortalidadSemanal = Array.from(mortSemMap.entries())
    .map(([semana, count]) => ({ semana, count }))
    .sort((a, b) => a.semana.localeCompare(b.semana));

  // Causas de mortalidad
  const causasMap = new Map<string, number>();
  for (const m of muertes) causasMap.set(m.cause, (causasMap.get(m.cause) ?? 0) + m.count);
  const causasMortalidad = Array.from(causasMap.entries())
    .map(([causa, count]) => ({ causa, count }))
    .sort((a, b) => b.count - a.count);

  // Curva de peso por lote activo (peso actual vs objetivo)
  const curvaPeso = lotes.map((l) => {
    const lastP = l.weightRecords[0];
    const pesoActual = lastP ? Number(lastP.avgWeightKg) : Number(l.entryWeightKg) / l.currentCount;
    const targetKg = l.targetWeightKg ? Number(l.targetWeightKg) : 120;
    const gdp = lastP?.dailyGainKg ? Math.round(Number(lastP.dailyGainKg) * 1000) : null;
    const pctProgreso = Math.min(100, Math.round((pesoActual / targetKg) * 100));
    return {
      batchCode: l.batchCode,
      sitio: l.sitio,
      pesoActual: Math.round(pesoActual * 10) / 10,
      targetKg,
      pctProgreso,
      gdp,
      gdpStatus: gdp == null ? null : gdp >= 800 ? "ok" : gdp >= 700 ? "warn" : "bad",
    };
  });

  // Tabla rendimiento por lote
  const today = new Date();
  const rendimientoLotes = lotes.map((l) => {
    const lastP = l.weightRecords[0];
    const diasAloj = diffDays(new Date(l.entryDate), today);
    const pesoActual = lastP ? Number(lastP.avgWeightKg) : Number(l.entryWeightKg) / l.currentCount;
    const targetKg = l.targetWeightKg ? Number(l.targetWeightKg) : 120;
    const gdp = lastP?.dailyGainKg ? Math.round(Number(lastP.dailyGainKg) * 1000) : null;
    const totalMuertos = l.deaths.reduce((s, d) => s + d.count, 0);
    const mortalidadPct = l.currentCount + totalMuertos > 0
      ? Math.round((totalMuertos / (l.currentCount + totalMuertos)) * 1000) / 10
      : 0;
    let exitDate: string | null = null;
    if (gdp && gdp > 0 && pesoActual < targetKg) {
      const dias = Math.ceil(((targetKg - pesoActual) * 1000) / gdp);
      const d = new Date(today); d.setDate(d.getDate() + dias);
      exitDate = d.toISOString().split("T")[0];
    }
    return {
      batchCode: l.batchCode,
      sitio: l.sitio,
      currentCount: l.currentCount,
      diasAlojamiento: diasAloj,
      pesoActual: Math.round(pesoActual * 10) / 10,
      gdp,
      mortalidadPct,
      estimatedExitDate: exitDate,
      gdpStatus: gdp == null ? null : gdp >= 800 ? "ok" : gdp >= 700 ? "warn" : "bad",
    };
  });

  // KPI strip de análisis
  const allGdp = gdpSemanal.map(s => s.gdp).filter(Boolean) as number[];
  const gdpProm = allGdp.length > 0 ? Math.round(allGdp.reduce((a, b) => a + b, 0) / allGdp.length) : null;
  const totalMuertes = muertes.reduce((s, m) => s + m.count, 0);
  const totalAnimales = lotes.reduce((s, l) => s + l.currentCount, 0) + totalMuertes;
  const mortPct = totalAnimales > 0 ? Math.round((totalMuertes / totalAnimales) * 1000) / 10 : 0;

  const kpis = {
    gdpPromedio: gdpProm,
    mortalidadPct: mortPct,
    pesosActuales: curvaPeso.map(c => c.pesoActual),
  };

  return NextResponse.json({ kpis, gdpSemanal, mortalidadSemanal, causasMortalidad, curvaPeso, rendimientoLotes });
}
