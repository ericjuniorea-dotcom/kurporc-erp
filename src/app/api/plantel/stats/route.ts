export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId as string;

  const now = new Date();

  // ── Reproducción: misma fuente que el módulo de gestación ─────────
  const states    = await getGestacionStates(tenantId);
  const preñadas  = states.filter(s => s.estado === "PRENADA").length;
  const servidas  = states.filter(s => s.estado === "SERVIDA").length;

  // ── Lactantes: excluir las ya contadas en preñadas/servidas ──
  const preñadasServidasIds = states
    .filter(s => s.estado === "PRENADA" || s.estado === "SERVIDA")
    .map(s => s.sowId);

  const lactantes = await prisma.sow.count({
    where: {
      tenantId,
      isActive: true,
      plantelState: { in: ["LACTATING", "FARROWING"] },
      ...(preñadasServidasIds.length > 0 ? { id: { notIn: preñadasServidasIds } } : {}),
    },
  });

  // ── Total cerdas activas ──────────────────────────────────────────
  const totalSows = await prisma.sow.count({ where: { tenantId, isActive: true } });
  const disponibles = Math.max(0, totalSows - preñadas - servidas - lactantes);

  // ── Reproductores activos ─────────────────────────────────────────
  const [activeBoars, semenDoses] = await Promise.all([
    prisma.boar.count({
      where: { tenantId, plantelState: { in: ["ACTIVE", "RESTING"] } },
    }),
    prisma.externalSemenLot.aggregate({
      where: { tenantId, isActive: true, expiryDate: { gt: now } },
      _sum:  { availableDoses: true },
    }),
  ]);

  // Stock total = cerdas activas + reproductores activos
  // = disponibles + servidas + preñadas + lactantes + reproductores
  const total = totalSows + activeBoars;

  return NextResponse.json({
    total,
    activeSows:  totalSows,
    disponibles,
    servidas,
    preñadas,
    lactantes,
    activeBoars,
    semenDoses:  semenDoses._sum.availableDoses ?? 0,
  });
}
