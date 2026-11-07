import { prisma } from "@/lib/db/prisma";
import { cached } from "@/lib/cache";

export type CategoriaInventario = "VACUNA" | "SUPLEMENTO" | "MEDICAMENTO" | "BALANCEADO" | "EQUIPAMIENTO";

export interface StockYFaltante {
  productoId:            string;
  nombre:                string;
  enfermedad:            string;
  codigo:                string | null;
  categoria:             string;
  unidadMedida:          string;
  criticidad:            string;
  stockMinimo:           number | null;
  stockNoVencido:        number;
  demandaProyectada:     number | null; // null = sin fuente de demanda programada para esta categoría
  ventanaDias:           number;
  diasHastaAgotamiento:  number | null; // null si no hay demanda (nunca se muestra una división por cero)
  faltante:              number; // max(0, demanda - stock) — "cuánto hace falta" para no quebrar stock
  costoUnitarioPromedio: number | null; // promedio ponderado del costo de los lotes con stock (₲ por unidad)
  valorInvertido:        number; // stockNoVencido × costoUnitarioPromedio
  alertaDemanda:         boolean;
  alertaStockMinimo:     boolean;
  alertaStock:           boolean;
}

const CATEGORIAS_CON_PROTOCOLO = ["VACUNA", "SUPLEMENTO", "MEDICAMENTO"];

/**
 * Proyección de faltantes compartida entre Sanidad, Alimentación y Logística.
 *
 * - VACUNA/SUPLEMENTO/MEDICAMENTO: demanda = EventoVacunacion pendiente/retrasado
 *   dentro de la ventana (mismo criterio que src/lib/sanidad/vision-general.ts).
 * - BALANCEADO (se compra hecho): demanda = consumo diario real de los últimos
 *   7 días (FeedRecord) de cada etapa cuyo FeedType apunta a ese producto.
 * - EQUIPAMIENTO: sin fuente de demanda programada → el único criterio de
 *   alerta es el stockMinimo configurado manualmente.
 */
export async function computeStockYFaltantes(
  tenantId: string,
  categoria?: CategoriaInventario,
  ventanaDias = 7,
): Promise<StockYFaltante[]> {
  const cacheKey = `stock:${tenantId}:${categoria ?? "all"}:${ventanaDias}`;
  return cached(cacheKey, 8_000, () => computeStockYFaltantesUncached(tenantId, categoria, ventanaDias));
}

