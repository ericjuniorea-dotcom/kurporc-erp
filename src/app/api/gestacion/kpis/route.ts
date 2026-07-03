export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { addDays } from "@/lib/utils";
import { getGestacionStates } from "@/lib/gestacion/sow-state";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const tenantId = session.user.tenantId;
  const today    = new Date();
  const cutoff30 = addDays(today, -30);

  // ── Estado de cada cerda con servicio activo ──────────────────────
  const states = await getGestacionStates(tenantId);

  const preñadas = states.filter(s => s.estado === "PRENADA").length;
  const servidas  = states.filter(s => s.estado === "SERVIDA").length;

  // ── Lactantes: solo las que NO están ya en preñadas/servidas (evita doble resta) ──
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

  // ── Total activas (base para disponibles) ─────────────────────────
  const totalActivas = await prisma.sow.count({ where: { tenantId, isActive: true } });

  // disponibles = todo lo que no es preñada, servida, ni lactante
  const disponibles = Math.max(0, totalActivas - preñadas - servidas - lactantes);

  // ── Cerdas destetadas que aún no fueron servidas (para badge urgencia) ───
  const recentWeanings = await prisma.weaningEvent.findMany({
    where: {
      farrowing:      { tenantId },
      weaningDate:    { gte: cutoff30 },
      sowDestination: "GESTATION",
    },
    include: {
      farrowing: {
        select: {
          sowId: true,
          sow:   { select: { identCode: true } },
        },
      },
    },
    orderBy: { weaningDate: "desc" },
  });

  const weaningBySow = new Map<string, { weaningDate: Date; identCode: string }>();
  for (const w of recentWeanings) {
    const sowId = w.farrowing.sowId;
    const existing = weaningBySow.get(sowId);
    if (!existing || w.weaningDate > existing.weaningDate) {
      weaningBySow.set(sowId, {
        weaningDate: w.weaningDate,
        identCode:   w.farrowing.sow.identCode,
      });
    }
  }

  let porServir: {
    id: string; identCode: string;
    weaningDate: string; diasDesdeDestete: number; urgente: boolean;
  }[] = [];

  if (weaningBySow.size > 0) {
    const servicesAfterWeaning = await prisma.serviceEvent.findMany({
      where: {
        tenantId,
        sowId:       { in: Array.from(weaningBySow.keys()) },
        serviceDate: { gte: cutoff30 },
      },
      select: { sowId: true, serviceDate: true },
    });

    const latestServiceBySow = new Map<string, Date>();
    for (const s of servicesAfterWeaning) {
      const d    = new Date(s.serviceDate);
      const curr = latestServiceBySow.get(s.sowId);
      if (!curr || d > curr) latestServiceBySow.set(s.sowId, d);
    }

    for (const [sowId, { weaningDate, identCode }] of Array.from(weaningBySow.entries())) {
      const latestService = latestServiceBySow.get(sowId);
      if (!latestService || latestService < weaningDate) {
        const diasDesdeDestete = Math.floor(
          (today.getTime() - weaningDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        porServir.push({
          id: sowId, identCode,
          weaningDate: weaningDate.toISOString(),
          diasDesdeDestete,
          urgente: diasDesdeDestete >= 5,
        });
      }
    }
    porServir.sort((a, b) => b.diasDesdeDestete - a.diasDesdeDestete);
  }

  return NextResponse.json({
    preñadas,
    servidas,
    disponibles,
    lactantes,
    porServir,
    alertasServicio: porServir.filter(s => s.urgente).length,
  });
}
