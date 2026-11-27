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
  modoPrecio: "POR_KG" | "POR_CABEZA" | "POR_KG_CANAL"; precioGs: bigint;
  /** Venta por kg de canal: kg canal = kg vivo × rendimiento %. */
  rendimientoPct?: number | null;
  descuentosGs?: bigint;  // tipificación (se restan del importe)
  fleteGs?: bigint;       // gasto de venta del lote (no cambia el importe)
  destino: keyof typeof DESTINOS; cliente: string;
  loteDesteteId?: string | null; loteEngordeId?: string | null;
  /** Varios lotes en una venta: cada uno con cuántos animales salen de él (suman la cantidad). */
  lotes?: { loteId: string; cantidad: number }[];
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
  if (d.modoPrecio === "POR_KG_CANAL" && !(d.rendimientoPct && d.rendimientoPct > 0 && d.rendimientoPct <= 100)) throw new ErrorVenta("Cargá el rendimiento de canal (%).");
  const kgCanal = d.modoPrecio === "POR_KG_CANAL" ? Math.round(d.kgTotales * d.rendimientoPct! / 100 * 100) / 100 : null;
  const bruto = d.modoPrecio === "POR_KG" ? BigInt(Math.round(d.kgTotales * Number(d.precioGs)))
    : d.modoPrecio === "POR_KG_CANAL" ? BigInt(Math.round(kgCanal! * Number(d.precioGs))) : d.precioGs * BigInt(d.cantidad);
  const descuentos = d.descuentosGs ?? 0n;
  if (descuentos < 0n || descuentos >= bruto) throw new ErrorVenta("Los descuentos no pueden superar el importe.");
  const importe = bruto - descuentos;

  // Lotes de la venta: los indicados, o el lote único de antes
  const esEngorde = !!d.loteEngordeId || d.tipoVenta === "CERDO_TERMINADO";
  let lotes = (d.lotes ?? []).filter(l => l.loteId && l.cantidad > 0);
  if (!lotes.length && (d.loteDesteteId || d.loteEngordeId)) lotes = [{ loteId: (d.loteDesteteId || d.loteEngordeId)!, cantidad: d.cantidad }];
  if (new Set(lotes.map(l => l.loteId)).size !== lotes.length) throw new ErrorVenta("Hay un lote repetido en la venta.");
  if (lotes.length && lotes.reduce((s, l) => s + l.cantidad, 0) !== d.cantidad) throw new ErrorVenta(`Los animales de los lotes (${lotes.reduce((s, l) => s + l.cantidad, 0)}) no suman la cantidad vendida (${d.cantidad}).`);

  // Carencia sanitaria (regla del dominio): no se vende un lote con un tratamiento cuya carencia sigue vigente
  for (const l of esEngorde ? lotes : []) {
    const carencia = await tx.withdrawalPeriod.findFirst({
      where: { tenantId: d.organizacionId, growingBatchId: l.loteId, isActive: true, endDate: { gt: d.fechaSalida } },
      orderBy: { endDate: "desc" }, include: { medicine: { select: { name: true } } },
    });
    if (carencia) throw new ErrorVenta(`El lote está en período de carencia por ${carencia.medicine.name} hasta el ${carencia.endDate.toISOString().slice(0, 10).split("-").reverse().join("/")}: no se puede vender antes.`);
  }

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
  // Baja de los animales de cada lote (kg e importe de cada lote en proporción a sus animales) y edad promedio ponderada
  let edadPromDias: number | null = null;
  let edadSuma = 0;
  for (const l of lotes) {
    const parte = l.cantidad / d.cantidad;
    if (!esEngorde) {
      const lote = await tx.nurseryBatch.findFirst({ where: { id: l.loteId, tenantId: d.organizacionId }, select: { currentCount: true, entryDate: true, batchCode: true, weanings: { select: { lactationDays: true } } } });
      if (!lote) throw new ErrorVenta("Uno de los lotes de destete no existe.");
      const lact = lote.weanings.length ? lote.weanings.reduce((s, w) => s + w.lactationDays, 0) / lote.weanings.length : 0;
      edadSuma += (lact + (d.fechaSalida.getTime() - lote.entryDate.getTime()) / 86_400_000) * l.cantidad;
      if (!d.bajaYaHecha) {
        if (l.cantidad > lote.currentCount) throw new ErrorVenta(`El lote ${lote.batchCode} tiene ${lote.currentCount} lechones: no se pueden sacar ${l.cantidad}.`);
        await tx.nurseryBatch.update({ where: { id: l.loteId }, data: { currentCount: { decrement: l.cantidad }, ...(lote.currentCount === l.cantidad ? { isActive: false } : {}) } });
      }
    } else {
      const lote = await tx.growingBatch.findFirst({ where: { id: l.loteId, tenantId: d.organizacionId }, select: { currentCount: true, batchCode: true } });
      if (!lote) throw new ErrorVenta("Uno de los lotes de engorde no existe.");
      if (!d.bajaYaHecha) {
        if (l.cantidad > lote.currentCount) throw new ErrorVenta(`El lote ${lote.batchCode} tiene ${lote.currentCount} animales: no se pueden sacar ${l.cantidad}.`);
        await tx.growingBatch.update({ where: { id: l.loteId }, data: { currentCount: { decrement: l.cantidad } } });
      }
    }
    if (!d.bajaYaHecha) {
      await tx.batchSale.create({
        data: {
          tenantId: d.organizacionId, nurseryBatchId: esEngorde ? null : l.loteId, growingBatchId: esEngorde ? l.loteId : null,
          saleDate: d.fechaSalida, animalCount: l.cantidad, totalWeightKg: Math.round(d.kgTotales * parte * 100) / 100,
          pricePerKg: Number(importe) / d.kgTotales, totalAmount: Math.round(Number(importe) * parte), buyerName: d.cliente, transferGuide: d.guiaTraslado ?? null,
        },
      });
    }
  }
  if (!esEngorde && lotes.length) edadPromDias = Math.round(edadSuma / d.cantidad);

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
      loteDesteteId: !esEngorde ? lotes[0]?.loteId ?? null : null, loteEngordeId: esEngorde ? lotes[0]?.loteId ?? null : null, edadPromDias, cantidad: d.cantidad,
      lotes: lotes.map(l => ({ tipo: esEngorde ? "ENGORDE" : "DESTETE", loteId: l.loteId, cantidad: l.cantidad })),
      kgTotales: d.kgTotales, modoPrecio: d.modoPrecio,
      precioGsKg: d.modoPrecio !== "POR_CABEZA" ? d.precioGs : null, precioGsCabeza: d.modoPrecio === "POR_CABEZA" ? d.precioGs : null,
      rendimientoPct: d.rendimientoPct ?? null, kgCanal, descuentosGs: descuentos, fleteGs: d.fleteGs ?? 0n,
      importeGs: importe, destino: d.destino, clienteId: cliente.id, recibePor: d.recibePor ?? null,
      remitoFactura: d.remitoFactura ?? null, guiaTraslado: d.guiaTraslado ?? null, fechaVencimientoCobro: d.fechaVencimientoCobro ?? null,
      movimientoId: mov.id, creadoPor: d.creadoPor,
    },
  });
  await tx.movimiento.update({ where: { id: mov.id }, data: { origenId: venta.id } });
  // El flete es un gasto de la venta: queda en el libro como pendiente de pago
  if (d.fleteGs && d.fleteGs > 0n) {
    const catFlete = await tx.categoriaFinanciera.findFirst({ where: { nombre: "Flete de entrega", organizacionId: null } });
    if (catFlete) await tx.movimiento.create({ data: {
      organizacionId: d.organizacionId, unidadId, granjaId, fecha: d.fechaSalida, tipo: "GASTO", concepto: `Flete: ${concepto}`,
      categoriaId: catFlete.id, montoGs: d.fleteGs, estado: "PENDIENTE", origen: "VENTA", origenId: venta.id, creadoPor: d.creadoPor,
    } });
  }
  if (d.cobro) {
    await tx.pagoMovimiento.create({ data: { movimientoId: mov.id, fechaPago: d.cobro.fecha, montoGs: importe, cuentaFondosId: d.cobro.cuentaFondosId, medioPago: (d.cobro.medioPago as never) ?? null, creadoPor: d.creadoPor } });
  }
  return { ventaId: venta.id, importe };
}
