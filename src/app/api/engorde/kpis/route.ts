import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { diffDays, addDays } from "@/lib/utils";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "engorde.lotes.ver")) return NextResponse.json({ error: "No tenés permiso para ver esto", permiso: "engorde.lotes.ver" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const today = new Date();

  const lotes = await prisma.growingBatch.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: {
      weightRecords: { orderBy: { recordDate: "desc" }, take: 1 },
      deaths: { select: { count: true, cause: true } },
      otherExits: { select: { exitType: true, count: true } },
    },
  });

  const totalAnimales = lotes.reduce((s, l) => s + l.currentCount, 0);
  const totalHospital = lotes.reduce((s, l) =>
    s + l.otherExits.filter(e => e.exitType === "HOSPITAL").reduce((a, e) => a + e.count, 0), 0);
  const totalDescartados = lotes.reduce((s, l) =>
    s + l.otherExits.filter(e => e.exitType === "DISCARD").reduce((a, e) => a + e.count, 0), 0);

  // GDP promedio (solo lotes con pesaje reciente)
  const gdpValues: number[] = [];
  const gdpPorLote: { batchCode: string; sitio: string | null; gdp: number | null; status: "ok" | "warn" | "bad" | null }[] = [];

  let totalMuertes = 0;
  let totalAnimalesIngresados = 0;

  const alertas: { tipo: "danger" | "warning" | "info" | "ok"; mensaje: string }[] = [];

  for (const l of lotes) {
    const lastPesaje = l.weightRecords[0] ?? null;
    const diasDesdeUltimoPesaje = lastPesaje
      ? diffDays(new Date(lastPesaje.recordDate), today)
      : 999;

    const muertes = l.deaths.reduce((s, d) => s + d.count, 0);
    totalMuertes += muertes;
    totalAnimalesIngresados += l.currentCount + muertes;

    let gdp: number | null = null;
    let gdpStatus: "ok" | "warn" | "bad" | null = null;

    if (lastPesaje?.dailyGainKg) {
      gdp = Math.round(Number(lastPesaje.dailyGainKg) * 1000);
      gdpStatus = gdp >= 800 ? "ok" : gdp >= 700 ? "warn" : "bad";
      gdpValues.push(gdp);

      if (gdp < 700) {
        alertas.push({ tipo: "danger", mensaje: `Lote ${l.batchCode} — GDP por debajo del mínimo (${gdp} g/día)` });
      }

      // Estimación de salida
      const targetKg = l.targetWeightKg ? Number(l.targetWeightKg) : 120;
      const currentKg = Number(lastPesaje.avgWeightKg);
      if (gdp > 0 && currentKg < targetKg) {
        const diasRestantes = Math.ceil(((targetKg - currentKg) * 1000) / gdp);
        if (diasRestantes <= 60) {
          alertas.push({ tipo: "info", mensaje: `Lote ${l.batchCode} — salida estimada en ${diasRestantes} días` });
        }
      }
    }

    if (diasDesdeUltimoPesaje > 10) {
      alertas.push({ tipo: "warning", mensaje: `Lote ${l.batchCode} — sin pesaje hace ${diasDesdeUltimoPesaje} días` });
    }

    gdpPorLote.push({ batchCode: l.batchCode, sitio: l.sitio, gdp, status: gdpStatus });
  }

  const gdpPromedio = gdpValues.length > 0
    ? Math.round(gdpValues.reduce((a, b) => a + b, 0) / gdpValues.length)
    : null;

  const mortalidadPct = totalAnimalesIngresados > 0
    ? Math.round((totalMuertes / totalAnimalesIngresados) * 1000) / 10
    : 0;

  if (mortalidadPct <= 1.5) {
    alertas.push({ tipo: "ok", mensaje: `Mortalidad global ${mortalidadPct.toFixed(2)}% — por debajo de la meta` });
  }

  // Ordenar alertas: danger > warning > info > ok
  const orden = { danger: 0, warning: 1, info: 2, ok: 3 };
  alertas.sort((a, b) => orden[a.tipo] - orden[b.tipo]);

  return NextResponse.json({
    kpis: {
      lotesAbiertos: lotes.length,
      stockTotal: totalAnimales,
      hospitalCount: totalHospital,
      descartadosCount: totalDescartados,
      mortalidadPct,
      gdpPromedio,
    },
    alertas,
    gdpPorLote,
  });
}
