import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId as string;

  const { searchParams } = new URL(req.url);
  const geneticLine = searchParams.get("geneticLine");

  const where: any = { tenantId };
  if (geneticLine) where.geneticLine = geneticLine;

  const lots = await prisma.externalSemenLot.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(lots);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId as string;

  const body = await req.json();
  const {
    geneticLine, donorBoarCode, originFarm, productionDate,
    expiryDate, totalDoses, pricePerDoseGs, certUrl, observations,
  } = body;

  // Generate IN-GRN-NNNN code
  const lastLot = await prisma.externalSemenLot.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { lotCode: true },
  });
  let nextNum = 1;
  if (lastLot?.lotCode) {
    const match = lastLot.lotCode.match(/IN-GRN-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const lotCode = `IN-GRN-${String(nextNum).padStart(4, "0")}`;

  const doses = parseInt(totalDoses) || 0;

  const lot = await prisma.externalSemenLot.create({
    data: {
      tenantId, lotCode, geneticLine, donorBoarCode, originFarm,
      productionDate: new Date(productionDate),
      expiryDate:     new Date(expiryDate),
      totalDoses: doses,
      availableDoses: doses,
      pricePerDoseGs: parseFloat(pricePerDoseGs) || 0,
      certUrl, observations,
    },
  });

  return NextResponse.json(lot, { status: 201 });
}
