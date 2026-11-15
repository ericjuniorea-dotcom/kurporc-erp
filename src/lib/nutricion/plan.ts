// Sanidad y Nutrición · plan de alimentación: qué balanceado se come en cada módulo y cuánto, en teoría.
// kg = null → «a gusto» (sin meta; solo se registra lo real). Los nombres coinciden con las categorías de Finanzas
// para que, al cargar la compra, se sugiera el producto correcto.
import type { Prisma } from "@prisma/client";

export const MODULOS_NUTRICION = {
  GESTACION:           { etiqueta: "Gestación",                 por: "HEMBRA", animal: "hembra" },
  MATERNIDAD_HEMBRAS:  { etiqueta: "Maternidad · hembras",      por: "HEMBRA", animal: "hembra" },
  MATERNIDAD_LECHONES: { etiqueta: "Maternidad · lechones",     por: "LECHON", animal: "lechón" },
  INICIACION:          { etiqueta: "Iniciación",                por: "TOTAL",  animal: "lechón" },
  ENGORDE:             { etiqueta: "Engorde",                   por: "TOTAL",  animal: "cerdo" },
} as const;
export type ModuloNutricion = keyof typeof MODULOS_NUTRICION;
export const ORDEN_MODULOS = Object.keys(MODULOS_NUTRICION) as ModuloNutricion[];
export const esModuloNutricion = (x: unknown): x is ModuloNutricion => typeof x === "string" && x in MODULOS_NUTRICION;

/** Plan sugerido (valores del dueño, 15/11/2026). `phase` mantiene compatibilidad con historial y análisis. */
export const PLAN_SUGERIDO: { nombre: string; modulo: ModuloNutricion; kg: number | null; phase: string; orden: number }[] = [
  { nombre: "Balanceado de gestación",   modulo: "GESTACION",           kg: 2.3,  phase: "GESTATION",   orden: 1 },
  { nombre: "Balanceado de lactación",   modulo: "MATERNIDAD_HEMBRAS",  kg: 8,    phase: "LACTATION",   orden: 2 },
  { nombre: "Vilo Baby",                 modulo: "MATERNIDAD_LECHONES", kg: 0.5,  phase: "PRE_STARTER", orden: 3 },
  { nombre: "Pre-inicial 1",             modulo: "MATERNIDAD_LECHONES", kg: 0.5,  phase: "PRE_STARTER", orden: 4 },
  { nombre: "Pre-inicial 2",             modulo: "MATERNIDAD_LECHONES", kg: 0.5,  phase: "PRE_STARTER", orden: 5 },
  { nombre: "Inicial",                   modulo: "INICIACION",          kg: null, phase: "PHASE_1",     orden: 6 },
  { nombre: "Balanceado de crecimiento", modulo: "ENGORDE",             kg: null, phase: "GROWING",     orden: 7 },
  { nombre: "Balanceado de terminación", modulo: "ENGORDE",             kg: null, phase: "GROWING",     orden: 8 },
];

/**
 * Deja cargado el plan sugerido: crea los balanceados que falten en el inventario (B-xxx) y un tipo por cada uno.
 * Idempotente: lo que ya existe (mismo nombre) no se duplica. Los tipos viejos sin módulo propio quedan inactivos.
 */
export async function asegurarPlanSugerido(tx: Prisma.TransactionClient, tenantId: string): Promise<{ productos: number; tipos: number }> {
  const [productos, tipos] = await Promise.all([
    tx.productoInventario.findMany({ where: { tenantId, categoria: "BALANCEADO" }, select: { id: true, nombre: true, codigo: true, isActive: true } }),
    tx.feedType.findMany({ where: { tenantId }, select: { id: true, name: true, productoBalanceadoId: true } }),
  ]);
  let n = productos.reduce((m, p) => Math.max(m, Number(p.codigo?.split("-")[1]) || 0), 0);
  let creadosP = 0, creadosT = 0;
  for (const item of PLAN_SUGERIDO) {
    let prod = productos.find(p => p.nombre.trim().toLowerCase() === item.nombre.toLowerCase());
    if (!prod) {
      n++;
      const c = await tx.productoInventario.create({
        data: { tenantId, nombre: item.nombre, enfermedad: "", categoria: "BALANCEADO", unidadMedida: "KG", codigo: `B-${String(n).padStart(3, "0")}`, sectorDestino: "lote" },
        select: { id: true, nombre: true, codigo: true, isActive: true },
      });
      productos.push(c); prod = c; creadosP++;
    } else if (!prod.isActive) {
      await tx.productoInventario.update({ where: { id: prod.id }, data: { isActive: true } });
    }
    const tipo = tipos.find(t => t.productoBalanceadoId === prod!.id || t.name.trim().toLowerCase() === item.nombre.toLowerCase());
    const datos = {
      name: item.nombre, phase: item.phase, modulo: item.modulo, por: MODULOS_NUTRICION[item.modulo].por,
      kgPorAnimalDia: item.kg, sortOrder: item.orden, isActive: true, productoBalanceadoId: prod.id,
    };
    if (tipo) await tx.feedType.update({ where: { id: tipo.id }, data: datos });
    else { await tx.feedType.create({ data: { tenantId, ...datos } }); creadosT++; }
  }
  // Los tipos viejos («Alimento gestación», «Recría Fase 1»…) sin balanceado propio quedan inactivos
  const nombres = PLAN_SUGERIDO.map(i => i.nombre.toLowerCase());
  for (const t of tipos) if (!t.productoBalanceadoId && !nombres.includes(t.name.trim().toLowerCase())) {
    await tx.feedType.update({ where: { id: t.id }, data: { isActive: false } });
  }
  return { productos: creadosP, tipos: creadosT };
}
