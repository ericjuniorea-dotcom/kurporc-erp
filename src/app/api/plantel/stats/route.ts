export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "plantel.animales.ver")) return NextResponse.json({ error: "No tenés permiso para ver esto", permiso: "plantel.animales.ver" }, { status: 403 });
  const tenantId = (session.user as any).tenantId as string;

  const now = new Date();

  // ── Gestación: misma fuente que el módulo de gestación ───────────
  const states   = await getGestacionStates(tenantId);
  const preñadas = states.filter(s => s.estado === "PRENADA").length;
  const servidas = states.filter(s => s.estado === "SERVIDA").length;

  // ── Hembras en Maternidad: misma fuente que el módulo de Maternidad ──
  // Partos activos sin destete registrado
  const hembrasEnMaternidad = await prisma.farrowingEvent.count({
    where: { tenantId, weaning: null },
  });

  // ── Cuarentena: sows activas en estado QUARANTINE ─────────────────
  const cuarentena = await prisma.sow.count({
    where: { tenantId, isActive: true, plantelState: "QUARANTINE" },
  });

  // ── Total cerdas activas ──────────────────────────────────────────
  const totalSows = await prisma.sow.count({ where: { tenantId, isActive: true } });

  // Disponibles = activas que no son preñadas, servidas, en maternidad ni en cuarentena
  const disponibles = Math.max(0, totalSows - preñadas - servidas - hembrasEnMaternidad - cuarentena);

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

  // Stock General = suma de todas las categorías
  const total = disponibles + servidas + preñadas + hembrasEnMaternidad + cuarentena + activeBoars;

  return NextResponse.json({
    total,
    activeSows:          totalSows,
    hembrasEnMaternidad,
    preñadas,
    servidas,
    disponibles,
    activeBoars,
    cuarentena,
    semenDoses:          semenDoses._sum.availableDoses ?? 0,
  });
}
