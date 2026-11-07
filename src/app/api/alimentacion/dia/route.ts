export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

// kg recomendados por fase
function kgRec(fase: string, count: number, piglets = 0): number {
  switch (fase) {
    case "LACTATION":    return +(6 + piglets * 0.2).toFixed(1);
    case "PRE_STARTER":  return +(piglets * 0.2).toFixed(1);
    case "GESTATION":    return +(count * 2.8).toFixed(1);
    case "PHASE_1":      return +(count * 0.8).toFixed(1);
    case "PHASE_2":      return +(count * 1.5).toFixed(1);
    case "GROWING":      return +(count * 2.5).toFixed(1);
    default:             return 0;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const fechaParam = req.nextUrl.searchParams.get("fecha");
  const faseParam  = req.nextUrl.searchParams.get("fase"); // optional filter

  const today = fechaParam ? new Date(fechaParam) : new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Load FeedTypes for this tenant
  const feedTypes = await prisma.feedType.findMany({
    where: { tenantId, isActive: true },
  });
  const ftByPhase = Object.fromEntries(feedTypes.map(ft => [ft.phase, ft]));

  // Load today's FeedRecords
  const todayRecords = await prisma.feedRecord.findMany({
    where: { tenantId, recordDate: { gte: today, lt: tomorrow } },
  });
  const recByFarrowing  = Object.fromEntries(todayRecords.filter(r => r.farrowingId).map(r => [r.farrowingId!, r]));
  const recByNursery    = Object.fromEntries(todayRecords.filter(r => r.nurseryBatchId).map(r => [r.nurseryBatchId!, r]));
  const recByGrowing    = Object.fromEntries(todayRecords.filter(r => r.growingBatchId).map(r => [r.growingBatchId!, r]));

  const items: object[] = [];

  // ── 0. Cerdas en gestación ──────────────────────────────────────────────────
  if (!faseParam || faseParam === "gestacion") {
    const gestSows = await prisma.sow.findMany({
      where: { tenantId, plantelState: "PREGNANT", isActive: true },
    });
    if (gestSows.length > 0) {
      const ft    = ftByPhase["GESTATION"];
      const gestRec = todayRecords.find(
        r => !r.farrowingId && !r.nurseryBatchId && !r.growingBatchId && r.feedTypeId === ft?.id,
      );
      items.push({
        id:             "gestacion-group",
        tipo:           "GESTATION_GROUP",
        label:          `Cerdas en gestación (${gestSows.length})`,
        fase:           "Gestación",
        faseKey:        "GESTATION",
        feedTypeId:     ft?.id ?? null,
        feedTypeName:   ft?.name ?? "Gestación",
        animalesCount:  gestSows.length,
        pigletsCount:   0,
        kgRecomendados: kgRec("GESTATION", gestSows.length),
        kgEntregados:   gestRec ? Number(gestRec.quantityKg) : null,
        recordId:       gestRec?.id ?? null,
        empleadoId:     gestRec?.employeeId ?? null,
      });
    }
  }

  // ── 1. Farrowings activos (maternidad) ──────────────────────────────────────
  if (!faseParam || faseParam === "maternidad") {
    const farrowings = await prisma.farrowingEvent.findMany({
      where: { tenantId, weaning: null },
      include: { sow: { select: { identCode: true } } },
      orderBy: { startDatetime: "asc" },
    });

    for (const f of farrowings) {
      const ft = ftByPhase["LACTATION"];
      const rec = recByFarrowing[f.id];
      items.push({
        id:            f.id,
        tipo:          "FARROWING_SOW",
        label:         `Cerda ${f.sow.identCode}`,
        fase:          "Lactancia",
        faseKey:       "LACTATION",
        feedTypeId:    ft?.id ?? null,
        feedTypeName:  ft?.name ?? "Lactancia hembra",
        animalesCount: 1,
        pigletsCount:  0, // stock dinámico no disponible aquí — se puede calcular si se necesita
        kgRecomendados: kgRec("LACTATION", 1, 0),
        kgEntregados:  rec ? Number(rec.quantityKg) : null,
        recordId:      rec?.id ?? null,
        empleadoId:    rec?.employeeId ?? null,
      });
    }
  }

  // ── 2. Nursery batches activos (iniciación) ────────────────────────────────
  if (!faseParam || faseParam === "iniciacion") {
    const nurseryBatches = await prisma.nurseryBatch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { entryDate: "asc" },
    });

    for (const b of nurseryBatches) {
      const phaseKey = b.phase === "PHASE_1" ? "PHASE_1" : "PHASE_2";
      const ft       = ftByPhase[phaseKey];
      const rec      = recByNursery[b.id];
      items.push({
        id:            b.id,
        tipo:          "NURSERY",
        label:         `Lote ${b.batchCode}`,
        fase:          b.phase === "PHASE_1" ? "Iniciación F1" : "Iniciación F2",
        faseKey:       phaseKey,
        feedTypeId:    ft?.id ?? null,
        feedTypeName:  ft?.name ?? (b.phase === "PHASE_1" ? "Iniciación F1" : "Iniciación F2"),
        animalesCount: b.currentCount,
        pigletsCount:  0,
        kgRecomendados: kgRec(phaseKey, b.currentCount),
        kgEntregados:  rec ? Number(rec.quantityKg) : null,
        recordId:      rec?.id ?? null,
        empleadoId:    rec?.employeeId ?? null,
      });
    }
  }

  // ── 3. Growing batches activos (engorde) ────────────────────────────────────
  if (!faseParam || faseParam === "engorde") {
    const growingBatches = await prisma.growingBatch.findMany({
      where: { tenantId, isActive: true, status: "ACTIVE" },
      orderBy: { entryDate: "asc" },
    });

    for (const b of growingBatches) {
      const ft  = ftByPhase["GROWING"];
      const rec = recByGrowing[b.id];
      items.push({
        id:            b.id,
        tipo:          "GROWING",
        label:         `Lote ${b.batchCode}`,
        fase:          "Engorde",
        faseKey:       "GROWING",
        feedTypeId:    ft?.id ?? null,
        feedTypeName:  ft?.name ?? "Engorde",
        animalesCount: b.currentCount,
        pigletsCount:  0,
        kgRecomendados: kgRec("GROWING", b.currentCount),
        kgEntregados:  rec ? Number(rec.quantityKg) : null,
        recordId:      rec?.id ?? null,
        empleadoId:    rec?.employeeId ?? null,
      });
    }
  }

  const totalRegistrados  = items.filter((i: any) => i.kgEntregados !== null).length;
  const totalPendientes   = items.length - totalRegistrados;
  const totalKgHoy        = items.reduce((s: number, i: any) => s + (i.kgEntregados ?? 0), 0);
  const totalKgEstimado   = items.reduce((s: number, i: any) => s + i.kgRecomendados, 0);

  return NextResponse.json({
    fecha:   today.toISOString().slice(0, 10),
    items,
    summary: { total: items.length, registrados: totalRegistrados, pendientes: totalPendientes, totalKgHoy, totalKgEstimado },
  });
}
