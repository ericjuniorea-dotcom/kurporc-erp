import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { rawMaterialSchema, rawMaterialLotSchema } from "@/lib/validations/balanceado";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const materials = await prisma.rawMaterial.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    include: {
      lots: {
        orderBy: { receivedDate: "desc" },
        take:    1,
        select:  {
          lotCode: true, receivedDate: true, remainingKg: true, pricePerKg: true,
          crudProteinPct: true, mycotoxinPpb: true,
        },
      },
      _count: { select: { formulaIngredients: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(materials);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = [1, 2, 4, 6];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = rawMaterialSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, materialType, supplierId, minStockKg } = parsed.data;
  const tenantId = session.user.tenantId;

  const existing = await prisma.rawMaterial.findUnique({
    where: { tenantId_name: { tenantId, name } },
  });
  if (existing) return NextResponse.json({ error: "Ya existe una materia prima con ese nombre" }, { status: 409 });

  const material = await prisma.rawMaterial.create({
    data: { tenantId, name, materialType, supplierId: supplierId ?? undefined, minStockKg },
  });

  return NextResponse.json(material, { status: 201 });
}
