import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenantId = session.user.tenantId;

  const [formulaCount, pendingVersions, materials, rawMatsWithStock] = await Promise.all([
    prisma.formula.count({ where: { tenantId, isActive: true } }),
    prisma.formulaVersion.count({ where: { tenantId, status: "INACTIVE" } }),
    prisma.productoInventario.count({ where: { tenantId, isActive: true, categoria: "MATERIA_PRIMA" } }),
    prisma.productoInventario.findMany({
      where: {
        tenantId,
        isActive: true,
        categoria: "MATERIA_PRIMA",
        lotes: { some: { cantidadActual: { gt: 0 } } },
      },
      select: {
        id:          true,
        nombre:      true,
        stockMinimo: true,
        lotes: {
          where:  { cantidadActual: { gt: 0 } },
          select: { cantidadActual: true },
        },
      },
    }),
  ]);

  const lowStockMaterials = rawMatsWithStock
    .map((m) => ({
      id:             m.id,
      name:           m.nombre,
      currentStockKg: m.lotes.reduce((s, l) => s + Number(l.cantidadActual), 0),
      minStockKg:     Number(m.stockMinimo ?? 0),
    }))
    .filter((m) => m.currentStockKg < m.minStockKg);

  return NextResponse.json({ formulaCount, pendingVersions, materials, lowStockMaterials });
}
