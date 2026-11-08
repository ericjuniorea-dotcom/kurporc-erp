export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { cached, invalidateInventario } from "@/lib/cache";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import { jsonConMontos } from "@/lib/permisos/montos";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["sanidad.botiquin.ver", "stock.items.ver", "sanidad.aplicaciones.ver", "sanidad.tratamientos.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const { tenantId } = session.user;

  const result = await cached(`vacunas:${tenantId}`, 8_000, async () => {
    const vacunas = await prisma.productoInventario.findMany({
      where: { tenantId, isActive: true },
      include: {
        lotes: {
          where: { cantidadActual: { gt: 0 } },
          select: { id: true, cantidadActual: true, fechaVencimiento: true, abierto: true, numeroLote: true },
        },
        _count: { select: { eventosVacunacion: { where: { estado: "pendiente" } } } },
      },
      orderBy: { nombre: "asc" },
    });

    return vacunas.map(v => ({
      ...v,
      dosisMl: Number(v.dosisMl),
      stockTotal: v.lotes.reduce((s, l) => s + Number(l.cantidadActual), 0),
      eventosPendientes: v._count.eventosVacunacion,
      lotes: v.lotes.map(l => ({
        ...l,
        cantidadActual: Number(l.cantidadActual),
        fechaVencimiento: l.fechaVencimiento.toISOString(),
        diasParaVencer: Math.floor((l.fechaVencimiento.getTime() - Date.now()) / 86400000),
      })),
    }));
  });

  return jsonConMontos(result);
}

const PREFIJO_POR_CATEGORIA: Record<string, string> = {
  VACUNA: "V",
  SUPLEMENTO: "S",
  MEDICAMENTO: "M",
};

async function generarCodigo(tenantId: string, categoria: string) {
  const prefijo = PREFIJO_POR_CATEGORIA[categoria] ?? "V";
  // No filtra por isActive: un producto dado de baja no libera su número.
  const ultimo = await prisma.productoInventario.findFirst({
    where: { tenantId, codigo: { startsWith: `${prefijo}-` } },
    orderBy: { createdAt: "desc" },
    select: { codigo: true },
  });
  let siguiente = 1;
  const match = ultimo?.codigo?.match(new RegExp(`^${prefijo}-(\\d+)$`));
  if (match) siguiente = parseInt(match[1], 10) + 1;
  return `${prefijo}-${String(siguiente).padStart(3, "0")}`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "stock.items.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "stock.items.crear" }, { status: 403 });
  const { tenantId } = session.user;

  const body = await req.json();
  const {
    nombre, enfermedad, sectorDestino, viaAplicacion, dosisMl, criticidad, bloqueoServicio,
    observaciones, intervaloRefuerzo, categoria, stockMinimo, unidadMedida,
  } = body;
  if (!nombre || !enfermedad) return NextResponse.json({ error: "nombre y enfermedad requeridos" }, { status: 400 });

  const categoriaFinal = categoria ?? "VACUNA";
  const codigo = await generarCodigo(tenantId, categoriaFinal);

  const vacuna = await prisma.productoInventario.create({
    data: {
      tenantId, nombre, enfermedad,
      categoria: categoriaFinal,
      codigo,
      sectorDestino: sectorDestino ?? "plantel",
      unidadMedida: unidadMedida ?? "DOSIS",
      stockMinimo: stockMinimo != null ? Number(stockMinimo) : null,
      viaAplicacion: viaAplicacion ?? "IM",
      dosisMl: dosisMl ?? 2,
      criticidad: criticidad ?? "alta",
      bloqueoServicio: bloqueoServicio ?? false,
      observaciones, intervaloRefuerzo,
    },
  });
  invalidateInventario(tenantId);
  return NextResponse.json(vacuna, { status: 201 });
}
