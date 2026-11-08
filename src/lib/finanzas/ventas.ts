// Ventas (8.5). Una venta genera, en la misma transacción: la venta, su ingreso en el libro
// (origen VENTA, cobrado o por cobrar) y la baja de los animales del lote. La usan Finanzas y Engorde.
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const TIPOS_VENTA = {
  LECHONES: { label: "Lechones", categoria: "Venta de lechones" },
  MATRIZ_DESCARTE: { label: "Matriz de descarte", categoria: "Venta de madres" },
  REPRODUCTOR: { label: "Reproductor", categoria: "Venta de reproductores" },
  DOSIS_SEMINALES: { label: "Dosis seminales", categoria: "Venta de reproductores" },
  CERDO_TERMINADO: { label: "Cerdos terminados", categoria: "Venta de cerdos terminados" },
  OTRO: { label: "Otro", categoria: "Otros ingresos" },
} as const;
export type TipoVenta = keyof typeof TIPOS_VENTA;
export const DESTINOS = { ENGORDE: "Engorde", CONSUMO: "Consumo", CARNEADO: "Carneado", REPRODUCCION: "Reproducción", FRIGORIFICO: "Frigorífico" } as const;

export type DatosVenta = {
  organizacionId: string; creadoPor: string; unidadId?: string | null;
  fechaSalida: Date; tipoVenta: TipoVenta; cantidad: number; kgTotales: number;
  modoPrecio: "POR_KG" | "POR_CABEZA"; precioGs: bigint;
  destino: keyof typeof DESTINOS; cliente: string;
  loteDesteteId?: string | null; loteEngordeId?: string | null;
  recibePor?: string | null; remitoFactura?: string | null; guiaTraslado?: string | null;
  fechaVencimientoCobro?: Date | null;
  cobro?: { fecha: Date; cuentaFondosId: string | null; medioPago: string | null } | null;
  /** Engorde ya registró su BatchSale y descontó el lote: no repetir la baja. */
  bajaYaHecha?: boolean;
};

export class ErrorVenta extends Error {}

