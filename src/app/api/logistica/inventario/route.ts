export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { computeStockYFaltantes, type CategoriaInventario } from "@/lib/inventario/proyeccion";

const CATEGORIAS_VALIDAS = ["VACUNA", "SUPLEMENTO", "MEDICAMENTO", "MATERIA_PRIMA", "BALANCEADO", "EQUIPAMIENTO"];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categoriaParam = req.nextUrl.searchParams.get("categoria");
  const categoria = categoriaParam && CATEGORIAS_VALIDAS.includes(categoriaParam)
    ? (categoriaParam as CategoriaInventario)
    : undefined;

  const resultado = await computeStockYFaltantes(session.user.tenantId, categoria, 7);
  return NextResponse.json(resultado);
}
