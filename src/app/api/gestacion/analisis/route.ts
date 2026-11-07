import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { isoWeekLabel } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const sp   = req.nextUrl.searchParams;
  const now  = new Date();
  const def  = new Date(now); def.setDate(def.getDate() - 90);
  const desde = sp.get("desde") ? new Date(sp.get("desde")!) : def;
  const hasta = sp.get("hasta") ? new Date(sp.get("hasta")!) : now;
  hasta.setHours(23, 59, 59, 999);

  const [serviceEvents, heatRepeats, abortions, sows] = await Promise.all([
    prisma.serviceEvent.findMany({
      where: { tenantId, serviceDate: { gte: desde, lte: hasta } },
      include: {
        sow:          { select: { identCode: true, currentParityCount: true } },
        boar:         { select: { identCode: true } },
        farrowing:    { select: { gestationDays: true } },
        pregnancyChecks: { select: { result: true }, orderBy: { checkDate: "desc" }, take: 1 },
        serviceBatch: { select: { weekLabel: true } },
      },
      orderBy: { serviceDate: "asc" },
    }),
    prisma.heatRepeat.findMany({ where: { tenantId, repeatDate: { gte: desde, lte: hasta } } }),
    prisma.abortionEvent.findMany({ where: { tenantId, abortionDate: { gte: desde, lte: hasta } } }),
    prisma.sow.findMany({ where: { tenantId, isActive: true }, select: { currentParityCount: true } }),
  ]);

  const total    = serviceEvents.length;
  const conParto = serviceEvents.filter(e => e.farrowing).length;

  // KPIs
  const gestDays = serviceEvents.filter(e => e.farrowing?.gestationDays).map(e => e.farrowing!.gestationDays!);
  const kpis = {
    totalServicios:       total,
    tasaParicion:         total > 0 ? Math.round((conParto / total) * 1000) / 10 : 0,
    diasGestacionPromedio:gestDays.length > 0
      ? Math.round(gestDays.reduce((a, b) => a + b, 0) / gestDays.length * 10) / 10
      : null,
    totalRepeticiones:    heatRepeats.length,
    tasaRepeticion:       total > 0 ? Math.round((heatRepeats.length / total) * 1000) / 10 : 0,
    totalAbortos:         abortions.length,
  };

  // Parición por lote
  const loteMap = new Map<string, { servicios: number; partos: number }>();
  for (const e of serviceEvents) {
    const k = e.serviceBatch.weekLabel;
    if (!loteMap.has(k)) loteMap.set(k, { servicios: 0, partos: 0 });
    const v = loteMap.get(k)!;
    v.servicios++;
    if (e.farrowing) v.partos++;
  }
  const paricionPorLote = Array.from(loteMap.entries())
    .map(([lote, v]) => ({ lote, ...v, tasa: v.servicios > 0 ? Math.round((v.partos / v.servicios) * 1000) / 10 : 0 }))
    .sort((a, b) => a.lote.localeCompare(b.lote));

  // Servicios por semana
  const semMap = new Map<string, number>();
  for (const e of serviceEvents) semMap.set(isoWeekLabel(new Date(e.serviceDate)), (semMap.get(isoWeekLabel(new Date(e.serviceDate))) ?? 0) + 1);
  const serviciosPorSemana = Array.from(semMap.entries())
    .map(([semana, count]) => ({ semana, count }))
    .sort((a, b) => a.semana.localeCompare(b.semana));

  // Tasa verracos
  const verrMap = new Map<string, { servicios: number; partos: number }>();
  for (const e of serviceEvents) {
    if (!e.boar) continue;
    const k = e.boar.identCode;
    if (!verrMap.has(k)) verrMap.set(k, { servicios: 0, partos: 0 });
    const v = verrMap.get(k)!;
    v.servicios++;
    if (e.farrowing) v.partos++;
  }
  const tasaVerracos = Array.from(verrMap.entries())
    .map(([identCode, v]) => ({ identCode, ...v, tasa: v.servicios > 0 ? Math.round((v.partos / v.servicios) * 1000) / 10 : 0 }))
    .sort((a, b) => b.servicios - a.servicios);

  // Diagnósticos
  let positivos = 0, negativos = 0, recheck = 0;
  for (const e of serviceEvents) {
    const r = e.pregnancyChecks[0]?.result;
    if (r === "PREGNANT") positivos++;
    else if (r === "NOT_PREGNANT") negativos++;
    else if (r === "RECHECK") recheck++;
  }
  const diagnosticos = { positivos, negativos, recheck, sinDiagnostico: total - positivos - negativos - recheck, total };

  // Ciclos reproductivos
  const cicloMap = new Map<number, number>();
  for (const s of sows) { const c = s.currentParityCount; cicloMap.set(c, (cicloMap.get(c) ?? 0) + 1); }
  const ciclos = Array.from({ length: 7 }, (_, i) => {
    if (i < 6) return { ciclo: String(i + 1), count: cicloMap.get(i + 1) ?? 0 };
    const c7plus = Array.from(cicloMap.entries()).filter(([k]) => k >= 7).reduce((s, [, v]) => s + v, 0);
    return { ciclo: "7+", count: c7plus };
  });

  // Repeticiones por semana
  const repSemMap = new Map<string, number>();
  for (const r of heatRepeats) repSemMap.set(isoWeekLabel(new Date(r.repeatDate)), (repSemMap.get(isoWeekLabel(new Date(r.repeatDate))) ?? 0) + 1);
  const repeticionesPorSemana = Array.from(repSemMap.entries())
    .map(([semana, count]) => ({ semana, count, tasa: Math.round(((count / (semMap.get(semana) ?? 1)) * 100) * 10) / 10 }))
    .sort((a, b) => a.semana.localeCompare(b.semana));

  // Abortos por semana
  const abortSemMap = new Map<string, number>();
  for (const a of abortions) abortSemMap.set(isoWeekLabel(new Date(a.abortionDate)), (abortSemMap.get(isoWeekLabel(new Date(a.abortionDate))) ?? 0) + 1);
  const abortosPorSemana = Array.from(abortSemMap.entries())
    .map(([semana, count]) => ({ semana, count, tasa: Math.round(((count / (semMap.get(semana) ?? 1)) * 100) * 10) / 10 }))
    .sort((a, b) => a.semana.localeCompare(b.semana));

  // Días gestación por semana
  const gestSemMap = new Map<string, number[]>();
  for (const e of serviceEvents) {
    if (!e.farrowing?.gestationDays) continue;
    const k = isoWeekLabel(new Date(e.serviceDate));
    if (!gestSemMap.has(k)) gestSemMap.set(k, []);
    gestSemMap.get(k)!.push(e.farrowing.gestationDays);
  }
  const diasGestacionPorSemana = Array.from(gestSemMap.entries())
    .map(([semana, days]) => ({ semana, promedio: Math.round(days.reduce((a, b) => a + b, 0) / days.length * 10) / 10 }))
    .sort((a, b) => a.semana.localeCompare(b.semana));

  return NextResponse.json({
    kpis, paricionPorLote, serviciosPorSemana, tasaVerracos,
    diagnosticos, ciclos, repeticionesPorSemana, abortosPorSemana, diasGestacionPorSemana,
  });
}
