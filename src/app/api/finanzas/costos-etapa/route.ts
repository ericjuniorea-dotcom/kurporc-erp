// Finanzas · Costos por etapa (Fase 6): matriz etapa × categoría (directo y con apoyo y estructura), indicadores de
// costo y detalle de lo que compone cada etapa. Solo lectura.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";
import { costosPorEtapa } from "@/lib/finanzas/costeo/costos-etapa";

export const dynamic = "force-dynamic";
const valido = (m: number) => Number.isInteger(m) && m >= 200001 && m <= 210012 && m % 100 >= 1 && m % 100 <= 12;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["finanzas.costos.ver"])) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const hoy = new Date();
  const actual = hoy.getUTCFullYear() * 100 + hoy.getUTCMonth() + 1;
  const desde = Number(req.nextUrl.searchParams.get("desde") ?? actual);
  const hasta = Number(req.nextUrl.searchParams.get("hasta") ?? actual);
  if (!valido(desde) || !valido(hasta) || desde > hasta) return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  const r = await costosPorEtapa(session.user.tenantId, desde, hasta);
  // Detalle: lo que compone cada etapa, agrupado por concepto (los 40 más grandes por etapa)
  const detalle: Record<string, { texto: string; categoria: string; fuente: string; gs: number }[]> = {};
  const agrupado = new Map<string, { etapa: string; texto: string; categoria: string; fuente: string; gs: number }>();
  for (const p of r.partidas) {
    const texto = p.fuente === "INVENTARIO" ? p.texto : p.texto.replace(/ \([A-Z]{3}-\d{2}\)$/, m => m);
    const k = `${p.etapa}|${p.fuente}|${p.categoria}|${texto}`;
    const g = agrupado.get(k) ?? { etapa: p.etapa, texto, categoria: p.categoria, fuente: p.fuente, gs: 0 };
    g.gs += p.gs; agrupado.set(k, g);
  }
  for (const g of agrupado.values()) (detalle[g.etapa] ??= []).push({ texto: g.texto, categoria: g.categoria, fuente: g.fuente, gs: Math.round(g.gs) });
  for (const e of Object.keys(detalle)) detalle[e] = detalle[e].sort((a, b) => Math.abs(b.gs) - Math.abs(a.gs)).slice(0, 40);
  return NextResponse.json({
    desde, hasta, meses: r.meses.length, etapas: r.etapas, categorias: r.categorias, directo: r.directo, conApoyo: r.conApoyo,
    indicadores: r.indicadores, bases: r.bases, pendientes: r.pendientes, financieros: r.financieros, detalle,
  }, { headers: { "Cache-Control": "no-store" } });
}
