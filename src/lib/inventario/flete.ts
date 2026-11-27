// Flete de una compra (LOG-02, regla R4): se suma al costo del ítem que llegó al inventario.
//  · Recepción pendiente → sube su costo por unidad (al aceptarla, el lote entra con el flete incluido).
//  · Recepción aceptada con stock en ese lote → sube el costo de lo que queda (la base recalcula el promedio).
//  · Ya se consumió todo → no hay stock que lo absorba: el flete va directo a la etapa que consume el ítem.
import "server-only";
import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export async function aplicarFlete(tx: Tx, org: string, recepcionId: string, montoGs: bigint): Promise<{ etapaDirecta: string | null }> {
  const r = await tx.recepcionInventario.findFirst({ where: { id: recepcionId, tenantId: org },
    select: { id: true, estado: true, cantidad: true, costoUnitario: true, loteId: true, producto: { select: { etapaConsumoCodigo: true } } } });
  if (!r || r.estado === "RECHAZADA" || r.estado === "ANULADA") throw new Error("•Esa compra no está en el inventario (rechazada o anulada).");
  const flete = Number(montoGs);
  await tx.recepcionInventario.update({ where: { id: r.id }, data: { fleteGs: { increment: montoGs } } });
  if (r.estado === "PENDIENTE") {
    const cant = Number(r.cantidad);
    if (cant > 0) await tx.recepcionInventario.update({ where: { id: r.id }, data: { costoUnitario: Number(r.costoUnitario ?? 0) + flete / cant } });
    return { etapaDirecta: null };
  }
  const lote = r.loteId ? await tx.loteInventario.findUnique({ where: { id: r.loteId }, select: { id: true, cantidadActual: true, costoUnitario: true } }) : null;
  const queda = lote ? Number(lote.cantidadActual) : 0;
  if (lote && queda > 0) {
    await tx.loteInventario.update({ where: { id: lote.id }, data: { costoUnitario: Number(lote.costoUnitario ?? 0) + flete / queda } });
    return { etapaDirecta: null };
  }
  return { etapaDirecta: r.producto.etapaConsumoCodigo ?? "CMP" };
}
