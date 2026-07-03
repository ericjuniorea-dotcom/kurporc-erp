import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pedidos = await prisma.marketplacePedido.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      vendor: { select: { empresaNombre: true } },
      items: {
        include: { producto: { select: { nombreProducto: true, unidadMedida: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(pedidos);
}

interface CartItemInput {
  productoId: string;
  cantidad: number;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const body = await req.json() as { items?: CartItemInput[]; notas?: string; direccionEntrega?: string };
  const { items, notas, direccionEntrega } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }

  const productoIds = items.map(i => i.productoId);
  const productos = await prisma.marketplaceProducto.findMany({
    where: { id: { in: productoIds }, isActive: true },
  });

  if (productos.length !== items.length) {
    return NextResponse.json({ error: "Uno o más productos no están disponibles" }, { status: 400 });
  }

  // Agrupar por vendor
  const byVendor: Record<string, { vendorId: string; totalGs: number; lines: { productoId: string; cantidad: number; precioGs: string }[] }> = {};
  for (const item of items) {
    const prod = productos.find(p => p.id === item.productoId)!;
    if (!byVendor[prod.vendorId]) {
      byVendor[prod.vendorId] = { vendorId: prod.vendorId, totalGs: 0, lines: [] };
    }
    const precioUnit = Number(prod.precioGs.toString());
    byVendor[prod.vendorId].totalGs += precioUnit * item.cantidad;
    byVendor[prod.vendorId].lines.push({
      productoId: item.productoId,
      cantidad: item.cantidad,
      precioGs: precioUnit.toString(),
    });
  }

  const pedidosCreados = [];
  for (const entry of Object.values(byVendor)) {
    const pedido = await prisma.marketplacePedido.create({
      data: {
        tenantId,
        vendorId: entry.vendorId,
        totalGs: entry.totalGs.toString(),
        notas,
        direccionEntrega,
        creadoPorId: session.user.id,
        items: {
          create: entry.lines.map(l => ({
            productoId: l.productoId,
            cantidad:   l.cantidad,
            precioGs:   l.precioGs,
          })),
        },
      },
      include: { vendor: { select: { empresaNombre: true } }, items: true },
    });
    pedidosCreados.push(pedido);
  }

  return NextResponse.json({ pedidos: pedidosCreados }, { status: 201 });
}
