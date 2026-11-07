import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// Devuelve datos para gráficos de los últimos 12 meses
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenantId = session.user.tenantId;
  const today    = new Date();
  const month12Ago = new Date(today); month12Ago.setMonth(month12Ago.getMonth() - 11);
  month12Ago.setDate(1);
  month12Ago.setHours(0, 0, 0, 0);

  const [farrowings, weanings] = await Promise.all([
    prisma.farrowingEvent.findMany({
      where:  { tenantId, startDatetime: { gte: month12Ago } },
      select: { startDatetime: true, bornAlive: true, bornDead: true, mummified: true },
    }),
    prisma.weaningEvent.findMany({
      where:  { tenantId, weaningDate: { gte: month12Ago } },
      select: { weaningDate: true, pigletsWeaned: true, avgPigletWeightKg: true },
    }),
  ]);

  // Agrupar por mes
  const months: Record<string, {
    month:       string;
    partos:      number;
    bornAlive:   number;
    bornDead:    number;
    destetes:    number;
    lechDestetados: number;
    avgWeanWeight: number | null;
    sumWeanWeight: number;
    weanCount:   number;
  }> = {};

  for (let i = 0; i < 12; i++) {
    const d = new Date(month12Ago);
    d.setMonth(d.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-PY", { month: "short", year: "2-digit" });
    months[key] = { month: label, partos: 0, bornAlive: 0, bornDead: 0, destetes: 0, lechDestetados: 0, avgWeanWeight: null, sumWeanWeight: 0, weanCount: 0 };
  }

  for (const f of farrowings) {
    const d   = new Date(f.startDatetime);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (months[key]) {
      months[key].partos++;
      months[key].bornAlive += f.bornAlive;
      months[key].bornDead  += f.bornDead + f.mummified;
    }
  }

  for (const w of weanings) {
    const d   = new Date(w.weaningDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (months[key]) {
      months[key].destetes++;
      months[key].lechDestetados += w.pigletsWeaned;
      months[key].sumWeanWeight  += Number(w.avgPigletWeightKg);
      months[key].weanCount++;
    }
  }

  const result = Object.values(months).map((m) => ({
    month:          m.month,
    partos:         m.partos,
    bornAlive:      m.bornAlive,
    bornDead:       m.bornDead,
    destetes:       m.destetes,
    lechDestetados: m.lechDestetados,
    avgWeanWeight:  m.weanCount > 0 ? +(m.sumWeanWeight / m.weanCount).toFixed(2) : null,
    totalBorn:      m.bornAlive + m.bornDead,
    lossRate:       (m.bornAlive + m.bornDead) > 0
      ? +((m.bornDead / (m.bornAlive + m.bornDead)) * 100).toFixed(1)
      : 0,
  }));

  return NextResponse.json(result);
}
