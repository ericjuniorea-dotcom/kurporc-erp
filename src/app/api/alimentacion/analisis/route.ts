export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

function getWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
function weekLabel(d: Date) { return `${d.getFullYear()}-W${String(getWeek(d)).padStart(2, "0")}`; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "alimentacion.consumos.ver")) return NextResponse.json({ error: "No tenés permiso para ver esto", permiso: "alimentacion.consumos.ver" }, { status: 403 });
  const { tenantId } = session.user;

  const sp    = req.nextUrl.searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");

  const from = desde ? new Date(desde) : addDays(new Date(), -90);
  const to   = hasta ? new Date(hasta) : new Date();
  to.setHours(23, 59, 59, 999);

  const [records, feedTypes, lotes, growingBatches] = await Promise.all([
    prisma.feedRecord.findMany({
      where: { tenantId, recordDate: { gte: from, lte: to } },
      include: { feedType: { select: { name: true, phase: true } } },
      orderBy: { recordDate: "asc" },
    }),
    prisma.feedType.findMany({ where: { tenantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.loteInventario.findMany({
      where: { tenantId, vacuna: { categoria: "BALANCEADO" } },
      select: { vacunaId: true, cantidadActual: true },
    }),
    prisma.growingBatch.findMany({ where: { tenantId, isActive: true, status: "ACTIVE" } }),
  ]);

  // ── 1. Consumo semanal total ────────────────────────────────────────────────
  const weekMap = new Map<string, number>();
  for (const r of records) {
    const k = weekLabel(r.recordDate);
    weekMap.set(k, (weekMap.get(k) ?? 0) + Number(r.quantityKg));
  }
  const consumoSemanal = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, total]) => ({ semana: semana.replace(/^\d{4}-/, ""), totalKg: +total.toFixed(1) }));

  const totalPeriodo = records.reduce((s, r) => s + Number(r.quantityKg), 0);
  const promSemanal  = consumoSemanal.length > 0 ? totalPeriodo / consumoSemanal.length : 0;

  // ── 2. Distribución por fase ───────────────────────────────────────────────
  const faseMap = new Map<string, { name: string; kg: number }>();
  for (const r of records) {
    const k = r.feedType.phase;
    const cur = faseMap.get(k) ?? { name: r.feedType.name, kg: 0 };
    cur.kg += Number(r.quantityKg);
    faseMap.set(k, cur);
  }
  const distribucion = Array.from(faseMap.entries())
    .map(([phase, { name, kg }]) => ({ phase, name, kg: +kg.toFixed(1), pct: totalPeriodo > 0 ? +(kg / totalPeriodo * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.kg - a.kg);

  // ── 3. Conversión alimenticia (solo GROWING) ───────────────────────────────
  const growingRecords = records.filter(r => r.feedType.phase === "GROWING");
  const weekGrowing    = new Map<string, number>();
  for (const r of growingRecords) {
    const k = weekLabel(r.recordDate);
    weekGrowing.set(k, (weekGrowing.get(k) ?? 0) + Number(r.quantityKg));
  }
  const totalAnimalesEngorde = growingBatches.reduce((s, b) => s + b.currentCount, 0);
  const daysDiff = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
  const totalKgEngorde = Array.from(weekGrowing.values()).reduce((s, v) => s + v, 0);
  const kgGananciaEstimada = totalAnimalesEngorde * daysDiff * (0.8 / 1000); // ~800g/animal/día convertido a t estimada
  const conversionGlobal   = kgGananciaEstimada > 0 ? +(totalKgEngorde / kgGananciaEstimada).toFixed(2) : 0;

  const conversionSemanal = Array.from(weekGrowing.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, kgAlim]) => {
      const kgGanancia = totalAnimalesEngorde * 7 * 0.8;
      const conv       = kgGanancia > 0 ? +(kgAlim / kgGanancia).toFixed(2) : 0;
      return { semana: semana.replace(/^\d{4}-/, ""), conv };
    });

  // ── 4. Proyección de stock 30 días ────────────────────────────────────────
  const stockPorProducto = new Map<string, number>();
  for (const l of lotes) {
    stockPorProducto.set(l.vacunaId, (stockPorProducto.get(l.vacunaId) ?? 0) + Number(l.cantidadActual));
  }
  const last7 = addDays(new Date(), -7);
  const consumo7 = new Map<string, number>();
  for (const r of records.filter(x => x.recordDate >= last7)) {
    consumo7.set(r.feedTypeId, (consumo7.get(r.feedTypeId) ?? 0) + Number(r.quantityKg));
  }

  const proyeccion = feedTypes.map(ft => {
    const stockKg = ft.productoBalanceadoId ? (stockPorProducto.get(ft.productoBalanceadoId) ?? 0) : 0;
    const c7      = consumo7.get(ft.id) ?? 0;
    const cDay    = +(c7 / 7).toFixed(1);
    const dias    = cDay > 0 ? Math.floor(stockKg / cDay) : (stockKg > 0 ? 999 : 0);
    const necesita = dias < 3 ? "⚠ Urgente — hoy" : dias < 7 ? "Producir esta semana" : "No urgente";
    const urgencia = dias < 3 ? "danger" : dias < 7 ? "warning" : "success";
    return { feedTypeId: ft.id, feedTypeName: ft.name, phase: ft.phase, stockKg: +stockKg.toFixed(1), consumoDiario: cDay, diasRestantes: Math.min(dias, 999), necesita, urgencia };
  });

  // ── KPIs globales ──────────────────────────────────────────────────────────
  const kpis = {
    totalConsumo:    +totalPeriodo.toFixed(1),
    promSemanal:     +promSemanal.toFixed(1),
    conversionGlobal,
    metaConversion:  2.35,
  };

  return NextResponse.json({ kpis, consumoSemanal, distribucion, conversionSemanal, proyeccion });
}
