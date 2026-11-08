// Datos de un lote de engorde para indicadores, costo y margen (Fase 9). Solo servidor.
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC } from "@/lib/finanzas/calculos";
import { datosAnio, sanidadAnio } from "@/lib/finanzas/anio";
import { hojaCostos } from "@/lib/finanzas/hojas";
import { costoLote, indicadoresLote, ingresoIntegracion, diasHastaObjetivo, type DatosLote } from "./indicadores";

const DIETAS_ENGORDE = ["CRECIMIENTO", "TERMINACION"];

/** Precio del kilo de balanceado de engorde: de las compras (crecimiento/terminación) o, si no hay, el promedio de todas las dietas. */
async function precioKgEngorde(org: string): Promise<number | null> {
  const compras = await prisma.movimiento.findMany({
    where: { organizacionId: org, estado: { not: "ANULADO" }, tipo: "GASTO", cantidad: { gt: 0 }, categoria: { grupoCosto: "ALIMENTACION" } },
    select: { montoGs: true, cantidad: true, categoria: { select: { dieta: true } } },
  });
  const de = (f: (c: (typeof compras)[number]) => boolean) => {
    const x = compras.filter(f);
    const kg = x.reduce((s, c) => s + Number(c.cantidad), 0);
    return kg > 0 ? x.reduce((s, c) => s + Number(c.montoGs), 0) / kg : null;
  };
  return de(c => DIETAS_ENGORDE.includes(c.categoria.dieta ?? "")) ?? de(() => true);
}

