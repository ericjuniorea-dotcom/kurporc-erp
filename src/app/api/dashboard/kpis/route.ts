import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenantId = session.user.tenantId;
  const today    = new Date();
  const day30Ago = new Date(today); day30Ago.setDate(day30Ago.getDate() - 30);
  const day60Ago = new Date(today); day60Ago.setDate(day60Ago.getDate() - 60);

  // Tasa de parición (partos con lechón vivo / servicios en ventana previa ~114 días)
  const services144dAgo = new Date(today); services144dAgo.setDate(services144dAgo.getDate() - 144);

  // Ninguna de estas consultas depende de otra — todas se disparan juntas
  // (antes iban en dos tandas de Promise.all seguidas, ahora es una sola).
  const [
    activeSows,
    activeFarrowings,
    activeNurseryBatches,
    pendingHealthTasks,
    overdueHealthTasks,
    unreadAlerts,
    // Partos últimos 30 días
    farrowings30d,
    // Destetes últimos 30 días
    weanings30d,
    // GDP promedio recría activa
    nurseryWeight,
    servicesInWindow,
    farrowingsFromWindow,
  ] = await Promise.all([
    prisma.sow.count({ where: { tenantId, isActive: true } }),
    prisma.farrowingEvent.count({ where: { tenantId, weaning: null } }),
    prisma.nurseryBatch.count({ where: { tenantId, isActive: true } }),
    prisma.healthTask.count({ where: { tenantId, isCompleted: false } }),
    prisma.healthTask.count({ where: { tenantId, isCompleted: false, dueDate: { lt: today } } }),
    prisma.alert.count({ where: { tenantId, isRead: false, isResolved: false } }),
    prisma.farrowingEvent.findMany({
      where: { tenantId, startDatetime: { gte: day30Ago } },
      select: { bornAlive: true, bornDead: true, mummified: true },
    }),
    prisma.weaningEvent.findMany({
      where:  { tenantId, weaningDate: { gte: day30Ago } },
      select: { pigletsWeaned: true, lactationDays: true, avgPigletWeightKg: true },
    }),
    prisma.nurseryBatch.findMany({
      where:   { tenantId, isActive: true },
      include: { weightRecords: { orderBy: { recordDate: "desc" }, take: 1, select: { dailyGainKg: true } } },
    }),
    prisma.serviceEvent.count({
      where: { tenantId, serviceDate: { gte: services144dAgo, lte: new Date(today.getTime() - 114 * 86400000) } },
    }),
    prisma.farrowingEvent.count({
      where: { tenantId, startDatetime: { gte: day30Ago } },
    }),
  ]);

  const paritionRate = servicesInWindow > 0
    ? Math.round((farrowingsFromWindow / servicesInWindow) * 100)
    : null;

  // KPIs de partos últimos 30d
  const totalBorn30d    = farrowings30d.reduce((s, f) => s + f.bornAlive + f.bornDead + f.mummified, 0);
  const totalBornAlive30d = farrowings30d.reduce((s, f) => s + f.bornAlive, 0);
  const birthLossRate   = totalBorn30d > 0
    ? ((totalBorn30d - totalBornAlive30d) / totalBorn30d * 100).toFixed(1)
    : null;

  // KPIs de destetes últimos 30d
  const totalWeaned30d  = weanings30d.reduce((s, w) => s + w.pigletsWeaned, 0);
  const avgLactDays     = weanings30d.length > 0
    ? Math.round(weanings30d.reduce((s, w) => s + w.lactationDays, 0) / weanings30d.length)
    : null;
  const avgWeanWeight   = weanings30d.length > 0
    ? (weanings30d.reduce((s, w) => s + Number(w.avgPigletWeightKg), 0) / weanings30d.length).toFixed(2)
    : null;

  // GDP promedio recría activa
  const gdpValues = nurseryWeight
    .map((b) => b.weightRecords[0]?.dailyGainKg != null ? Number(b.weightRecords[0].dailyGainKg) : null)
    .filter((v): v is number => v !== null);
  const avgGdp = gdpValues.length > 0
    ? (gdpValues.reduce((s, v) => s + v, 0) / gdpValues.length * 1000).toFixed(0)
    : null;

  return NextResponse.json({
    // Inventario
    activeSows,
    activeFarrowings,
    activeNurseryBatches,
    // Alertas
    pendingHealthTasks,
    overdueHealthTasks,
    unreadAlerts,
    // Últimos 30d
    farrowings30d:   farrowings30d.length,
    weanings30d:     weanings30d.length,
    totalWeaned30d,
    birthLossRate,
    avgLactDays,
    avgWeanWeight,
    avgGdpGday:     avgGdp,
    paritionRate,
  });
}
