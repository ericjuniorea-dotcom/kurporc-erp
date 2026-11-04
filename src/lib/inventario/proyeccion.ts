import { prisma } from "@/lib/db/prisma";
import { cached } from "@/lib/cache";

export type CategoriaInventario = "VACUNA" | "SUPLEMENTO" | "MEDICAMENTO" | "MATERIA_PRIMA" | "BALANCEADO" | "EQUIPAMIENTO";

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
 * Proyección de faltantes compartida entre Sanidad, Balanceado y Logística.
 *
 * - VACUNA/SUPLEMENTO/MEDICAMENTO: demanda = EventoVacunacion pendiente/retrasado
 *   dentro de la ventana (mismo criterio que src/lib/sanidad/vision-general.ts).
 * - MATERIA_PRIMA: demanda = consumo diario real de balanceado (promedio de los
 *   últimos 7 días de FeedRecord por etapa) × % de inclusión de ese ingrediente
 *   en la fórmula ACTIVA de cada etapa que lo usa. Se prefiere el consumo real
 *   por sobre un modelo teórico de población×ración fija — ya existe y es más
 *   preciso que estimarlo de nuevo.
 * - BALANCEADO/EQUIPAMIENTO: sin fuente de demanda programada hoy → el único
 *   criterio de alerta es el stockMinimo configurado manualmente.
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
  const idsMateriaPrima = productos.filter(p => p.categoria === "MATERIA_PRIMA").map(p => p.id);
  const hace7 = new Date(today); hace7.setDate(hace7.getDate() - 7);

  // Las 4 consultas de acá abajo dependen solo de `productos` (ya resuelto),
  // no entre sí — se disparan todas juntas en vez de una tras otra para pagar
  // una sola vez la latencia de red en vez de 4 veces.
  const [lotes, eventosPendientes, consumoReciente, formulasActivas] = await Promise.all([
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
    idsMateriaPrima.length > 0
      ? prisma.feedRecord.groupBy({
          by: ["feedTypeId"],
          where: { tenantId, recordDate: { gte: hace7 } },
          _sum: { quantityKg: true },
        })
      : Promise.resolve([]),
    idsMateriaPrima.length > 0
      ? prisma.formula.findMany({
          where:   { tenantId, isActive: true },
          include: {
            feedType: { select: { id: true } },
            versions: { where: { status: "ACTIVE" }, take: 1, include: { ingredients: true } },
          },
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

  // Demanda: materia prima → consumo real de balanceado × composición de la fórmula activa
  const demandaMateriaPrima = new Map<string, number>();
  const consumoDiarioPorFeedType = new Map(
    consumoReciente.map(c => [c.feedTypeId, Number(c._sum.quantityKg ?? 0) / 7]),
  );
  for (const formula of formulasActivas) {
    const version = formula.versions[0];
    if (!version) continue;
    const consumoDiarioEtapa = consumoDiarioPorFeedType.get(formula.feedType.id) ?? 0;
    if (consumoDiarioEtapa <= 0) continue;
    for (const ing of version.ingredients) {
      if (!idsMateriaPrima.includes(ing.rawMaterialId)) continue;
      const consumoDiarioIngrediente = consumoDiarioEtapa * (Number(ing.inclusionPct) / 100);
      demandaMateriaPrima.set(
        ing.rawMaterialId,
        (demandaMateriaPrima.get(ing.rawMaterialId) ?? 0) + consumoDiarioIngrediente * ventanaDias,
      );
    }
  }

  return productos.map(p => {
    const stockNoVencido = stockPorProducto.get(p.id) ?? 0;

    let demandaProyectada: number | null = null;
    if (CATEGORIAS_CON_PROTOCOLO.includes(p.categoria)) demandaProyectada = demandaProtocolo.get(p.id) ?? 0;
    else if (p.categoria === "MATERIA_PRIMA") demandaProyectada = demandaMateriaPrima.get(p.id) ?? 0;

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
