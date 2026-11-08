// Carga los datos de un año para las hojas de Finanzas (Fase 8, parte 2). Una sola pasada por la base.
import "server-only";
import { cache } from "react";
import prisma from "@/lib/db/prisma";
import { filaSanidad, meses12, type MovHoja, type ParamsHojas, type ProdMes, type ProductoSanidad } from "./hojas";

const idx = (d: Date) => d.getUTCMonth();
const rango = (anio: number) => ({ gte: new Date(Date.UTC(anio, 0, 1)), lt: new Date(Date.UTC(anio + 1, 0, 1)) });

function aMov(m: { mes: number; tipo: string; montoGs: bigint; cantidad: unknown; fecha: Date; esInterno: boolean; categoria: MovHoja["categoria"] }): MovHoja {
  return { ...m, tipo: m.tipo as MovHoja["tipo"], cantidad: m.cantidad === null ? null : Number(m.cantidad) };
}
const SELECT_MOV = {
  mes: true, tipo: true, montoGs: true, cantidad: true, fecha: true, esInterno: true,
  categoria: { select: { id: true, nombre: true, naturaleza: true, area: true, grupoCosto: true, dieta: true, vidaUtil: true } },
} as const;

export const datosAnio = cache(async (org: string, anio: number) => {
  const [movs, inversiones, params, servicios, partos, destetes, muertes, ventas, matricesHoy] = await Promise.all([
    prisma.movimiento.findMany({ where: { organizacionId: org, estado: { not: "ANULADO" }, mes: { gte: anio * 100 + 1, lte: anio * 100 + 12 } }, select: SELECT_MOV }),
    prisma.movimiento.findMany({ where: { organizacionId: org, estado: { not: "ANULADO" }, tipo: "INVERSION", mes: { lte: anio * 100 + 12 } }, select: SELECT_MOV }),
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.serviceEvent.findMany({ where: { tenantId: org, serviceDate: rango(anio) }, select: { serviceDate: true } }),
    prisma.farrowingEvent.findMany({ where: { tenantId: org, startDatetime: rango(anio) }, select: { startDatetime: true, totalBorn: true, bornAlive: true, bornDead: true } }),
    prisma.weaningEvent.findMany({ where: { tenantId: org, weaningDate: rango(anio) }, select: { weaningDate: true, pigletsWeaned: true } }),
    prisma.pigletDeath.findMany({ where: { tenantId: org, deathDatetime: rango(anio) }, select: { deathDatetime: true, quantity: true } }),
    prisma.venta.findMany({ where: { organizacionId: org, estado: "CONFIRMADA", tipoVenta: "LECHONES", fechaSalida: rango(anio) }, select: { fechaSalida: true, cantidad: true, kgTotales: true, importeGs: true } }),
    prisma.sow.count({ where: { tenantId: org, isActive: true } }),
  ]);
  const importada = await prisma.produccionMensualImportada.findMany({ where: { organizacionId: org, mes: { gte: anio * 100 + 1, lte: anio * 100 + 12 } } });

  const prod: ProdMes[] = meses12(anio).map(() => ({ servicios: 0, partos: 0, nacidosTotales: 0, nacidosVivos: 0, muertosAlNacer: 0, destetados: 0, muertosLactancia: 0, entregados: 0, kgEntregados: 0, ingresosLechonesGs: 0n }));
  for (const s of servicios) prod[idx(s.serviceDate)].servicios++;
  for (const p of partos) { const x = prod[idx(p.startDatetime)]; x.partos++; x.nacidosTotales += p.totalBorn; x.nacidosVivos += p.bornAlive; x.muertosAlNacer += p.bornDead; }
  for (const w of destetes) prod[idx(w.weaningDate)].destetados += w.pigletsWeaned;
  for (const d of muertes) prod[idx(d.deathDatetime)].muertosLactancia += d.quantity;
  for (const v of ventas) { const x = prod[idx(v.fechaSalida)]; x.entregados += v.cantidad; x.kgEntregados += Number(v.kgTotales); x.ingresosLechonesGs += v.importeGs; }
  // Historia previa al ERP (hoja PRODUCCIÓN de la planilla): solo en meses sin registros de los módulos
  for (const p of importada) {
    const x = prod[(p.mes % 100) - 1];
    if (x.servicios || x.partos || x.destetados || x.muertosLactancia) continue;
    Object.assign(x, { servicios: p.servicios, partos: p.partos, nacidosTotales: p.nacidosTotales, nacidosVivos: p.nacidosVivos, muertosAlNacer: p.muertosAlNacer, destetados: p.destetados, muertosLactancia: p.muertosLactancia });
  }

  // Matrices activas: el número cargado en Parámetros o, si no, las activas de Plantel hoy
  const matrices = params?.matricesActivasManual ?? matricesHoy;
  const p: ParamsHojas = {
    vidaObraAnios: params?.vidaObraAnios ?? 20, vidaEquiposAnios: params?.vidaEquiposAnios ?? 10,
    modoAmortizacion: (params?.modoAmortizacion as ParamsHojas["modoAmortizacion"]) ?? "POR_ACTIVO",
    amortizarMatrices: params?.amortizarMatrices ?? false, vidaMatrizMeses: params?.vidaMatrizMeses ?? 36,
    valorDescarteMatrizGs: params?.valorDescarteMatrizGs ?? 2_000_000n,
    imputacionSanidad: (params?.imputacionSanidad as ParamsHojas["imputacionSanidad"]) ?? "USO",
  };
  return {
    movs: movs.map(aMov), inversiones: inversiones.map(aMov), prod, params: p,
    matricesPorMes: meses12(anio).map(() => matrices), matricesManual: params?.matricesActivasManual ?? null, matricesHoy,
  };
});

