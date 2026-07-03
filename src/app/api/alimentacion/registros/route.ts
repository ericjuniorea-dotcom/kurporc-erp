export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

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
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Descuento de stock de producto terminado (si hay stock registrado)
  if (quantityKg > 0) {
    const stockEntry = await prisma.finishedStock.findFirst({
      where: { tenantId, feedTypeId },
      orderBy: { producedAt: "desc" },
    });
    if (stockEntry && Number(stockEntry.currentStockKg) > 0) {
      const decrementBy = Math.min(Number(stockEntry.currentStockKg), quantityKg);
      await prisma.finishedStock.update({
        where: { id: stockEntry.id },
        data: { currentStockKg: { decrement: decrementBy } },
      });
    }
  }

  return NextResponse.json(record, { status: existing ? 200 : 201 });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
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
