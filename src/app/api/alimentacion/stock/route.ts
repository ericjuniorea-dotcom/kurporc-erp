export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  // Últimos 7 días para calcular consumo promedio diario
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [feedTypes, stocks, recentRecords] = await Promise.all([
    prisma.feedType.findMany({ where: { tenantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.finishedStock.findMany({ where: { tenantId }, orderBy: { producedAt: "desc" } }),
    prisma.feedRecord.groupBy({
      by: ["feedTypeId"],
      where: { tenantId, recordDate: { gte: since } },
      _sum: { quantityKg: true },
    }),
  ]);

  // consumo diario promedio por feedType (últimos 7 días)
  const consumoDiario = Object.fromEntries(
    recentRecords.map(r => [r.feedTypeId, Number(r._sum.quantityKg ?? 0) / 7])
  );

  // Latest stock per feedType
  const latestStock = new Map<string, typeof stocks[0]>();
  for (const s of stocks) {
    if (!latestStock.has(s.feedTypeId)) latestStock.set(s.feedTypeId, s);
  }

  const resultado = feedTypes.map(ft => {
    const stock    = latestStock.get(ft.id);
    const stockKg  = stock ? Number(stock.currentStockKg) : 0;
    const consDay  = consumoDiario[ft.id] ?? 0;
    const dias     = consDay > 0 ? Math.floor(stockKg / consDay) : (stockKg > 0 ? 999 : 0);
    const estado   = dias >= 7 ? "OK" : dias >= 5 ? "Bajo" : "Crítico";
    return {
      feedTypeId:    ft.id,
      feedTypeName:  ft.name,
      phase:         ft.phase,
      stockKg:       +stockKg.toFixed(1),
      consumoDiario: +consDay.toFixed(1),
      diasRestantes: Math.min(dias, 999),
      estado,
    };
  });

  return NextResponse.json(resultado);
}
