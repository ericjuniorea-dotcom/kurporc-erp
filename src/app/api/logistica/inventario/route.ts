export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { computeStockYFaltantes, type CategoriaInventario } from "@/lib/inventario/proyeccion";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { jsonConMontos } from "@/lib/permisos/montos";

const CATEGORIAS_VALIDAS = ["VACUNA", "SUPLEMENTO", "MEDICAMENTO", "BALANCEADO", "EQUIPAMIENTO"];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "stock.items.ver")) return NextResponse.json({ error: "No tenés permiso para ver esto", permiso: "stock.items.ver" }, { status: 403 });

  const categoriaParam = req.nextUrl.searchParams.get("categoria");
  const categoria = categoriaParam && CATEGORIAS_VALIDAS.includes(categoriaParam)
    ? (categoriaParam as CategoriaInventario)
    : undefined;

  const resultado = await computeStockYFaltantes(session.user.tenantId, categoria, 7);
  return jsonConMontos(resultado);
}
