// Finanzas · costeo por etapa · Fase 5: propuesta de reparto de los gastos compartidos de un mes (solo lectura).
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import { CRITERIOS, proponerReparto } from "@/lib/finanzas/costeo/reparto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await getPermisos();
  if (!puedeAlguno(permisos, ["finanzas.cierre.cerrar", "finanzas.costos.ver"])) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const org = session.user.tenantId;
  const m = Number(req.nextUrl.searchParams.get("mes"));
  if (!Number.isInteger(m) || m < 200001 || m > 210012) return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
  const [p, etapas] = await Promise.all([
    proponerReparto(org, m),
    prisma.etapaCosto.findMany({ where: { organizacionId: org, activa: true, codigo: { notIn: ["INV", "CMP"] } }, orderBy: { orden: "asc" }, select: { codigo: true, nombre: true, tipo: true } }),
  ]);
  return NextResponse.json({
    mes: m, animales: p.animales, personal: p.personal, reglas: p.reglas, criterios: CRITERIOS, etapas, repartidos: p.repartidos,
    subcategorias: p.subcategorias,
    lineas: p.lineas.map(l => ({ ...l, montoGs: l.montoGs.toString(), partes: l.partes.map(x => ({ ...x, montoGs: x.montoGs.toString() })) })),
    puedeRepartir: puede(permisos, "finanzas.cierre.cerrar"),
  }, { headers: { "Cache-Control": "no-store" } });
}
