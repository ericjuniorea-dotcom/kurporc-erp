import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const CAUSE_LABELS: Record<string, string> = {
  WEAKNESS: "Flaqueza", CRUSHING: "Aplastamiento", DIARRHEA: "Diarrea",
  DEFICIENT: "Deficiente", DISEASE: "Enfermedad", SHELTER: "Refugio",
  HYPOTHERMIA: "Hipotermia", ACCIDENT: "Accidente", CONGENITAL: "Defecto congénito",
  ELIMINATED: "Eliminado", OTHER: "Otra",
};

function isoWeekLabel(d: Date): string {
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${wk.toString().padStart(2, "0")}/${utc.getUTCFullYear().toString().slice(2)}`;
}

function periodKey(d: Date, periodo: string): string {
  if (periodo === "SEMANA")    return isoWeekLabel(d);
  if (periodo === "MES")       return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear().toString().slice(2)}`;
  if (periodo === "TRIMESTRE") return `T${Math.ceil((d.getMonth() + 1) / 3)}/${d.getFullYear().toString().slice(2)}`;
  return d.getFullYear().toString();
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const { searchParams } = new URL(req.url);
  const periodo = searchParams.get("periodo") ?? "SEMANA";
  const from    = searchParams.get("from");
  const to      = searchParams.get("to");

  const dateWhere: Record<string, Date> = {};
  if (from) dateWhere.gte = new Date(from);
  if (to)   dateWhere.lte = new Date(to);

  const [farrowings, metas] = await Promise.all([
    prisma.farrowingEvent.findMany({
      where: {
        tenantId,
        ...(Object.keys(dateWhere).length > 0 ? { startDatetime: dateWhere } : {}),
      },
      include: { deaths: true },
      orderBy: { startDatetime: "asc" },
    }),
    prisma.configMeta.findMany({ where: { tenantId, modulo: "MATERNIDAD" } }),
  ]);

  const metaMap: Record<string, number> = {};
  for (const m of metas) metaMap[m.kpiKey] = Number(m.valor);

  // ── Global KPIs ──────────────────────────────────────────────────────────
  const totalPartos      = farrowings.length;
  const totalBornAlive   = farrowings.reduce((s, f) => s + f.bornAlive,   0);
  const totalBornDead    = farrowings.reduce((s, f) => s + f.bornDead,    0);
  const totalMummified   = farrowings.reduce((s, f) => s + f.mummified,   0);
  const totalBorn        = farrowings.reduce((s, f) => s + f.totalBorn,   0);

  const nacidosVivosAvg     = totalPartos > 0 ? +(totalBornAlive / totalPartos).toFixed(2) : 0;
  const nacidosTotalesAvg   = totalPartos > 0 ? +(totalBorn      / totalPartos).toFixed(2) : 0;
  const perdidasPct         = totalBorn   > 0 ? +((totalBornDead + totalMummified) / totalBorn * 100).toFixed(2) : 0;

  const wFarrowings = farrowings.filter(f => f.avgPigletWeightKg != null);
  const pesoMedioNacimiento = wFarrowings.length > 0
    ? +(wFarrowings.reduce((s, f) => s + Number(f.avgPigletWeightKg ?? 0), 0) / wFarrowings.length).toFixed(2)
    : 0;

  const allDeaths   = farrowings.flatMap(f => f.deaths);
  const totalMuertes = allDeaths.reduce((s, d) => s + d.quantity, 0);
  const mortalidadPct = totalBornAlive > 0 ? +(totalMuertes / totalBornAlive * 100).toFixed(2) : 0;

  // ── Serie por periodo ────────────────────────────────────────────────────
  type PeriodBucket = {
    partos: number; bornAlive: number; bornDead: number; mummified: number; totalBorn: number;
    weightSum: number; weightCount: number;
  };
  const periodMap = new Map<string, PeriodBucket>();

  for (const f of farrowings) {
    const key = periodKey(new Date(f.startDatetime), periodo);
    const cur = periodMap.get(key) ?? { partos: 0, bornAlive: 0, bornDead: 0, mummified: 0, totalBorn: 0, weightSum: 0, weightCount: 0 };
    cur.partos++;
    cur.bornAlive  += f.bornAlive;
    cur.bornDead   += f.bornDead;
    cur.mummified  += f.mummified;
    cur.totalBorn  += f.totalBorn;
    if (f.avgPigletWeightKg != null) { cur.weightSum += Number(f.avgPigletWeightKg); cur.weightCount++; }
    periodMap.set(key, cur);
  }

  const serie = Array.from(periodMap.entries()).map(([p, v]) => ({
    periodo:            p,
    partos:             v.partos,
    nacidosTotales:     v.totalBorn,
    nacidosVivos:       v.bornAlive,
    nacidosMuertos:     v.bornDead,
    momificados:        v.mummified,
    pctMomificados:     v.totalBorn > 0 ? +((v.mummified  / v.totalBorn) * 100).toFixed(2) : 0,
    pctNacidosMuertos:  v.totalBorn > 0 ? +((v.bornDead   / v.totalBorn) * 100).toFixed(2) : 0,
    perdidasPct:        v.totalBorn > 0 ? +((v.bornDead + v.mummified) / v.totalBorn * 100).toFixed(2) : 0,
    pesoMedio:          v.weightCount > 0 ? +(v.weightSum / v.weightCount).toFixed(2) : 0,
  }));

  // ── Mortalidad por edad ──────────────────────────────────────────────────
  const ageRanges = [
    { label: "≤ 5 días",  min: 0,  max: 5   },
    { label: "6 – 10",   min: 6,  max: 10  },
    { label: "11 – 20",  min: 11, max: 20  },
    { label: "≥ 21 días", min: 21, max: 9999 },
  ];

  const byAge = ageRanges.map(r => {
    const count = allDeaths
      .filter(d => { const a = d.ageAtDeathDays ?? 0; return a >= r.min && a <= r.max; })
      .reduce((s, d) => s + d.quantity, 0);
    return { label: r.label, count, pct: totalMuertes > 0 ? +(count / totalMuertes * 100).toFixed(2) : 0 };
  });

  // ── Mortalidad por causa ─────────────────────────────────────────────────
  const causeMap = new Map<string, number>();
  for (const d of allDeaths) causeMap.set(d.cause, (causeMap.get(d.cause) ?? 0) + d.quantity);
  const byCause = Array.from(causeMap.entries())
    .map(([cause, count]) => ({
      cause, label: CAUSE_LABELS[cause] ?? cause, count,
      pct: totalMuertes > 0 ? +(count / totalMuertes * 100).toFixed(2) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    kpis: { totalPartos, nacidosTotalesAvg, nacidosVivosAvg, perdidasPct, pesoMedioNacimiento, totalMuertes, mortalidadPct },
    metas: metaMap,
    serie,
    byAge,
    byCause,
  });
}
