// Fase 13.4 · Recepción de un pedido: Stock + Finanzas + RECIBIDO en una sola transacción.
// Los permisos los valida quien llama (acción recibirPedido); esto valida los datos y escribe.
import "server-only";
import prisma from "@/lib/db/prisma";
import { conActorYNota } from "./servidor";

const DIA = 86_400_000;
const SANIDAD = new Set(["VACUNA", "MEDICAMENTO", "SUPLEMENTO"]);

export type DatosRecepcion = {
  pedidoId: string;
  fecha: string; // AAAA-MM-DD
  unidadId: string;
  items: { itemId: string; cantidadRecibida: number; productoInventarioId: string | null; cantidadStock: number; lote?: string; vencimiento?: string }[];
  pagado: boolean;
  cuentaFondosId?: string | null;
  vencimientoPago?: string;
  facturaNumero?: string;
};

/** Devuelve la nota del evento ("Recibido completo" o con faltantes). Lanza Error("•…") con mensajes para mostrar. */
export async function ejecutarRecepcion(org: string, userId: string, d: DatosRecepcion): Promise<{ nota: string; pedido: { id: string; numero: string; organizacionId: string; tiendaId: string; compradorId: string } }> {
  const p = await prisma.pedido.findUnique({ where: { id: d.pedidoId }, include: { items: { include: { producto: true } }, tienda: { include: { organizacion: { select: { farmName: true, ruc: true } } } } } });
  if (!p || p.organizacionId !== org) throw new Error("•El pedido no existe.");
  if (!["CONFIRMADO", "EN_CAMINO", "ENTREGADO"].includes(p.estado)) throw new Error("•Este pedido no se puede recibir en su estado actual.");
  const unidad = await prisma.unidadNegocio.findFirst({ where: { id: d.unidadId, organizacionId: org, activa: true } });
  if (!unidad) throw new Error("•Elegí la unidad de negocio.");
  if (d.cuentaFondosId && !(await prisma.cuentaFondos.findFirst({ where: { id: d.cuentaFondosId, organizacionId: org } }))) throw new Error("•Esa cuenta no es de tu organización.");

  const stockIds = d.items.map(i => i.productoInventarioId).filter((x): x is string => !!x);
  const stock = await prisma.productoInventario.findMany({ where: { id: { in: stockIds }, tenantId: org } });
  if (stock.length !== new Set(stockIds).size) throw new Error("•Algún producto de stock no es de tu organización.");

  // Validación por ítem y monto de lo recibido
  const lineas = p.items.map(it => {
    const r = d.items.find(x => x.itemId === it.id);
    if (!r) throw new Error("•Faltan ítems en la recepción.");
    const cant = Number(it.cantidad);
    if (r.cantidadRecibida < 0 || r.cantidadRecibida > cant + 1e-9) throw new Error(`•De «${it.descripcion}» pediste ${cant}: no podés recibir más.`);
    const prod = r.productoInventarioId ? stock.find(s => s.id === r.productoInventarioId)! : null;
    if (prod && r.cantidadRecibida > 0) {
      if (!(r.cantidadStock > 0)) throw new Error(`•Indicá cuánto entra a stock de «${it.descripcion}».`);
      if (SANIDAD.has(prod.categoria) && (!r.lote || !r.vencimiento)) throw new Error(`•«${it.descripcion}» es de sanidad: el lote y el vencimiento son obligatorios.`);
    }
    const monto = cant > 0 ? BigInt(Math.round(Number(it.subtotalGs) * (r.cantidadRecibida / cant))) : 0n;
    return { it, r, prod, monto };
  });
  if (!lineas.some(l => l.r.cantidadRecibida > 0)) throw new Error("•No recibiste nada: si no llegó, cancelá el pedido.");

  // Un gasto por categoría financiera del producto; el envío va a la categoría con más monto
  const cats = await prisma.categoriaFinanciera.findMany({ where: { organizacionId: null, tipo: "GASTO" }, select: { id: true, nombre: true } });
  const otros = cats.find(c => c.nombre === "Otros gastos");
  if (!otros) throw new Error("•Faltan las categorías de Finanzas.");
  const porCat = new Map<string, { monto: bigint; lineas: typeof lineas }>();
  for (const l of lineas) {
    if (l.monto <= 0n) continue;
    const cat = cats.find(c => c.nombre === l.it.producto?.categoriaFinanciera) ?? otros;
    const x = porCat.get(cat.id) ?? { monto: 0n, lineas: [] };
    x.monto += l.monto; x.lineas.push(l);
    porCat.set(cat.id, x);
  }
  const mayor = Array.from(porCat.values()).sort((a, b) => (b.monto > a.monto ? 1 : b.monto < a.monto ? -1 : 0))[0];
  if (mayor) mayor.monto += p.envioGs; // el envío se paga igual aunque falte algo

  const fecha = new Date(`${d.fecha}T00:00:00Z`);
  const proveedor = p.tienda.organizacion.farmName.slice(0, 120);
  const faltantes = lineas.filter(l => l.r.cantidadRecibida < Number(l.it.cantidad)).map(l => `${l.it.descripcion}: ${l.r.cantidadRecibida} de ${Number(l.it.cantidad)}`);
  const nota = faltantes.length ? `Recibido con faltantes — ${faltantes.join("; ")}` : "Recibido completo";

  await conActorYNota(userId, nota, async tx => {
    // 1. Stock: lote + movimiento de entrada; se aprende qué producto del catálogo es
    for (const l of lineas) {
      if (!l.prod || l.r.cantidadRecibida <= 0) continue;
      const numeroLote = l.r.lote || p.numero;
      const venc = l.r.vencimiento ? new Date(`${l.r.vencimiento}T00:00:00Z`) : new Date(Date.UTC(fecha.getUTCFullYear() + 3, 0, 1));
      const costoUnitario = Number(l.monto) / l.r.cantidadStock;
      const existente = await tx.loteInventario.findFirst({ where: { tenantId: org, vacunaId: l.prod.id, numeroLote } });
      const lote = existente
        ? await tx.loteInventario.update({ where: { id: existente.id }, data: { cantidadActual: { increment: l.r.cantidadStock }, cantidadInicial: { increment: l.r.cantidadStock }, costoUnitario } })
        : await tx.loteInventario.create({ data: { tenantId: org, vacunaId: l.prod.id, numeroLote, fechaVencimiento: venc, fechaIngreso: fecha, cantidadInicial: l.r.cantidadStock, cantidadActual: l.r.cantidadStock, costoUnitario, proveedor, observaciones: `Pedido ${p.numero}` } });
      await tx.movimientoInventario.create({ data: { tenantId: org, productoId: l.prod.id, loteId: lote.id, tipo: "ENTRADA", cantidad: l.r.cantidadStock, origen: "COMPRA", referenciaId: p.id, fecha } });
      if (l.it.productoCatalogoId) {
        await tx.stockItemCatalogo.upsert({ where: { organizacionId_stockItemId: { organizacionId: org, stockItemId: l.prod.id } }, create: { organizacionId: org, stockItemId: l.prod.id, productoCatalogoId: l.it.productoCatalogoId }, update: { productoCatalogoId: l.it.productoCatalogoId } });
      }
    }
    for (const l of lineas) await tx.pedidoItem.update({ where: { id: l.it.id }, data: { cantidadRecibida: l.r.cantidadRecibida } });

    // 2. Finanzas: proveedor = la tienda; pendiente (Cuentas por pagar) salvo que se haya pagado
    const cp = await tx.contraparte.upsert({
      where: { organizacionId_nombre: { organizacionId: org, nombre: proveedor } },
      create: { organizacionId: org, nombre: proveedor, tipo: "PROVEEDOR", ruc: p.tienda.organizacion.ruc, tiendaId: p.tiendaId }, update: { tiendaId: p.tiendaId },
    });
    const vencePago = d.vencimientoPago ? new Date(`${d.vencimientoPago}T00:00:00Z`) : new Date(fecha.getTime() + (p.metodoPago === "CREDITO_VENDEDOR" ? 30 : 0) * DIA);
    const medio = p.metodoPago === "EFECTIVO" || p.metodoPago === "CONTRA_ENTREGA" ? "EFECTIVO" : p.metodoPago === "CREDITO_VENDEDOR" ? "CREDITO_PROVEEDOR" : "TRANSFERENCIA";
    let primero: string | null = null;
    for (const [categoriaId, g] of porCat) {
      const sanidad = g.lineas.find(l => l.it.unidadBase === "ML" && l.prod);
      const cantidad = g.lineas.reduce((s, l) => s + l.r.cantidadRecibida * Number(l.it.contenidoBase), 0);
      const unidades = Array.from(new Set(g.lineas.map(l => l.it.unidadBase.toLowerCase())));
      const m = await tx.movimiento.create({
        data: {
          organizacionId: org, unidadId: unidad.id, granjaId: unidad.granjaId, fecha, fechaVencimiento: d.pagado ? null : vencePago, tipo: "GASTO",
          concepto: `Pedido ${p.numero} · ${g.lineas.map(l => l.it.descripcion).join(", ")}`.slice(0, 300), categoriaId,
          cantidad: unidades.length === 1 ? cantidad : null, unidadMedida: unidades.length === 1 ? unidades[0] : null,
          contraparteId: cp.id, medioPago: medio, cuentaFondosId: d.cuentaFondosId ?? null, montoGs: g.monto, estado: "PENDIENTE",
          facturaNumero: d.facturaNumero || null, origen: "PEDIDO_MERCADO", origenId: p.id, creadoPor: userId,
          productoSanitarioId: sanidad?.prod?.id ?? null, mlPorUnidad: sanidad ? Number(sanidad.it.contenidoBase) : null,
        },
        select: { id: true },
      });
      primero ??= m.id;
      if (d.pagado) await tx.pagoMovimiento.create({ data: { movimientoId: m.id, fechaPago: fecha, montoGs: g.monto, cuentaFondosId: d.cuentaFondosId ?? null, medioPago: medio, creadoPor: userId } });
    }

    // 3. Pedido RECIBIDO (el trigger deja el evento con la nota)
    const r = await tx.pedido.updateMany({ where: { id: p.id, estado: p.estado }, data: { estado: "RECIBIDO", pagado: d.pagado, movimientoId: primero } });
    if (r.count !== 1) throw new Error("•El pedido cambió mientras lo mirabas. Recargá la página.");
  });
  return { nota, pedido: { id: p.id, numero: p.numero, organizacionId: p.organizacionId, tiendaId: p.tiendaId, compradorId: p.compradorId } };
}
