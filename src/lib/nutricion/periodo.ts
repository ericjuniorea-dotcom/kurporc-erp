// Sanidad y Nutrición · consumo de balanceado por día, semana, mes o año (kg y costo), por módulo y por balanceado,
// con el detalle de cada carga (quién y a qué hora).
import "server-only";
import prisma from "@/lib/db/prisma";
import { esModuloNutricion, MODULOS_NUTRICION, type ModuloNutricion } from "./plan";

export type Agrupar = "dia" | "semana" | "mes" | "anio";
const DIA = 86_400_000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dm = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Clave y etiqueta del período de una fecha (las fechas de registro son días UTC). Semana = de lunes a domingo. */
function periodo(d: Date, a: Agrupar): { clave: string; etiqueta: string } {
  if (a === "dia") return { clave: d.toISOString().slice(0, 10), etiqueta: `${dm(d)}/${d.getUTCFullYear()}` };
  if (a === "mes") return { clave: d.toISOString().slice(0, 7), etiqueta: `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  if (a === "anio") return { clave: String(d.getUTCFullYear()), etiqueta: String(d.getUTCFullYear()) };
  const lunes = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DIA);
  const domingo = new Date(lunes.getTime() + 6 * DIA);
  return { clave: lunes.toISOString().slice(0, 10), etiqueta: `${dm(lunes)} al ${dm(domingo)}` };
}

export async function consumoPorPeriodo(tenantId: string, desde: string, hasta: string, agrupar: Agrupar) {
  const ini = new Date(`${desde}T00:00:00Z`), fin = new Date(new Date(`${hasta}T00:00:00Z`).getTime() + DIA);
  const regs = await prisma.feedRecord.findMany({
    where: { tenantId, recordDate: { gte: ini, lt: fin }, anuladoEn: null },
    orderBy: [{ recordDate: "desc" }, { createdAt: "desc" }],
    select: { id: true, recordDate: true, createdAt: true, quantityKg: true, employeeId: true, feedTypeId: true,
      feedType: { select: { name: true, modulo: true } },
      farrowing: { select: { sow: { select: { id: true, caravanaCode: true, identCode: true } } } } },
  });

  // Costo de cada carga = lo que salió del stock por ella × el precio de su lote (menos devoluciones)
  const costo = new Map<string, number>();
  for (let i = 0; i < regs.length; i += 2000) {
    const movs = await prisma.movimientoInventario.findMany({
      where: { tenantId, origen: "ALIMENTACION", referenciaId: { in: regs.slice(i, i + 2000).map(r => r.id) } },
      select: { referenciaId: true, tipo: true, cantidad: true, lote: { select: { costoUnitario: true } } },
    });
    for (const m of movs) {
      const v = Math.abs(Number(m.cantidad)) * Number(m.lote?.costoUnitario ?? 0) * (m.tipo === "SALIDA" ? 1 : -1);
      costo.set(m.referenciaId!, (costo.get(m.referenciaId!) ?? 0) + v);
    }
  }
  const ids = Array.from(new Set(regs.map(r => r.employeeId).filter((x): x is string => !!x)));
  const nombre = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map(u => [u.id, u.name]));

  const grupos = new Map<string, { clave: string; etiqueta: string; kg: number; costoGs: number; cargas: number; porModulo: Partial<Record<ModuloNutricion, number>> }>();
  const porBal = new Map<string, { nombre: string; modulo: string; kg: number; costoGs: number; cargas: number }>();
  for (const r of regs) {
    const kg = Number(r.quantityKg), c = costo.get(r.id) ?? 0;
    const p = periodo(r.recordDate, agrupar);
    const g = grupos.get(p.clave) ?? { ...p, kg: 0, costoGs: 0, cargas: 0, porModulo: {} };
    g.kg += kg; g.costoGs += c; g.cargas++;
    if (esModuloNutricion(r.feedType.modulo)) g.porModulo[r.feedType.modulo] = (g.porModulo[r.feedType.modulo] ?? 0) + kg;
    grupos.set(p.clave, g);
    const b = porBal.get(r.feedTypeId) ?? { nombre: r.feedType.name, modulo: esModuloNutricion(r.feedType.modulo) ? MODULOS_NUTRICION[r.feedType.modulo].etiqueta : "—", kg: 0, costoGs: 0, cargas: 0 };
    b.kg += kg; b.costoGs += c; b.cargas++;
    porBal.set(r.feedTypeId, b);
  }

  return {
    grupos: Array.from(grupos.values()).sort((a, b) => b.clave.localeCompare(a.clave)).map(g => ({ ...g, costoGs: Math.round(g.costoGs) })),
    porBalanceado: Array.from(porBal.values()).sort((a, b) => b.kg - a.kg).map(b => ({ ...b, costoGs: Math.round(b.costoGs) })),
    total: { kg: regs.reduce((s, r) => s + Number(r.quantityKg), 0), costoGs: Math.round(Array.from(costo.values()).reduce((s, v) => s + v, 0)), cargas: regs.length },
    cargas: regs.slice(0, 300).map(r => ({
      id: r.id, fecha: r.recordDate.toISOString().slice(0, 10), hora: r.createdAt.toISOString(), kg: Number(r.quantityKg), costoGs: Math.round(costo.get(r.id) ?? 0),
      balanceado: r.feedType.name, modulo: esModuloNutricion(r.feedType.modulo) ? MODULOS_NUTRICION[r.feedType.modulo].etiqueta : "—",
      cerda: r.farrowing ? { id: r.farrowing.sow.id, caravana: r.farrowing.sow.caravanaCode || r.farrowing.sow.identCode } : null,
      quien: r.employeeId ? nombre.get(r.employeeId) ?? null : null,
    })),
  };
}
