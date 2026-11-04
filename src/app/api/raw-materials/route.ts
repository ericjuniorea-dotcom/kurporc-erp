import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { rawMaterialSchema, rawMaterialLotSchema } from "@/lib/validations/balanceado";
import { invalidateInventario } from "@/lib/cache";

async function generarCodigoMP(tenantId: string) {
  const ultimo = await prisma.productoInventario.findFirst({
    where: { tenantId, codigo: { startsWith: "MP-" } },
    orderBy: { createdAt: "desc" },
    select: { codigo: true },
  });
  let siguiente = 1;
  const match = ultimo?.codigo?.match(/^MP-(\d+)$/);
  if (match) siguiente = parseInt(match[1], 10) + 1;
  return `MP-${String(siguiente).padStart(3, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const materials = await prisma.productoInventario.findMany({
    where: { tenantId: session.user.tenantId, isActive: true, categoria: "MATERIA_PRIMA" },
    include: {
      lotes: {
        orderBy: { fechaIngreso: "desc" },
        take:    1,
        select:  {
          id: true, numeroLote: true, fechaIngreso: true, cantidadActual: true,
          nutricion: { select: { pricePerKg: true, crudProteinPct: true, mycotoxinPpb: true } },
        },
      },
      _count: { select: { formulaIngredients: true } },
    },
    orderBy: { nombre: "asc" },
  });

  const result = materials.map(m => ({
    id: m.id, name: m.nombre, materialType: m.materialType, minStockKg: m.stockMinimo ?? 0,
    _count: m._count,
    lots: m.lotes.map(l => ({
      lotCode: l.numeroLote, receivedDate: l.fechaIngreso, remainingKg: Number(l.cantidadActual),
      pricePerKg: l.nutricion?.pricePerKg ?? null,
      crudProteinPct: l.nutricion?.crudProteinPct ?? null,
      mycotoxinPpb: l.nutricion?.mycotoxinPpb ?? null,
    })),
  }));

  return NextResponse.json(result);
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

  const { name, materialType, minStockKg } = parsed.data;
  const tenantId = session.user.tenantId;

  const existing = await prisma.productoInventario.findFirst({
    where: { tenantId, nombre: name, categoria: "MATERIA_PRIMA" },
  });
  if (existing) return NextResponse.json({ error: "Ya existe una materia prima con ese nombre" }, { status: 409 });

  const codigo = await generarCodigoMP(tenantId);
  const material = await prisma.productoInventario.create({
    data: {
      tenantId, nombre: name, categoria: "MATERIA_PRIMA", materialType, codigo,
      unidadMedida: "KG", stockMinimo: Math.round(minStockKg),
      enfermedad: "", sectorDestino: "produccion",
    },
  });

  invalidateInventario(tenantId);
  return NextResponse.json({ id: material.id, name: material.nombre, materialType: material.materialType, minStockKg: material.stockMinimo ?? 0 }, { status: 201 });
}
