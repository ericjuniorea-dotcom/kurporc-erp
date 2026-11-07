import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const onlyActive = searchParams.get("active") !== "false";

  const batches = await prisma.nurseryBatch.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(onlyActive ? { isActive: true } : {}),
    },
    include: {
      pen:          { select: { number: true, location: { select: { name: true } } } },
      weightRecords: {
        orderBy: { recordDate: "desc" },
        take:    2,
        select:  { recordDate: true, avgWeightKg: true, dailyGainKg: true, animalCount: true },
      },
      phaseChanges: {
        orderBy: { changeDate: "desc" },
        take:    1,
        select:  { toPhase: true, changeDate: true },
      },
      _count: { select: { weanings: true } },
    },
    orderBy: { entryDate: "desc" },
    take:    200,
  });

  return NextResponse.json(batches);
}
