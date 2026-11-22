// Sanidad · aplicaciones de vacunas registradas (últimos días), con las anuladas marcadas (quién, cuándo y por qué).
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await getPermisos();
  if (!puede(permisos, "sanidad.aplicaciones.ver")) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const tenantId = session.user.tenantId;
  const dias = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("dias")) || 30));
  const filas = await prisma.aplicacionVacuna.findMany({
    where: { tenantId, fechaAplicacion: { gte: new Date(Date.now() - dias * 86_400_000) } },
    orderBy: [{ fechaAplicacion: "desc" }, { createdAt: "desc" }], take: 300,
    select: { id: true, fechaAplicacion: true, dosisAplicadas: true, responsable: true, observaciones: true, createdAt: true,
      anuladaEn: true, anuladaPor: true, motivoAnulacion: true,
      vacuna: { select: { nombre: true, unidadMedida: true } }, loteVacuna: { select: { numeroLote: true } },
      evento: { select: { targetLabel: true, sector: true } } },
  });
  const ids = Array.from(new Set(filas.map(f => f.anuladaPor).filter((x): x is string => !!x)));
  const nombre = new Map((ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []).map(u => [u.id, u.name]));
  return NextResponse.json({
    puedeAnular: puede(permisos, "sanidad.aplicaciones.anular"),
    filas: filas.map(f => ({
      id: f.id, fecha: f.fechaAplicacion.toISOString(), vacuna: f.vacuna.nombre, unidad: f.vacuna.unidadMedida, dosis: Number(f.dosisAplicadas),
      a: f.evento.targetLabel ?? f.evento.sector, responsable: f.responsable, lote: f.loteVacuna?.numeroLote ?? null, observaciones: f.observaciones,
      anulada: f.anuladaEn ? { quien: f.anuladaPor ? nombre.get(f.anuladaPor) ?? null : null, cuando: f.anuladaEn.toISOString(), motivo: f.motivoAnulacion } : null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
