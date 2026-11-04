import { prisma } from "@/lib/db/prisma";
import { cached } from "@/lib/cache";

// Orden fijo de módulos de producción para el acordeón de Visión general.
// "plantel" no tiene todavía ningún flujo que genere EventoVacunacion con ese
// sector — el módulo va a aparecer vacío/al día hasta que exista esa fuente,
// tal como pide el spec para módulos sin pendientes (no se oculta).
export const MODULOS_FIJOS = [
  { key: "plantel",    label: "Plantel Reproductivo" },
  { key: "gestacion",  label: "Gestación" },
  { key: "maternidad", label: "Maternidad" },
  { key: "iniciacion", label: "Iniciación" },
  { key: "engorde",    label: "Engorde" },
] as const;

export type ModuloKey = (typeof MODULOS_FIJOS)[number]["key"];

/**
 * Alerta de stock por vacuna: demanda proyectada a 7 días vs. stock no
 * vencido disponible. Misma lógica que ya usaba /api/sanidad/stock —
 * extraída acá para no duplicarla entre esa ruta y /api/sanidad/vision-general.
 */
export async function computeStockAlertas(tenantId: string, categoria?: "VACUNA" | "SUPLEMENTO" | "MEDICAMENTO") {
  return cached(`stockAlertas:${tenantId}:${categoria ?? "all"}`, 8_000, () => computeStockAlertasUncached(tenantId, categoria));
}

async function computeStockAlertasUncached(tenantId: string, categoria?: "VACUNA" | "SUPLEMENTO" | "MEDICAMENTO") {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

  const [vacunas, lotes, eventosPendientes] = await Promise.all([
    prisma.productoInventario.findMany({
      where:  { tenantId, isActive: true, ...(categoria ? { categoria } : {}) },
      select: { id: true, nombre: true, criticidad: true, categoria: true, codigo: true, stockMinimo: true },
    }),
    prisma.loteInventario.findMany({ where: { tenantId } }),
    prisma.eventoVacunacion.findMany({
      where:  { tenantId, estado: { in: ["pendiente", "retrasado"] }, fecha: { lte: in7 } },
      select: { vacunaId: true, dosisNecesarias: true },
    }),
  ]);

  return vacunas.map(v => {
    const vLotes = lotes.filter(l => l.vacunaId === v.id);
    const stockNoVencido = vLotes
      .filter(l => l.fechaVencimiento >= today)
      .reduce((s, l) => s + Number(l.cantidadActual), 0);
    const dosisNecesariasProx7d = eventosPendientes
      .filter(e => e.vacunaId === v.id)
      .reduce((s, e) => s + e.dosisNecesarias, 0);
    const diasDeStock = dosisNecesariasProx7d > 0
      ? Math.round((stockNoVencido / dosisNecesariasProx7d) * 7)
      : null;
    const alertaStockMinimo = v.stockMinimo != null && stockNoVencido < v.stockMinimo;

    return {
      vacunaId:    v.id,
      nombre:      v.nombre,
      codigo:      v.codigo,
      categoria:   v.categoria,
      criticidad:  v.criticidad,
      stockNoVencido,
      dosisNecesariasProx7d,
      diasDeStock,
      alertaStockMinimo,
      alertaStock: (dosisNecesariasProx7d > 0 && stockNoVencido < dosisNecesariasProx7d) || alertaStockMinimo,
    };
  });
}
