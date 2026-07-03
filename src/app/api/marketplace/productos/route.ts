import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendorId  = req.nextUrl.searchParams.get("vendorId");
  const categoria = req.nextUrl.searchParams.get("categoria");
  const search    = req.nextUrl.searchParams.get("q");

  const where = {
    isActive: true,
    vendor: { isApproved: true, isActive: true },
    ...(vendorId  ? { vendorId }  : {}),
    ...(categoria ? { categoria: categoria as never } : {}),
    ...(search    ? {
      OR: [
        { nombreProducto:    { contains: search, mode: "insensitive" as const } },
        { principioActivo:   { contains: search, mode: "insensitive" as const } },
        { enfermedadObjetivo:{ contains: search, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const productos = await prisma.marketplaceProducto.findMany({
    where,
    include: { vendor: { select: { id: true, empresaNombre: true, logoUrl: true, ciudad: true } } },
    orderBy: [{ stockDisponible: "desc" }, { nombreProducto: "asc" }],
    take: 200,
  });
  return NextResponse.json(productos);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { vendorId, nombreProducto, categoria, precioGs } = body;
  if (!vendorId || !nombreProducto || !categoria || !precioGs) {
    return NextResponse.json({ error: "vendorId, nombreProducto, categoria y precioGs son requeridos" }, { status: 400 });
  }

  const producto = await prisma.marketplaceProducto.create({
    data: { ...body, stockDisponible: body.stockDisponible ?? 0 },
    include: { vendor: { select: { empresaNombre: true } } },
  });
  return NextResponse.json(producto, { status: 201 });
}
