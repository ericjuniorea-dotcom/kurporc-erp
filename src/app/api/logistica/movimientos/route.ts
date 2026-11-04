export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const productoId = req.nextUrl.searchParams.get("productoId") ?? undefined;

  const movimientos = await prisma.movimientoInventario.findMany({
    where: { tenantId, ...(productoId ? { productoId } : {}) },
    include: {
      producto: { select: { nombre: true, codigo: true, categoria: true, unidadMedida: true } },
      lote:     { select: { numeroLote: true } },
    },
    orderBy: { fecha: "desc" },
    take: 200,
  });

  return NextResponse.json(movimientos.map(m => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    origen: m.origen,
    cantidad: Number(m.cantidad),
    producto: m.producto,
    numeroLote: m.lote?.numeroLote ?? null,
  })));
}