/** Sanidad valorizada del año: por producto y lo usado por mes (en Gs, al precio por ml del año). */
export const sanidadAnio = cache(async (org: string, anio: number) => {
  const [productos, compras, usos, lotes] = await Promise.all([
    prisma.productoInventario.findMany({ where: { tenantId: org, categoria: { in: ["VACUNA", "MEDICAMENTO"] } }, select: { id: true, nombre: true, categoria: true, unidadMedida: true, dosisMl: true } }),
    prisma.movimiento.findMany({
      where: { organizacionId: org, estado: { not: "ANULADO" }, productoSanitarioId: { not: null }, mes: { gte: anio * 100 + 1, lte: anio * 100 + 12 } },
      select: { productoSanitarioId: true, cantidad: true, mlComprados: true, montoGs: true, mes: true },
    }),
    prisma.movimientoInventario.findMany({ where: { tenantId: org, tipo: "SALIDA", fecha: rango(anio) }, select: { productoId: true, cantidad: true, fecha: true } }),
    prisma.loteInventario.findMany({ where: { tenantId: org }, select: { vacunaId: true, cantidadActual: true, costoUnitario: true } }),
  ]);
  const filas = productos.map(pr => {
    const c = compras.filter(m => m.productoSanitarioId === pr.id);
    const l = lotes.filter(x => x.vacunaId === pr.id);
    const dosisMl = Number(pr.dosisMl);
    // Precio de lista: costo unitario promedio de los lotes, llevado a ml
    const conCosto = l.filter(x => x.costoUnitario !== null);
    const costoUnit = conCosto.length ? conCosto.reduce((s, x) => s + Number(x.costoUnitario), 0) / conCosto.length : null;
    const ps: ProductoSanidad = {
      id: pr.id, nombre: pr.nombre, tipo: pr.categoria, unidadMedida: pr.unidadMedida, dosisMl,
      compradoUnidades: c.reduce((s, m) => s + Number(m.cantidad ?? 0), 0),
      compradoMl: c.reduce((s, m) => s + Number(m.mlComprados ?? 0), 0),
      compradoGs: c.reduce((s, m) => s + m.montoGs, 0n),
      precioListaPorMl: costoUnit === null ? null : pr.unidadMedida === "DOSIS" ? costoUnit / (dosisMl || 1) : costoUnit,
      usadoCantidad: usos.filter(u => u.productoId === pr.id).reduce((s, u) => s + Number(u.cantidad), 0),
      stockCantidad: l.reduce((s, x) => s + Number(x.cantidadActual), 0),
      conteoCantidad: null,
    };
    return filaSanidad(ps);
  }).filter(f => f.compradoGs > 0n || f.usadoMl > 0 || f.stockMl > 0);

  // Costo de lo usado por mes (para imputar la sanidad por uso)
  const precio = new Map(filas.map(f => [f.id, f.precioMl]));
  const dosis = new Map(productos.map(p => [p.id, { u: p.unidadMedida, ml: Number(p.dosisMl) }]));
  const usadoPorMes = Array.from({ length: 12 }, () => 0n);
  for (const u of usos) {
    const pr = precio.get(u.productoId);
    const d = dosis.get(u.productoId);
    if (!pr || !d) continue;
    const ml = d.u === "DOSIS" ? Number(u.cantidad) * d.ml : Number(u.cantidad);
    usadoPorMes[idx(u.fecha)] += BigInt(Math.round(ml * pr));
  }
  const comprasPorMes = Array.from({ length: 12 }, () => 0n);
  for (const m of compras) comprasPorMes[(m.mes % 100) - 1] += m.montoGs;
  return { filas, usadoPorMes, comprasPorMes };
});