async function computeStockYFaltantesUncached(
  tenantId: string,
  categoria: CategoriaInventario | undefined,
  ventanaDias: number,
): Promise<StockYFaltante[]> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const inN = new Date(today); inN.setDate(inN.getDate() + ventanaDias);

  const productos = await prisma.productoInventario.findMany({
    where:  { tenantId, isActive: true, ...(categoria ? { categoria } : {}) },
    select: { id: true, nombre: true, enfermedad: true, codigo: true, categoria: true, unidadMedida: true, criticidad: true, stockMinimo: true },
  });
  if (productos.length === 0) return [];

  const productoIds = productos.map(p => p.id);
  const idsConProtocolo = productos.filter(p => CATEGORIAS_CON_PROTOCOLO.includes(p.categoria)).map(p => p.id);
  const idsBalanceado = productos.filter(p => p.categoria === "BALANCEADO").map(p => p.id);
  const hace7 = new Date(today); hace7.setDate(hace7.getDate() - 7);

  // Las consultas de acá abajo dependen solo de `productos` (ya resuelto),
  // no entre sí — se disparan todas juntas para pagar una sola vez la latencia.
  const [lotes, eventosPendientes, consumoReciente, etapasConProducto] = await Promise.all([
    prisma.loteInventario.findMany({
      where:  { tenantId, vacunaId: { in: productoIds } },
      select: { vacunaId: true, cantidadActual: true, fechaVencimiento: true, costoUnitario: true },
    }),
    idsConProtocolo.length > 0
      ? prisma.eventoVacunacion.findMany({
          where:  { tenantId, vacunaId: { in: idsConProtocolo }, estado: { in: ["pendiente", "retrasado"] }, fecha: { lte: inN } },
          select: { vacunaId: true, dosisNecesarias: true },
        })
      : Promise.resolve([]),
    idsBalanceado.length > 0
      ? prisma.feedRecord.groupBy({
          by: ["feedTypeId"],
          where: { tenantId, recordDate: { gte: hace7 } },
          _sum: { quantityKg: true },
        })
      : Promise.resolve([]),
    idsBalanceado.length > 0
      ? prisma.feedType.findMany({
          where:  { tenantId, productoBalanceadoId: { in: idsBalanceado } },
          select: { id: true, productoBalanceadoId: true },
        })
      : Promise.resolve([]),
  ]);

  const stockPorProducto = new Map<string, number>();
  const valorPorProducto = new Map<string, number>(); // Σ cantidad × costoUnitario (para promedio ponderado)
  const cantidadConCostoPorProducto = new Map<string, number>();
  for (const l of lotes) {
    if (l.fechaVencimiento < today) continue;
    const cantidad = Number(l.cantidadActual);
    stockPorProducto.set(l.vacunaId, (stockPorProducto.get(l.vacunaId) ?? 0) + cantidad);
    if (l.costoUnitario != null) {
      valorPorProducto.set(l.vacunaId, (valorPorProducto.get(l.vacunaId) ?? 0) + cantidad * Number(l.costoUnitario));
      cantidadConCostoPorProducto.set(l.vacunaId, (cantidadConCostoPorProducto.get(l.vacunaId) ?? 0) + cantidad);
    }
  }

  // Demanda: vacunas/suplementos/medicamentos → calendario de vacunación
  const demandaProtocolo = new Map<string, number>();
  for (const e of eventosPendientes) {
    demandaProtocolo.set(e.vacunaId, (demandaProtocolo.get(e.vacunaId) ?? 0) + e.dosisNecesarias);
  }

  // Demanda: balanceado comprado → consumo real de los últimos 7 días de cada etapa vinculada al producto
  const consumoDiarioPorFeedType = new Map(
    consumoReciente.map(c => [c.feedTypeId, Number(c._sum.quantityKg ?? 0) / 7]),
  );
  const demandaBalanceado = new Map<string, number>();
  for (const etapa of etapasConProducto) {
    if (!etapa.productoBalanceadoId) continue;
    const consumoDiario = consumoDiarioPorFeedType.get(etapa.id) ?? 0;
    if (consumoDiario <= 0) continue;
    demandaBalanceado.set(
      etapa.productoBalanceadoId,
      (demandaBalanceado.get(etapa.productoBalanceadoId) ?? 0) + consumoDiario * ventanaDias,
    );
  }

  return productos.map(p => {
    const stockNoVencido = stockPorProducto.get(p.id) ?? 0;

    let demandaProyectada: number | null = null;
    if (CATEGORIAS_CON_PROTOCOLO.includes(p.categoria)) demandaProyectada = demandaProtocolo.get(p.id) ?? 0;
    else if (p.categoria === "BALANCEADO") demandaProyectada = demandaBalanceado.get(p.id) ?? 0;

    const alertaDemanda = demandaProyectada != null && demandaProyectada > 0 && stockNoVencido < demandaProyectada;
    const alertaStockMinimo = p.stockMinimo != null && stockNoVencido < p.stockMinimo;
    const diasHastaAgotamiento = demandaProyectada != null && demandaProyectada > 0
      ? Math.round((stockNoVencido / demandaProyectada) * ventanaDias)
      : null;
    const faltante = Math.max(
      0,
      (demandaProyectada ?? 0) - stockNoVencido,
      p.stockMinimo != null ? p.stockMinimo - stockNoVencido : 0,
    );
    const cantidadConCosto = cantidadConCostoPorProducto.get(p.id) ?? 0;
    const costoUnitarioPromedio = cantidadConCosto > 0 ? (valorPorProducto.get(p.id) ?? 0) / cantidadConCosto : null;
    const valorInvertido = costoUnitarioPromedio != null ? stockNoVencido * costoUnitarioPromedio : 0;

    return {
      productoId: p.id, nombre: p.nombre, enfermedad: p.enfermedad, codigo: p.codigo, categoria: p.categoria,
      unidadMedida: p.unidadMedida, criticidad: p.criticidad, stockMinimo: p.stockMinimo,
      stockNoVencido, demandaProyectada, ventanaDias, diasHastaAgotamiento, faltante,
      costoUnitarioPromedio, valorInvertido,
      alertaDemanda, alertaStockMinimo,
      alertaStock: alertaDemanda || alertaStockMinimo,
    };
  });
}
