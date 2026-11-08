import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import { jsonConMontos } from "@/lib/permisos/montos";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["plantel.animales.ver", "gestacion.servicios.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const tenantId = (session.user as any).tenantId as string;

  const { searchParams } = new URL(req.url);
  const state  = searchParams.get("state");
  const search = searchParams.get("search");

  const where: any = { tenantId };
  if (state)  where.plantelState = state;
  if (search) {
    where.OR = [
      { erpCode:     { contains: search, mode: "insensitive" } },
      { caravanaCode: { contains: search, mode: "insensitive" } },
      { identCode:   { contains: search, mode: "insensitive" } },
    ];
  }

  const boars = await prisma.boar.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true, erpCode: true, caravanaCode: true, identCode: true,
      plantelState: true, geneticLine: true, birthDate: true,
      galponAssigned: true, corralAssigned: true, entryDate: true,
      isActive: true, breed: true,
      serviceEvents: { select: { id: true } },
      animalEvents: {
        orderBy: { eventDate: "desc" },
        take: 1,
        select: { eventType: true, eventDate: true, description: true },
      },
    },
  });

  return jsonConMontos(boars);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "plantel.animales.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "plantel.animales.crear" }, { status: 403 });
  const tenantId = (session.user as any).tenantId as string;
  const userId   = (session.user as any).id as string;

  const body = await req.json();
  const {
    caravanaCode, tattooCode, rfidChip, breed, geneticLine,
    birthDate, entryWeightKg, sourceProvider, purchasePriceGs,
    galponAssigned, corralAssigned, plantelNotes, initialDestination,
  } = body;

  // Generate REP-GRN-NNNN code
  const lastBoar = await prisma.boar.findFirst({
    where: { tenantId, erpCode: { startsWith: "REP-GRN-" } },
    orderBy: { createdAt: "desc" },
    select: { erpCode: true },
  });
  let nextNum = 1;
  if (lastBoar?.erpCode) {
    const match = lastBoar.erpCode.match(/REP-GRN-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  const erpCode = `REP-GRN-${String(nextNum).padStart(4, "0")}`;

  const plantelState = initialDestination === "QUARANTINE" ? "QUARANTINE" : "ACTIVE";

  const boar = await prisma.boar.create({
    data: {
      tenantId,
      identCode: caravanaCode || erpCode,
      breed, geneticLine,
      birthDate: birthDate ? new Date(birthDate) : null,
      entryDate: new Date(),
      erpCode, caravanaCode, tattooCode, rfidChip,
      entryWeightKg: entryWeightKg ? parseFloat(entryWeightKg) : null,
      sourceProvider,
      purchasePriceGs: purchasePriceGs ? parseFloat(purchasePriceGs) : null,
      galponAssigned, corralAssigned, plantelState: plantelState as any, plantelNotes,
      animalEvents: {
        create: {
          tenantId,
          eventType: "ENTRY",
          eventDate: new Date(),
          newState: plantelState,
          description: `Ingreso al plantel. Destino: ${initialDestination === "QUARANTINE" ? "Cuarentena" : "Plantel activo"}`,
          moduleSource: "PLANTEL",
          userId,
        },
      },
    },
  });

  return NextResponse.json(boar, { status: 201 });
}
