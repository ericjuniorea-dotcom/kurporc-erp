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
    prisma.rawMaterial.count({ where: { tenantId, isActive: true } }),
    prisma.rawMaterial.findMany({
      where: {
        tenantId,
        isActive: true,
        lots: { some: { remainingKg: { gt: 0 } } },
      },
      select: {
        id:          true,
        name:        true,
        minStockKg:  true,
        lots: {
          where:  { remainingKg: { gt: 0 } },
          select: { remainingKg: true },
        },
      },
    }),
  ]);

  const lowStockMaterials = rawMatsWithStock
    .map((m) => ({
      id:             m.id,
      name:           m.name,
      currentStockKg: m.lots.reduce((s, l) => s + Number(l.remainingKg), 0),
      minStockKg:     Number(m.minStockKg ?? 0),
    }))
    .filter((m) => m.currentStockKg < m.minStockKg);

  return NextResponse.json({ formulaCount, pendingVersions, materials, lowStockMaterials });
}
