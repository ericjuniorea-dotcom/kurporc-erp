export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const sp    = req.nextUrl.searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  const fase  = sp.get("fase");

  const from = desde ? new Date(desde) : new Date(Date.now() - 30 * 86400000);
  const to   = hasta ? new Date(hasta) : new Date();
  to.setHours(23, 59, 59, 999);

  // phase filter → feedType phases
  const phaseFilter: Record<string, string[]> = {
    gestacion:  ["GESTATION"],
    maternidad: ["LACTATION", "PRE_STARTER"],
    iniciacion: ["PHASE_1", "PHASE_2"],
    engorde:    ["GROWING"],
  };
  const phases = fase && phaseFilter[fase] ? phaseFilter[fase] : undefined;

  const records = await prisma.feedRecord.findMany({
    where: {
      tenantId,
      recordDate: { gte: from, lte: to },
      ...(phases ? { feedType: { phase: { in: phases } } } : {}),
    },
    include: {
      feedType: { select: { name: true, phase: true } },
      farrowing: { select: { sow: { select: { identCode: true } } } },
      nurseryBatch: { select: { batchCode: true } },
      growingBatch: { select: { batchCode: true } },
    },
    orderBy: { recordDate: "desc" },
    take: 500,
  });

  const result = records.map(r => ({
    id:           r.id,
    recordDate:   r.recordDate.toISOString().slice(0, 10),
    label:        r.farrowing?.sow?.identCode
                    ? `Cerda ${r.farrowing.sow.identCode}`
                    : r.nurseryBatch
                    ? `Lote ${r.nurseryBatch.batchCode}`
                    : r.growingBatch
                    ? `Lote ${r.growingBatch.batchCode}`
                    : r.feedType.phase === "GESTATION"
                    ? "Cerdas en gestación"
                    : "—",
    fase:         r.feedType.phase,
    feedTypeName: r.feedType.name,
    quantityKg:   Number(r.quantityKg),
    employeeId:   r.employeeId,
    isSynced:     r.isSynced,
    createdAt:    r.createdAt.toISOString(),
  }));

  // consumo semanal agrupado
  const semMap = new Map<string, Map<string, number>>();
  for (const r of records) {
    const d    = new Date(r.recordDate);
    const week = `${d.getFullYear()}-W${String(getWeek(d)).padStart(2, "0")}`;
    if (!semMap.has(week)) semMap.set(week, new Map());
    const ft = r.feedType.name;
    semMap.get(week)!.set(ft, (semMap.get(week)!.get(ft) ?? 0) + Number(r.quantityKg));
  }
  const consumoSemanal = Array.from(semMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, tipos]) => ({
      semana,
      ...Object.fromEntries(Array.from(tipos.entries())),
      total: Array.from(tipos.values()).reduce((s, v) => s + v, 0),
    }));

  return NextResponse.json({ records: result, consumoSemanal });
}

function getWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
