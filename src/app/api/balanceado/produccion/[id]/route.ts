import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { invalidateInventario } from "@/lib/cache";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = [1, 2, 4, 6];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = await req.json();
  const { status } = body as { status?: "PRODUCED" | "CANCELLED" };
  const tenantId = session.user.tenantId;

  const orden = await prisma.balProductionOrder.findFirst({
    where: { id: params.id, tenantId },
    include: {
      formulaVersion: {
        include: {
          ingredients: { include: { rawMaterial: { select: { id: true, nombre: true } } } },
          formula:     { include: { feedType: true } },
        },
      },
    },
  });
  if (!orden) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  if (orden.status !== "PENDING" && orden.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Esta orden ya fue procesada" }, { status: 409 });
  }

  if (status === "CANCELLED") {
    const cancelada = await prisma.balProductionOrder.update({
      where: { id: orden.id },
      data:  { status: "CANCELLED" },
    });
    return NextResponse.json(cancelada);
  }

  if (status !== "PRODUCED") {
    return NextResponse.json({ error: "status debe ser PRODUCED o CANCELLED" }, { status: 400 });
  }

  const quantityKg  = Number(orden.quantityKg);
  const ingredientes = orden.formulaVersion.ingredients;

  // Pre-chequeo de stock de CADA materia prima antes de descontar nada — una
  // sola consulta para todos los ingredientes en vez de una por ingrediente
  // (cada ida y vuelta a la base paga ~200ms de latencia de red).
  const rawMaterialIds = ingredientes.map(i => i.rawMaterialId);
  const lotesTodos = await prisma.loteInventario.findMany({
    where:   { tenantId, vacunaId: { in: rawMaterialIds }, cantidadActual: { gt: 0 } },
    orderBy: { fechaVencimiento: "asc" }, // FEFO
  });
  const lotesPorIngrediente = new Map<string, typeof lotesTodos>();
  for (const l of lotesTodos) {
    const arr = lotesPorIngrediente.get(l.vacunaId) ?? [];
    arr.push(l);
    lotesPorIngrediente.set(l.vacunaId, arr);
  }
  const necesidades = ingredientes.map((ing) => {
    const necesario = quantityKg * (Number(ing.inclusionPct) / 100);
    const lotes = lotesPorIngrediente.get(ing.rawMaterialId) ?? [];
    const disponible = lotes.reduce((s, l) => s + Number(l.cantidadActual), 0);
    return { ing, necesario, lotes, disponible };
  });

  const faltantes = necesidades.filter(n => n.disponible < n.necesario);
  if (faltantes.length > 0) {
    return NextResponse.json({
      error: "Stock insuficiente de materia prima para completar esta orden",
      detalle: faltantes.map(f => ({
        producto:   f.ing.rawMaterial.nombre,
        necesario:  +f.necesario.toFixed(2),
        disponible: +f.disponible.toFixed(2),
      })),
    }, { status: 422 });
  }

  const feedType = orden.formulaVersion.formula.feedType;

  // Calcular todos los descuentos FEFO en memoria antes de tocar la base —
  // así la transacción sólo emite un update por lote realmente afectado y un
  // único createMany de movimientos, en vez de 2 consultas por lote.
  const decrementoPorLote = new Map<string, number>();
  const movimientosSalida: Array<{ productoId: string; loteId: string; cantidad: number }> = [];
  for (const { ing, necesario, lotes } of necesidades) {
    let restante = necesario;
    for (const lote of lotes) {
      if (restante <= 0) break;
      const descuento = Math.min(Number(lote.cantidadActual), restante);
      decrementoPorLote.set(lote.id, (decrementoPorLote.get(lote.id) ?? 0) + descuento);
      movimientosSalida.push({ productoId: ing.rawMaterialId, loteId: lote.id, cantidad: descuento });
      restante -= descuento;
    }
  }

  const resultado = await prisma.$transaction(async (tx) => {
    for (const [loteId, cantidad] of Array.from(decrementoPorLote.entries())) {
      await tx.loteInventario.update({
        where: { id: loteId },
        data:  { cantidadActual: { decrement: cantidad } },
      });
    }
    if (movimientosSalida.length > 0) {
      await tx.movimientoInventario.createMany({
        data: movimientosSalida.map(m => ({
          tenantId, productoId: m.productoId, loteId: m.loteId,
          tipo: "SALIDA" as const, cantidad: m.cantidad, origen: "PRODUCCION" as const, referenciaId: orden.id,
        })),
      });
    }

    // Producto Balanceado de esta etapa — se crea la primera vez que se produce
    let productoBalanceadoId = feedType.productoBalanceadoId;
    if (!productoBalanceadoId) {
      const ultimo = await tx.productoInventario.findFirst({
        where:   { tenantId, codigo: { startsWith: "B-" } },
        orderBy: { createdAt: "desc" },
        select:  { codigo: true },
      });
      const match = ultimo?.codigo?.match(/^B-(\d+)$/);
      const siguiente = match ? parseInt(match[1], 10) + 1 : 1;
      const codigo = `B-${String(siguiente).padStart(3, "0")}`;

      const producto = await tx.productoInventario.create({
        data: {
          tenantId, nombre: `Balanceado — ${feedType.name}`, categoria: "BALANCEADO",
          codigo, unidadMedida: "KG", enfermedad: "", sectorDestino: "produccion",
        },
      });
      await tx.feedType.update({ where: { id: feedType.id }, data: { productoBalanceadoId: producto.id } });
      productoBalanceadoId = producto.id;
    }

    // Nuevo lote de balanceado terminado
    const hoy = new Date();
    const vencimiento = new Date(hoy);
    vencimiento.setDate(vencimiento.getDate() + 60); // vida útil típica de balanceado terminado

    const loteProducido = await tx.loteInventario.create({
      data: {
        tenantId, vacunaId: productoBalanceadoId,
        numeroLote:       `PROD-${orden.id.slice(-6).toUpperCase()}`,
        fechaIngreso:     hoy,
        fechaVencimiento: vencimiento,
        cantidadInicial:  quantityKg,
        cantidadActual:   quantityKg,
      },
    });
    await tx.movimientoInventario.create({
      data: { tenantId, productoId: productoBalanceadoId, loteId: loteProducido.id, tipo: "ENTRADA", cantidad: quantityKg, origen: "PRODUCCION", referenciaId: orden.id },
    });

    const actualizada = await tx.balProductionOrder.update({
      where: { id: orden.id },
      data:  { status: "PRODUCED", producedAt: hoy, confirmedById: session.user.id, loteInventarioId: loteProducido.id },
    });

    return { orden: actualizada, lote: loteProducido };
  });

  invalidateInventario(tenantId);

  return NextResponse.json(resultado);
}
