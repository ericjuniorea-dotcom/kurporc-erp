export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import { jsonConMontos } from "@/lib/permisos/montos";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["sanidad.botiquin.ver", "stock.items.ver", "sanidad.aplicaciones.ver", "sanidad.tratamientos.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const { tenantId } = session.user;

  // Un solo catálogo: cada Medicamento o Suplemento del Inventario tiene su par para tratamientos (se crea solo)
  const [productos, existentes] = await Promise.all([
    prisma.productoInventario.findMany({ where: { tenantId, isActive: true, categoria: { in: ["MEDICAMENTO", "SUPLEMENTO"] } }, select: { nombre: true, enfermedad: true } }),
    prisma.medicine.findMany({ where: { tenantId }, select: { name: true } }),
  ]);
  const ya = new Set(existentes.map(m => m.name.trim().toLowerCase()));
  const faltan = productos.filter(p => !ya.has(p.nombre.trim().toLowerCase()));
  if (faltan.length) await prisma.medicine.createMany({ data: faltan.map(p => ({ tenantId, name: p.nombre, activeIngredient: p.enfermedad || null })) });

  const medicamentos = await prisma.medicine.findMany({
    where:   { tenantId, isActive: true },
    orderBy: { name: "asc" },
  });

  return jsonConMontos(medicamentos.map(m => ({
    id: m.id, name: m.name, activeIngredient: m.activeIngredient,
    defaultDoseMl: m.defaultDoseMl ? Number(m.defaultDoseMl) : null,
    withdrawalDays: m.withdrawalDays,
  })));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "stock.items.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "stock.items.crear" }, { status: 403 });
  const { tenantId } = session.user;

  const body = await req.json();
  const { name, activeIngredient, defaultDoseMl, withdrawalDays } = body;
  if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const medicamento = await prisma.medicine.create({
    data: {
      tenantId, name, activeIngredient,
      defaultDoseMl: defaultDoseMl ?? undefined,
      withdrawalDays: withdrawalDays ?? 0,
    },
  });

  return NextResponse.json(medicamento, { status: 201 });
}
