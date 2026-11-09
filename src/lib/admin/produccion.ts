// Fase 11 (parte 2) · Cómo funcionan todas las granjas y cuánto factura cada una.
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC, mesDe } from "@/lib/finanzas/calculos";
import { datosAnio, sanidadAnio } from "@/lib/finanzas/anio";
import { hojaCostos } from "@/lib/finanzas/hojas";
import { resumenParadas } from "@/lib/cerdas-paradas/datos";

const DIA = 86_400_000;
export const IVA_ANIMALES = 0.05; // IVA de animales vivos en Paraguay

export async function produccionGranjas() {
  const hoy = hoyUTC(), desde = new Date(hoy.getTime() - 365 * DIA);
  const orgs = await prisma.tenant.findMany({ where: { tipo: { not: "VENDEDOR" } }, select: { id: true, farmName: true, departamento: true } });
  const [estados, partos, destetes, muertes] = await Promise.all([
    prisma.sow.groupBy({ by: ["tenantId", "plantelState"], where: { isActive: true }, _count: { _all: true } }),
    prisma.farrowingEvent.groupBy({ by: ["tenantId"], where: { startDatetime: { gte: desde } }, _count: { _all: true }, _sum: { bornAlive: true } }),
    prisma.weaningEvent.groupBy({ by: ["tenantId"], where: { weaningDate: { gte: desde } }, _sum: { pigletsWeaned: true } }),
    prisma.pigletDeath.groupBy({ by: ["tenantId"], where: { deathDatetime: { gte: desde } }, _sum: { quantity: true } }),
  ]);
  const filas = [];
  for (const o of orgs) {
    const est = estados.filter(e => e.tenantId === o.id);
    const madres = est.reduce((s, e) => s + e._count._all, 0);
    if (!madres) continue;
    const cuenta = (...xs: string[]) => est.filter(e => xs.includes(e.plantelState ?? "")).reduce((s, e) => s + e._count._all, 0);
    const p = partos.find(x => x.tenantId === o.id), w = destetes.find(x => x.tenantId === o.id), m = muertes.find(x => x.tenantId === o.id);
    const vivos = p?._sum.bornAlive ?? 0;
    const par = await resumenParadas(o.id).catch(() => null);
    filas.push({
      id: o.id, nombre: o.farmName, departamento: o.departamento ?? "—", madres,
      estados: { servidas: cuenta("MATED"), gestantes: cuenta("PREGNANT", "FARROWING"), lactancia: cuenta("LACTATING"), vacias: cuenta("EMPTY"), otras: madres - cuenta("MATED", "PREGNANT", "FARROWING", "LACTATING", "EMPTY") },
      partos12: p?._count._all ?? 0,
      nacidosVivosParto: p?._count._all ? vivos / p._count._all : null,
      destetadosCerdaAnio: (w?._sum.pigletsWeaned ?? 0) / madres,
      mortalidadPredestete: vivos ? (m?._sum.quantity ?? 0) / vivos : null,
      dnpCerdaAnio: par?.indicadores.dnpPorCerdaAnio ?? null,
      paradasHoy: par?.paradas.length ?? 0,
      perdidaDiaGs: par?.perdidaDiariaHoyGs ?? 0,
      perdidaAnioGs: par ? par.anio.gastadoGs + par.anio.dejadoGs : 0,
    });
  }
  return filas.sort((a, b) => b.madres - a.madres);
}

export async function facturacionGranjas() {
  const mesHoy = mesDe(hoyUTC()), anio = Math.floor(mesHoy / 100);
  const ventas = await prisma.venta.findMany({
    where: { estado: "CONFIRMADA", fechaSalida: { gte: new Date(Date.UTC(anio - 1, mesHoy % 100, 1)) } },
    select: { organizacionId: true, fechaSalida: true, importeGs: true, cantidad: true, tipoVenta: true },
  });
  const orgIds = Array.from(new Set(ventas.map(v => v.organizacionId)));
  const orgs = await prisma.tenant.findMany({ where: { id: { in: orgIds } }, select: { id: true, farmName: true, departamento: true } });
  const meses = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(anio, (mesHoy % 100) - 12 + i, 1)); return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1; });
  const filas: { id: string; nombre: string; departamento: string; porMes: number[]; total: number; sinIva: number; lechones: number; precio: number | null; costoLechon: number | null; margen: number | null }[] = [];
  for (const o of orgs) {
    const vs = ventas.filter(v => v.organizacionId === o.id);
    const porMes = meses.map(mes => vs.filter(v => v.fechaSalida.getUTCFullYear() * 100 + v.fechaSalida.getUTCMonth() + 1 === mes).reduce((s, v) => s + Number(v.importeGs), 0));
    const lech = vs.filter(v => v.tipoVenta === "LECHONES");
    const lechones = lech.reduce((s, v) => s + v.cantidad, 0), importeLech = lech.reduce((s, v) => s + Number(v.importeGs), 0);
    // Costo y margen por lechón del año en curso, con la hoja de costos de Finanzas
    let costoLechon: number | null = null;
    try {
      const [d, san] = await Promise.all([datosAnio(o.id, anio), sanidadAnio(o.id, anio)]);
      const c = hojaCostos(d.movs, d.inversiones, d.prod, d.matricesPorMes, d.params, anio, san.usadoPorMes, mesHoy);
      // Solo los meses con ventas: los meses de armado sin lechones vendidos distorsionarían el costo por lechón
      const conVenta = d.prod.map((x, i) => (x.entregados > 0 ? i : -1)).filter(i => i >= 0);
      const ent = conVenta.reduce((s, i) => s + d.prod[i].entregados, 0);
      const costo = conVenta.reduce((s, i) => s + Number(c.conAmort[i]), 0);
      costoLechon = ent ? costo / ent : null;
    } catch { costoLechon = null; }
    const total = porMes.reduce((s, x) => s + x, 0);
    const precio = lechones ? importeLech / lechones : null;
    filas.push({ id: o.id, nombre: o.farmName, departamento: o.departamento ?? "—", porMes, total, sinIva: total / (1 + IVA_ANIMALES), lechones, precio, costoLechon, margen: precio !== null && costoLechon !== null ? precio - costoLechon : null });
  }
  filas.sort((a, b) => b.total - a.total);
  return { meses, filas, totalPorMes: meses.map((_, i) => filas.reduce((s, f) => s + f.porMes[i], 0)) };
}
