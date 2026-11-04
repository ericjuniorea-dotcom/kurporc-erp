export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { invalidateInventario } from "@/lib/cache";

// Registro de compra unificado — mismo mecanismo para materia prima, vacunas,
// medicamentos o suplementos: crea/incrementa un LoteInventario y dispara un
// MovimientoInventario de entrada. Es el único punto de alta de stock por
// compra en todo el sistema (sección 4.9 del documento de arquitectura).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body = await req.json();
  const { productoId, cantidad, numeroLote, fechaVencimiento, proveedor, observaciones, costoUnitario } = body as {
    productoId?: string; cantidad?: number; numeroLote?: string;
    fechaVencimiento?: string; proveedor?: string; observaciones?: string; costoUnitario?: number;
  };
  if (!productoId || !cantidad || cantidad <= 0 || !numeroLote) {
    return NextResponse.json({ error: "productoId, cantidad (>0) y numeroLote son requeridos" }, { status: 400 });
  }

  const [producto, existente] = await Promise.all([
    prisma.productoInventario.findFirst({ where: { id: productoId, tenantId } }),
    prisma.loteInventario.findFirst({ where: { tenantId, vacunaId: productoId, numeroLote } }),
  ]);
  if (!producto) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });

  const hoy = new Date();
  const vencimientoDefault = new Date(hoy.getFullYear() + 3, 0, 1);

  const lote = existente
    ? await prisma.loteInventario.update({
        where: { id: existente.id },
        data:  {
          cantidadActual: { increment: cantidad }, cantidadInicial: { increment: cantidad },
          ...(costoUnitario != null ? { costoUnitario } : {}),
        },
      })
    : await prisma.loteInventario.create({
        data: {
          tenantId, vacunaId: productoId, numeroLote,
          fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : vencimientoDefault,
          cantidadInicial: cantidad, cantidadActual: cantidad,
          costoUnitario: costoUnitario ?? undefined,
          proveedor: proveedor ?? undefined, observaciones: observaciones ?? undefined,
        },
      });

  await prisma.movimientoInventario.create({
    data: { tenantId, productoId, loteId: lote.id, tipo: "ENTRADA", cantidad, origen: "COMPRA", referenciaId: lote.id },
  });
  invalidateInventario(tenantId);

  return NextResponse.json({ ...lote, cantidadInicial: Number(lote.cantidadInicial), cantidadActual: Number(lote.cantidadActual) }, { status: 201 });
}
