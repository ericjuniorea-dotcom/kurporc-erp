import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId as string;

  const { searchParams } = new URL(req.url);
  const state  = searchParams.get("state");
  const search = searchParams.get("search");
  const galpon = searchParams.get("galpon");

  const where: any = { tenantId, AND: [] as any[] };
  if (state) {
    where.plantelState = state;
  } else {
    // Por defecto excluir animales descartados/muertos — van a la pestaña Descartados.
    // OJO: "notIn" no matchea filas con plantelState NULL (semántica SQL), así que
    // hay que incluirlas explícitamente para no perder hembras legacy sin estado asignado.
    where.AND.push({
      OR: [
        { plantelState: { notIn: ["CULLED", "DEAD"] } },
        { plantelState: null },
      ],
    });
  }
  if (search) {
    where.AND.push({
      OR: [
        { erpCode:     { contains: search, mode: "insensitive" } },
        { caravanaCode: { contains: search, mode: "insensitive" } },
        { identCode:   { contains: search, mode: "insensitive" } },
      ],
    });
  }
  if (galpon) {
    where.galponAssigned = galpon;
  }
  if (where.AND.length === 0) delete where.AND;

  const sows = await prisma.sow.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, erpCode: true, caravanaCode: true, identCode: true,
      plantelState: true, geneticLine: true, birthDate: true,
      currentParityCount: true, galponAssigned: true, corralAssigned: true,
      entryDate: true, isActive: true, breed: true,
      animalEvents: {
        orderBy: { eventDate: "desc" },
        take: 1,
        select: { eventType: true, eventDate: true, description: true },
      },
    },
  });

  return NextResponse.json(sows);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as any).tenantId as string;
  const userId   = (session.user as any).id as string;

  const body = await req.json();
  const {
    caravanaCode, tattooCode, rfidChip, breed, geneticLine,
    birthDate, entryWeightKg, sourceProvider, purchasePriceGs,
    damCodeOrigin, sireCodeOrigin, galponAssigned, corralAssigned,
    plantelNotes, initialDestination,
  } = body;

  // Generate HEM-GRN-NNNN code
  const lastSow = await prisma.sow.findFirst({
    where: { tenantId, erpCode: { startsWith: "HEM-GRN-" } },
    orderBy: { createdAt: "desc" },
    select: { erpCode: true },
  });
  let nextNum = 1;
  if (lastSow?.erpCode) {
    const match = lastSow.erpCode.match(/HEM-GRN-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const erpCode = `HEM-GRN-${String(nextNum).padStart(4, "0")}`;

  // Determine initial state
  const weight = parseFloat(entryWeightKg) || 0;
  const birth  = birthDate ? new Date(birthDate) : null;
  const ageMs  = birth ? Date.now() - birth.getTime() : 0;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  let plantelState: string;
  if (initialDestination === "QUARANTINE") {
    plantelState = "QUARANTINE";
  } else {
    plantelState = (weight >= 130 && ageDays >= 210) ? "REPLACEMENT_READY" : "REPLACEMENT_DEVELOPING";
  }

  const sow = await prisma.sow.create({
    data: {
      tenantId,
      identCode: caravanaCode || erpCode,
      breed, geneticLine, birthDate: birthDate ? new Date(birthDate) : null,
      erpCode, caravanaCode, tattooCode, rfidChip,
      entryWeightKg: entryWeightKg ? parseFloat(entryWeightKg) : null,
      sourceProvider,
      purchasePriceGs: purchasePriceGs ? parseFloat(purchasePriceGs) : null,
      damCodeOrigin, sireCodeOrigin, galponAssigned, corralAssigned,
      plantelState: plantelState as any,
      plantelNotes,
      animalEvents: {
        create: {
          tenantId,
          eventType: "ENTRY",
          eventDate: new Date(),
          newState:  plantelState,
          description: `Ingreso al plantel. Destino: ${initialDestination === "QUARANTINE" ? "Cuarentena" : "Plantel activo"}`,
          moduleSource: "PLANTEL",
          userId,
        },
      },
    },
  });

  return NextResponse.json(sow, { status: 201 });
}
