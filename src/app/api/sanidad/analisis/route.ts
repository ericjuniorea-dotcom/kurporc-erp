export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

function getWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
function weekLabel(d: Date) { return `${d.getFullYear()}-W${String(getWeek(d)).padStart(2, "0")}`; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

const SECTOR_LABEL: Record<string, string> = {
  plantel: "Plantel Reproductivo", gestacion: "Gestación", maternidad: "Maternidad",
  iniciacion: "Iniciación", recria: "Recría", engorde: "Engorde", granja: "Granja",
};

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["sanidad.aplicaciones.ver", "sanidad.tratamientos.ver", "sanidad.protocolos.ver", "sanidad.necropsias.ver", "sanidad.botiquin.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const { tenantId } = session.user;

  const sp    = req.nextUrl.searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  const from  = desde ? new Date(desde) : addDays(new Date(), -90);
  const to    = hasta ? new Date(hasta) : new Date();
  to.setHours(23, 59, 59, 999);

  const [eventos, aplicaciones] = await Promise.all([
    prisma.eventoVacunacion.findMany({
      where: { tenantId, fecha: { gte: from, lte: to }, estado: { not: "omitido" } },
      select: { id: true, fecha: true, sector: true, estado: true },
    }),
    prisma.aplicacionVacuna.findMany({
      where: { tenantId, fechaAplicacion: { gte: from, lte: to } },
      include: {
        vacuna: { select: { nombre: true, codigo: true } },
        evento: { select: { sector: true, fecha: true } },
      },
    }),
  ]);

  // Primer aplicación real por evento — para juzgar cumplimiento "a tiempo"
  const primeraAplicacionPorEvento = new Map<string, Date>();
  for (const a of aplicaciones) {
    if (!a.eventoId) continue;
    const actual = primeraAplicacionPorEvento.get(a.eventoId);
    if (!actual || a.fechaAplicacion < actual) primeraAplicacionPorEvento.set(a.eventoId, a.fechaAplicacion);
  }

  // ── 1. Cumplimiento semanal ──────────────────────────────────────────────
  const semanaMap = new Map<string, { total: number; aTiempo: number }>();
  for (const e of eventos) {
    const k = weekLabel(e.fecha);
    const cur = semanaMap.get(k) ?? { total: 0, aTiempo: 0 };
    cur.total++;
    const primera = primeraAplicacionPorEvento.get(e.id);
    if (e.estado === "aplicado" && primera && primera <= e.fecha) cur.aTiempo++;
    semanaMap.set(k, cur);
  }
  const cumplimientoSemanal = Array.from(semanaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, { total, aTiempo }]) => ({
      semana: semana.replace(/^\d{4}-/, ""),
      pct: total > 0 ? +((aTiempo / total) * 100).toFixed(1) : 100,
    }));

  const totalEventos = eventos.length;
  const totalATiempo = eventos.filter(e => {
    const primera = primeraAplicacionPorEvento.get(e.id);
    return e.estado === "aplicado" && primera && primera <= e.fecha;
  }).length;
  const cumplimientoPromedio = totalEventos > 0 ? +((totalATiempo / totalEventos) * 100).toFixed(1) : 100;
  const tasaRetraso = totalEventos > 0 ? +((eventos.filter(e => e.estado === "retrasado").length / totalEventos) * 100).toFixed(1) : 0;

  // ── 2. Distribución por sector (sobre aplicaciones reales) ───────────────
  const sectorMap = new Map<string, number>();
  for (const a of aplicaciones) {
    const sector = a.evento?.sector ?? "granja";
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + a.dosisAplicadas);
  }
  const totalDosisAplicadas = Array.from(sectorMap.values()).reduce((s, v) => s + v, 0);
  const distribucionSector = Array.from(sectorMap.entries())
    .map(([sector, dosis]) => ({
      sector, label: SECTOR_LABEL[sector] ?? sector, dosis,
      pct: totalDosisAplicadas > 0 ? +((dosis / totalDosisAplicadas) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.dosis - a.dosis);

  // ── 3. Ranking de vacunas/productos más aplicados ────────────────────────
  const vacunaMap = new Map<string, { nombre: string; codigo: string | null; dosis: number }>();
  for (const a of aplicaciones) {
    const cur = vacunaMap.get(a.vacunaId) ?? { nombre: a.vacuna.nombre, codigo: a.vacuna.codigo, dosis: 0 };
    cur.dosis += a.dosisAplicadas;
    vacunaMap.set(a.vacunaId, cur);
  }
  const rankingVacunas = Array.from(vacunaMap.entries())
    .map(([vacunaId, v]) => ({ vacunaId, ...v }))
    .sort((a, b) => b.dosis - a.dosis)
    .slice(0, 10);

  return NextResponse.json({
    kpis: { totalAplicaciones: aplicaciones.length, cumplimientoPromedio, tasaRetraso },
    cumplimientoSemanal,
    distribucionSector,
    rankingVacunas,
  });
}
