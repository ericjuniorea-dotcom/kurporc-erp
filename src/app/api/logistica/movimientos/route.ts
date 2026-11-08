export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "stock.items.ver")) return NextResponse.json({ error: "No tenés permiso para ver esto", permiso: "stock.items.ver" }, { status: 403 });
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
