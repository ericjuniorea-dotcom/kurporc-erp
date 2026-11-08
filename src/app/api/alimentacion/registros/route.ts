export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { invalidateInventario } from "@/lib/cache";
import { z } from "zod";
import { getPermisos, puede } from "@/lib/permisos/servidor";

const schema = z.object({
  feedTypeId:     z.string().min(1),
  farrowingId:    z.string().optional().nullable(),
  nurseryBatchId: z.string().optional().nullable(),
  growingBatchId: z.string().optional().nullable(),
  recordDate:     z.string(), // ISO date string
  quantityKg:     z.number().min(0),
  employeeId:     z.string().optional().nullable(),
  isSynced:       z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "alimentacion.consumos.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "alimentacion.consumos.crear" }, { status: 403 });
  const { tenantId } = session.user;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { feedTypeId, farrowingId, nurseryBatchId, growingBatchId, recordDate, quantityKg, employeeId, isSynced } = parsed.data;

  // Verify feedType belongs to tenant
  const feedType = await prisma.feedType.findFirst({ where: { id: feedTypeId, tenantId } });
  if (!feedType) return NextResponse.json({ error: "FeedType not found" }, { status: 404 });

  const date = new Date(recordDate);
  date.setHours(0, 0, 0, 0);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  // Check for existing record today for the same entity — upsert pattern
  const where = {
    tenantId,
    feedTypeId,
    recordDate: { gte: date, lt: nextDay },
    ...(farrowingId    ? { farrowingId }    : {}),
    ...(nurseryBatchId ? { nurseryBatchId } : {}),
    ...(growingBatchId ? { growingBatchId } : {}),
  };

  const existing = await prisma.feedRecord.findFirst({ where });

  let record;
  if (existing) {
    record = await prisma.feedRecord.update({
      where: { id: existing.id },
      data: { quantityKg, employeeId: employeeId ?? undefined, isSynced },
    });
  } else {
    record = await prisma.feedRecord.create({
      data: {
        tenantId,
        feedTypeId,
        farrowingId:    farrowingId    ?? undefined,
        nurseryBatchId: nurseryBatchId ?? undefined,
        growingBatchId: growingBatchId ?? undefined,
        recordDate:     date,
        quantityKg,
        employeeId:     employeeId     ?? undefined,
        isSynced,
      },
    });
  }

  // Descuento de stock de balanceado terminado (FEFO) — si la etapa tiene producto vinculado
  if (quantityKg > 0 && feedType.productoBalanceadoId) {
    let restante = quantityKg;
    const lotesDisponibles = await prisma.loteInventario.findMany({
      where: { tenantId, vacunaId: feedType.productoBalanceadoId, cantidadActual: { gt: 0 } },
      orderBy: { fechaVencimiento: "asc" },
    });
    for (const lote of lotesDisponibles) {
      if (restante <= 0) break;
      const disponible = Number(lote.cantidadActual);
      const descuento  = Math.min(disponible, restante);
      await prisma.loteInventario.update({
        where: { id: lote.id },
        data: { cantidadActual: { decrement: descuento } },
      });
      await prisma.movimientoInventario.create({
        data: { tenantId, productoId: feedType.productoBalanceadoId, loteId: lote.id, tipo: "SALIDA", cantidad: descuento, origen: "ALIMENTACION", referenciaId: record.id },
      });
      restante -= descuento;
    }
    invalidateInventario(tenantId);
  }

  return NextResponse.json(record, { status: existing ? 200 : 201 });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const record = await prisma.feedRecord.findFirst({
    where: { id, tenantId },
    include: { feedType: { select: { name: true, phase: true } } },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(record);
}
