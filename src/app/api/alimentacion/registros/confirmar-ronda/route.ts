export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { invalidateInventario } from "@/lib/cache";
import { z } from "zod";

const filaSchema = z.object({
  feedTypeId:     z.string().min(1),
  farrowingId:    z.string().optional().nullable(),
  nurseryBatchId: z.string().optional().nullable(),
  growingBatchId: z.string().optional().nullable(),
  quantityKg:     z.number().min(0),
});

const schema = z.object({
  recordDate: z.string(), // ISO date string, compartida por toda la ronda
  employeeId: z.string().optional().nullable(),
  filas:      z.array(filaSchema).min(1, "La ronda necesita al menos una fila"),
});

function keyOf(f: { feedTypeId: string; farrowingId?: string | null; nurseryBatchId?: string | null; growingBatchId?: string | null }) {
  return `${f.feedTypeId}|${f.farrowingId ?? ""}|${f.nurseryBatchId ?? ""}|${f.growingBatchId ?? ""}`;
}

// Confirma una ronda completa de alimentación en una sola transacción: si algo
// falla, no queda ningún FeedRecord creado ni ningún movimiento de stock — el
// mismo criterio de "todo o nada" que ya usa la ronda de vacunación de Sanidad.
//
// Todas las lecturas se hacen en lote (fuera del loop) porque cada ida y vuelta
// a la base paga ~200ms de latencia de red — una ronda de 10 filas con 1 query
// por fila tardaba ~6-7s; agrupado en pocas consultas queda en ~1s.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body   = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { recordDate, employeeId, filas } = parsed.data;

  const date = new Date(recordDate);
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  const feedTypeIds = Array.from(new Set(filas.map(f => f.feedTypeId)));

  const [feedTypes, existentes] = await Promise.all([
    prisma.feedType.findMany({ where: { id: { in: feedTypeIds }, tenantId } }),
    prisma.feedRecord.findMany({
      where: { tenantId, feedTypeId: { in: feedTypeIds }, recordDate: { gte: date, lt: nextDay } },
    }),
  ]);
  if (feedTypes.length !== feedTypeIds.length) {
    return NextResponse.json({ error: "Algún tipo de alimento no existe" }, { status: 404 });
  }
  const feedTypeById = new Map(feedTypes.map(ft => [ft.id, ft]));
  const existentePorKey = new Map(existentes.map(r => [keyOf(r), r]));

  const aCrear: typeof filas = [];
  const aActualizar: Array<{ id: string; quantityKg: number }> = [];
  for (const f of filas) {
    const ex = existentePorKey.get(keyOf(f));
    if (ex) aActualizar.push({ id: ex.id, quantityKg: f.quantityKg });
    else aCrear.push(f);
  }

  // Stock de balanceado a descontar (FEFO) — calculado en memoria contra UNA
  // sola lectura de lotes, en vez de una lectura por fila.
  const productoIds = Array.from(new Set(
    filas.map(f => feedTypeById.get(f.feedTypeId)?.productoBalanceadoId).filter((x): x is string => !!x),
  ));
  const lotesTodos = productoIds.length > 0
    ? await prisma.loteInventario.findMany({
        where: { tenantId, vacunaId: { in: productoIds }, cantidadActual: { gt: 0 } },
        orderBy: { fechaVencimiento: "asc" },
      })
    : [];
  const lotesPorProducto = new Map<string, typeof lotesTodos>();
  for (const l of lotesTodos) {
    const arr = lotesPorProducto.get(l.vacunaId) ?? [];
    arr.push(l);
    lotesPorProducto.set(l.vacunaId, arr);
  }
  const remanentePorLote = new Map(lotesTodos.map(l => [l.id, Number(l.cantidadActual)]));
  const decrementoPorLote = new Map<string, number>();
  const movimientos: Array<{ productoId: string; loteId: string; cantidad: number }> = [];
  const rondaId = crypto.randomUUID();

  for (const f of filas) {
    const productoBalanceadoId = feedTypeById.get(f.feedTypeId)?.productoBalanceadoId;
    if (f.quantityKg <= 0 || !productoBalanceadoId) continue;
    let restante = f.quantityKg;
    for (const lote of lotesPorProducto.get(productoBalanceadoId) ?? []) {
      if (restante <= 0) break;
      const disponible = remanentePorLote.get(lote.id) ?? 0;
      if (disponible <= 0) continue;
      const descuento = Math.min(disponible, restante);
      remanentePorLote.set(lote.id, disponible - descuento);
      decrementoPorLote.set(lote.id, (decrementoPorLote.get(lote.id) ?? 0) + descuento);
      movimientos.push({ productoId: productoBalanceadoId, loteId: lote.id, cantidad: descuento });
      restante -= descuento;
    }
  }

  await prisma.$transaction(async (tx) => {
    if (aCrear.length > 0) {
      await tx.feedRecord.createMany({
        data: aCrear.map(f => ({
          tenantId, feedTypeId: f.feedTypeId,
          farrowingId:    f.farrowingId    ?? undefined,
          nurseryBatchId: f.nurseryBatchId ?? undefined,
          growingBatchId: f.growingBatchId ?? undefined,
          recordDate: date, quantityKg: f.quantityKg, employeeId: employeeId ?? undefined,
        })),
      });
    }
    for (const u of aActualizar) {
      await tx.feedRecord.update({ where: { id: u.id }, data: { quantityKg: u.quantityKg, employeeId: employeeId ?? undefined } });
    }
    for (const [loteId, cantidad] of Array.from(decrementoPorLote.entries())) {
      await tx.loteInventario.update({ where: { id: loteId }, data: { cantidadActual: { decrement: cantidad } } });
    }
    if (movimientos.length > 0) {
      await tx.movimientoInventario.createMany({
        data: movimientos.map(m => ({
          tenantId, productoId: m.productoId, loteId: m.loteId,
          tipo: "SALIDA" as const, cantidad: m.cantidad, origen: "ALIMENTACION" as const, referenciaId: rondaId,
        })),
      });
    }
  });

  if (movimientos.length > 0) invalidateInventario(tenantId);

  return NextResponse.json({ count: filas.length });
}
