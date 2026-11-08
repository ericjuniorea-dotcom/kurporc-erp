export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";
import { jsonConMontos } from "@/lib/permisos/montos";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["alimentacion.consumos.ver", "stock.items.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const { tenantId } = session.user;

  // Últimos 7 días para calcular consumo promedio diario
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [feedTypes, lotes, recentRecords] = await Promise.all([
    prisma.feedType.findMany({ where: { tenantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.loteInventario.findMany({
      where: { tenantId, vacuna: { categoria: "BALANCEADO" } },
      select: { vacunaId: true, cantidadActual: true },
    }),
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

  // Stock actual = suma de todos los lotes del producto Balanceado vinculado a cada etapa
  const stockPorProducto = new Map<string, number>();
  for (const l of lotes) {
    stockPorProducto.set(l.vacunaId, (stockPorProducto.get(l.vacunaId) ?? 0) + Number(l.cantidadActual));
  }

  const resultado = feedTypes.map(ft => {
    const stockKg  = ft.productoBalanceadoId ? (stockPorProducto.get(ft.productoBalanceadoId) ?? 0) : 0;
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

  return jsonConMontos(resultado);
}