export async function analizarLote(org: string, id: string) {
  const lote = await prisma.growingBatch.findFirst({
    where: { id, tenantId: org },
    include: {
      deaths: true, otherExits: true, sales: true, weightRecords: { orderBy: { recordDate: "asc" } },
      feedRecords: { select: { quantityKg: true } },
      outgoingTransfers: true, incomingTransfers: true,
      withdrawalPeriods: { include: { medicine: { select: { name: true } } }, orderBy: { startDate: "desc" } },
    },
  });
  if (!lote) return null;
  const [params, ventas, curva, contrapartes] = await Promise.all([
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.venta.findMany({ where: { organizacionId: org, loteEngordeId: id, estado: "CONFIRMADA" } }),
    lote.curvaId ? prisma.curvaEngorde.findFirst({ where: { id: lote.curvaId, organizacionId: org } }) : prisma.curvaEngorde.findFirst({ where: { organizacionId: org, predeterminada: true } }),
    prisma.contraparte.findMany({ where: { organizacionId: org, tipo: { in: ["PROVEEDOR", "AMBOS", "CLIENTE"] } }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  const hoy = hoyUTC();
  const fin = lote.status === "CLOSED" && lote.closedAt ? lote.closedAt : hoy;
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  // Ingresados: lo que hay hoy + todo lo que salió − lo que entró por traslado
  const salidas = lote.deaths.reduce((s, x) => s + x.count, 0) + lote.otherExits.reduce((s, x) => s + x.count, 0)
    + lote.sales.reduce((s, x) => s + x.animalCount, 0) + lote.outgoingTransfers.reduce((s, x) => s + x.count, 0);
  const entraron = lote.incomingTransfers.reduce((s, x) => s + x.count, 0);
  const ingresoInicial = lote.currentCount + salidas - entraron;
  const datos: DatosLote = {
    ingreso: { fecha: lote.entryDate, cantidad: ingresoInicial, kg: Number(lote.entryWeightKg) },
    entradas: lote.incomingTransfers.map(t => ({ fecha: t.transferDate, cantidad: t.count, kg: n(t.totalWeightKg) })),
    pesajes: lote.weightRecords.map(w => ({ fecha: w.recordDate, animales: w.animalCount, kgTotales: Number(w.totalWeightKg) })),
    muertes: lote.deaths.map(m => ({ fecha: m.deathDate, cantidad: m.count, kg: m.estimatedWeightKg === null ? null : Number(m.estimatedWeightKg) * m.count })),
    ventas: lote.sales.map(v => ({ fecha: v.saleDate, cantidad: v.animalCount, kg: Number(v.totalWeightKg) })),
    otrasSalidas: [
      ...lote.otherExits.map(o => ({ fecha: o.exitDate, cantidad: o.count, kg: o.estimatedWeightKg === null ? null : Number(o.estimatedWeightKg) * o.count })),
      ...lote.outgoingTransfers.map(t => ({ fecha: t.transferDate, cantidad: t.count, kg: n(t.totalWeightKg) })),
    ],
    alimentoKg: lote.feedRecords.reduce((s, f) => s + Number(f.quantityKg), 0),
    fin,
  };
  const ind = indicadoresLote(datos);
  const puntos = (curva?.puntos as { dia: number; pesoKg: number }[] | undefined) ?? null;
  const objetivo = Number(lote.targetWeightKg ?? 110);
  const diasFaltan = lote.status === "CLOSED" ? null : diasHastaObjetivo(ind.pesoActual, objetivo, puntos, ind.gdpKg);

  // ── Costo y margen (9.4) ──
  const integrado = lote.modalidad === "INTEGRADO";
  const precioRef = Number(params?.precioReferenciaLechonGs ?? 435000n);
  // Lechón de recría propia: a precio de referencia (MERCADO) o a su costo de producción del mes de ingreso (COSTO)
  let precioLechon = precioRef;
  let usaCosto = false;
  if (params?.precioTransferenciaLechon === "COSTO" && lote.costoIngresoGs === null && !integrado) {
    const anioIng = lote.entryDate.getUTCFullYear(), i = lote.entryDate.getUTCMonth();
    const [d, san] = await Promise.all([datosAnio(org, anioIng), sanidadAnio(org, anioIng)]);
    const c = hojaCostos(d.movs, d.inversiones, d.prod, d.matricesPorMes, d.params, anioIng, san.usadoPorMes);
    const costo = c.unit.costoPorEntregado[i] ?? c.unit.costoPorDestetado[i];
    if (costo !== null && costo > 0) { precioLechon = costo; usaCosto = true; }
  }
  const costoAnimales = lote.costoIngresoGs ?? (integrado ? 0n : BigInt(Math.round(precioLechon * ingresoInicial)));
  const origenCostoAnimales = lote.costoIngresoGs !== null ? "lo pagado" : integrado ? "los pone el integrador" : usaCosto ? "costo propio del lechón del mes de ingreso" : `precio de referencia del lechón${params?.precioTransferenciaLechon === "COSTO" ? " (no hay costo propio de ese mes)" : ""}`;
  const precioKg = lote.alimentoLoProvee === "INTEGRADOR" ? 0 : await precioKgEngorde(org);
  const costoAlimento = BigInt(Math.round(datos.alimentoKg * (precioKg ?? 0)));
  const costoSanidad = lote.withdrawalPeriods.reduce((s, w) => s + (w.costoGs ?? 0n), 0n);
  const pct = Number(params?.porcentajeEstructuraEngorde ?? 0);
  let estructura = 0n;
  if (pct > 0) {
    const fijos = await prisma.movimiento.aggregate({ where: { organizacionId: org, estado: { not: "ANULADO" }, tipo: "GASTO", naturaleza: "FIJO", fecha: { gte: lote.entryDate, lte: fin } }, _sum: { montoGs: true } });
    estructura = BigInt(Math.round(Number(fijos._sum.montoGs ?? 0n) * pct));
  }
  const ventaGastos = ventas.reduce((s, v) => s + v.fleteGs, 0n);
  const ingresos = integrado
    ? ingresoIntegracion(lote.pagoIntegracion, lote.tarifaIntegracionGs, { kgProducidos: ind.kgProducidos, animalesDia: ind.animalesDia, vendidos: ind.vendidos })
    : ventas.reduce((s, v) => s + v.importeGs, 0n) || lote.sales.reduce((s, v) => s + BigInt(Math.round(Number(v.totalAmount))), 0n);
  const resultado = costoLote({ animales: costoAnimales, alimento: costoAlimento, sanidad: costoSanidad, estructura, ventaGastos, ingresos, kgProducidos: ind.kgProducidos, kgVendidos: ind.kgVendidos, vendidos: ind.vendidos });
  const carencias = lote.withdrawalPeriods.filter(w => w.isActive && w.endDate.getTime() > hoy.getTime());

  return {
    lote, ind, objetivo, diasFaltan, curva: curva ? { id: curva.id, nombre: curva.nombre, puntos } : null, contrapartes,
    costos: { animales: costoAnimales, origenCostoAnimales, alimento: costoAlimento, alimentoKg: datos.alimentoKg, precioKg, sanidad: costoSanidad, estructura, pctEstructura: pct, ventaGastos, ingresos, ...resultado },
    carencias, tratamientos: lote.withdrawalPeriods,
  };
}