export async function registrarVenta(tx: Tx, d: DatosVenta) {
  if (d.cantidad <= 0) throw new ErrorVenta("La cantidad tiene que ser mayor a cero.");
  if (d.kgTotales <= 0) throw new ErrorVenta("Cargá los kg de la balanza.");
  if (d.precioGs <= 0n) throw new ErrorVenta("Cargá el precio.");
  const importe = d.modoPrecio === "POR_KG" ? BigInt(Math.round(d.kgTotales * Number(d.precioGs))) : d.precioGs * BigInt(d.cantidad);

  const nombreCat = TIPOS_VENTA[d.tipoVenta].categoria;
  const categoria = await tx.categoriaFinanciera.findFirst({ where: { nombre: nombreCat, organizacionId: null } });
  if (!categoria) throw new ErrorVenta(`Falta la categoría «${nombreCat}».`);

  // Unidad: la indicada, la del lote o la primera granja
  let unidadId = d.unidadId ?? null;
  let granjaId: string | null = null;
  if (!unidadId) {
    const u = await tx.unidadNegocio.findFirst({ where: { organizacionId: d.organizacionId, tipo: "GRANJA", activa: true }, orderBy: { codigo: "asc" } });
    if (!u) throw new ErrorVenta("Tu organización no tiene una unidad de granja.");
    unidadId = u.id; granjaId = u.granjaId;
  } else {
    const u = await tx.unidadNegocio.findFirst({ where: { id: unidadId, organizacionId: d.organizacionId } });
    if (!u) throw new ErrorVenta("Esa unidad no es de tu organización.");
    granjaId = u.granjaId;
  }

  // Baja de los animales del lote y edad promedio
  let edadPromDias: number | null = null;
  if (d.loteDesteteId) {
    const lote = await tx.nurseryBatch.findFirst({ where: { id: d.loteDesteteId, tenantId: d.organizacionId }, select: { currentCount: true, entryDate: true, batchCode: true, weanings: { select: { lactationDays: true } } } });
    if (!lote) throw new ErrorVenta("Ese lote de destete no existe.");
    const lact = lote.weanings.length ? lote.weanings.reduce((s, w) => s + w.lactationDays, 0) / lote.weanings.length : 0;
    edadPromDias = Math.round(lact + (d.fechaSalida.getTime() - lote.entryDate.getTime()) / 86_400_000);
    if (!d.bajaYaHecha) {
      if (d.cantidad > lote.currentCount) throw new ErrorVenta(`El lote ${lote.batchCode} tiene ${lote.currentCount} lechones: no se pueden vender ${d.cantidad}.`);
      await tx.nurseryBatch.update({ where: { id: d.loteDesteteId }, data: { currentCount: { decrement: d.cantidad }, ...(lote.currentCount === d.cantidad ? { isActive: false } : {}) } });
    }
  }
  if (d.loteEngordeId) {
    const lote = await tx.growingBatch.findFirst({ where: { id: d.loteEngordeId, tenantId: d.organizacionId }, select: { currentCount: true } });
    if (!lote) throw new ErrorVenta("Ese lote de engorde no existe.");
    if (!d.bajaYaHecha) {
      if (d.cantidad > lote.currentCount) throw new ErrorVenta(`El lote tiene ${lote.currentCount} animales: no se pueden vender ${d.cantidad}.`);
      await tx.growingBatch.update({ where: { id: d.loteEngordeId }, data: { currentCount: { decrement: d.cantidad } } });
    }
  }
  if (!d.bajaYaHecha && (d.loteDesteteId || d.loteEngordeId)) {
    await tx.batchSale.create({
      data: {
        tenantId: d.organizacionId, nurseryBatchId: d.loteDesteteId ?? null, growingBatchId: d.loteEngordeId ?? null,
        saleDate: d.fechaSalida, animalCount: d.cantidad, totalWeightKg: d.kgTotales,
        pricePerKg: Number(importe) / d.kgTotales, totalAmount: Number(importe), buyerName: d.cliente, transferGuide: d.guiaTraslado ?? null,
      },
    });
  }

  const cliente = await tx.contraparte.upsert({
    where: { organizacionId_nombre: { organizacionId: d.organizacionId, nombre: d.cliente } },
    create: { organizacionId: d.organizacionId, nombre: d.cliente, tipo: "CLIENTE" }, update: {},
  });
  const concepto = `${TIPOS_VENTA[d.tipoVenta].label}: ${d.cantidad} × ${(d.kgTotales / d.cantidad).toLocaleString("es-PY", { maximumFractionDigits: 1 })} kg`;
  const mov = await tx.movimiento.create({
    data: {
      organizacionId: d.organizacionId, unidadId, granjaId, fecha: d.fechaSalida, fechaVencimiento: d.fechaVencimientoCobro ?? null,
      tipo: "INGRESO", concepto, categoriaId: categoria.id, subcategoria: DESTINOS[d.destino], cantidad: d.cantidad, unidadMedida: "cabezas",
      contraparteId: cliente.id, montoGs: importe, estado: "POR_COBRAR", origen: "VENTA", facturaNumero: d.remitoFactura ?? null,
      cuentaFondosId: d.cobro?.cuentaFondosId ?? null, medioPago: (d.cobro?.medioPago as never) ?? null, creadoPor: d.creadoPor,
    },
  });
  const venta = await tx.venta.create({
    data: {
      organizacionId: d.organizacionId, unidadId, granjaId, fechaSalida: d.fechaSalida, tipoVenta: d.tipoVenta,
      loteDesteteId: d.loteDesteteId ?? null, loteEngordeId: d.loteEngordeId ?? null, edadPromDias, cantidad: d.cantidad,
      kgTotales: d.kgTotales, modoPrecio: d.modoPrecio,
      precioGsKg: d.modoPrecio === "POR_KG" ? d.precioGs : null, precioGsCabeza: d.modoPrecio === "POR_CABEZA" ? d.precioGs : null,
      importeGs: importe, destino: d.destino, clienteId: cliente.id, recibePor: d.recibePor ?? null,
      remitoFactura: d.remitoFactura ?? null, guiaTraslado: d.guiaTraslado ?? null, fechaVencimientoCobro: d.fechaVencimientoCobro ?? null,
      movimientoId: mov.id, creadoPor: d.creadoPor,
    },
  });
  await tx.movimiento.update({ where: { id: mov.id }, data: { origenId: venta.id } });
  if (d.cobro) {
    await tx.pagoMovimiento.create({ data: { movimientoId: mov.id, fechaPago: d.cobro.fecha, montoGs: importe, cuentaFondosId: d.cobro.cuentaFondosId, medioPago: (d.cobro.medioPago as never) ?? null, creadoPor: d.creadoPor } });
  }
  return { ventaId: venta.id, importe };
}
