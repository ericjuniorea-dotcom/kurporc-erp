// Descuento de stock común (FIFO por vencimiento, sin lotes vencidos): deja un movimiento por lote con quién lo hizo.
import "server-only";
import { Prisma, type OrigenMovimiento } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type ResultadoDescuento = { descontado: number; faltante: number; costoGs: number };

export async function descontarStock(tx: Tx, d: {
  tenantId: string; productoId: string; cantidad: number; origen: OrigenMovimiento;
  referenciaId?: string | null; usuarioId?: string | null; nota?: string | null; fecha?: Date;
}): Promise<ResultadoDescuento> {
  let restante = d.cantidad, costo = 0;
  if (!(restante > 0)) return { descontado: 0, faltante: 0, costoGs: 0 };
  const lotes = await tx.loteInventario.findMany({
    where: { tenantId: d.tenantId, vacunaId: d.productoId, cantidadActual: { gt: 0 }, fechaVencimiento: { gte: new Date() } },
    orderBy: [{ fechaVencimiento: "asc" }, { fechaIngreso: "asc" }],
    select: { id: true, cantidadActual: true, costoUnitario: true },
  });
  for (const l of lotes) {
    if (restante <= 0) break;
    const usa = Math.min(Number(l.cantidadActual), restante);
    if (usa <= 0) continue;
    await tx.loteInventario.update({ where: { id: l.id }, data: { cantidadActual: { decrement: usa } } });
    await tx.movimientoInventario.create({
      data: { tenantId: d.tenantId, productoId: d.productoId, loteId: l.id, tipo: "SALIDA", cantidad: usa, origen: d.origen,
        referenciaId: d.referenciaId ?? null, usuarioId: d.usuarioId ?? null, nota: d.nota ?? null, ...(d.fecha ? { fecha: d.fecha } : {}) },
    });
    costo += usa * Number(l.costoUnitario ?? 0);
    restante -= usa;
  }
  return { descontado: d.cantidad - restante, faltante: Math.max(0, restante), costoGs: Math.round(costo) };
}
