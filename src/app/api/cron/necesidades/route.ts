// Fase 14.4 · Cálculo diario de necesidades (Vercel Cron, 08:00 UTC = 05:00 en Asunción).
// Protegido con CRON_SECRET: Vercel manda "Authorization: Bearer <CRON_SECRET>".
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/db/prisma";
import { calcularNecesidades } from "@/lib/necesidades/datos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const dado = Buffer.from(req.headers.get("authorization") ?? ""), esperado = Buffer.from(`Bearer ${secreto}`);
  return dado.length === esperado.length && timingSafeEqual(dado, esperado);
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const orgs = await prisma.productoInventario.groupBy({ by: ["tenantId"], where: { isActive: true } });
  let ok = 0, fallas = 0;
  for (const { tenantId } of orgs) {
    try { await calcularNecesidades(tenantId, { forzar: true, avisar: true }); ok++; }
    catch (e) { fallas++; console.error("[cron necesidades]", tenantId, e); }
  }
  // Las fotos de más de 120 días ya no se usan (la precisión mira 28)
  const borradas = await prisma.necesidadSnapshot.deleteMany({ where: { calculadoEn: { lt: new Date(Date.now() - 120 * 86_400_000) } } });
  return NextResponse.json({ organizaciones: ok, fallas, fotosBorradas: borradas.count });
}
