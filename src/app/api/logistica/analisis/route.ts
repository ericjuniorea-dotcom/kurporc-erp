export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { computeStockYFaltantes } from "@/lib/inventario/proyeccion";

function getWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
function weekLabel(d: Date) { return `${d.getFullYear()}-W${String(getWeek(d)).padStart(2, "0")}`; }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const sp    = req.nextUrl.searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  const from  = desde ? new Date(desde) : addDays(new Date(), -90);
  const to    = hasta ? new Date(hasta) : new Date();
  to.setHours(23, 59, 59, 999);

  const [stock, movimientos] = await Promise.all([
    computeStockYFaltantes(tenantId),
    prisma.movimientoInventario.findMany({
      where: { tenantId, fecha: { gte: from, lte: to } },
      select: { fecha: true, tipo: true, origen: true, cantidad: true, productoId: true },
    }),
  ]);

  // ── Costos: ranking de productos por valor invertido en stock actual ────────
  const costos = stock
    .filter(s => s.costoUnitarioPromedio != null)
    .map(s => ({
      productoId: s.productoId, nombre: s.nombre, codigo: s.codigo, categoria: s.categoria,
      unidadMedida: s.unidadMedida, costoUnitarioPromedio: s.costoUnitarioPromedio,
      stockNoVencido: s.stockNoVencido, valorInvertido: s.valorInvertido,
    }))
    .sort((a, b) => b.valorInvertido - a.valorInvertido);
  const valorTotalInventario = stock.reduce((s, p) => s + p.valorInvertido, 0);

  // ── Tendencia de movimientos (conteo semanal — mezclar unidades no es comparable) ──
  const semanaMap = new Map<string, { entradas: number; salidas: number }>();
  for (const m of movimientos) {
    const k = weekLabel(m.fecha);
    const cur = semanaMap.get(k) ?? { entradas: 0, salidas: 0 };
    if (m.tipo === "ENTRADA") cur.entradas++;
    else if (m.tipo === "SALIDA") cur.salidas++;
    semanaMap.set(k, cur);
  }
  const movimientosTendencia = Array.from(semanaMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([semana, v]) => ({ semana: semana.replace(/^\d{4}-/, ""), ...v }));

  return NextResponse.json({ costos, valorTotalInventario, movimientosTendencia });
}
