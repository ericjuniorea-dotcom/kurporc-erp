// Finanzas · costeo por etapa · Fase 2: revisión masiva de la clasificación de gastos e inversiones.
// GET: movimientos (gasto, inversión, intereses) con su clasificación + catálogos. POST: asignar subcategoría,
// etapa o proyecto a varios a la vez, o clasificar por primera vez los anteriores. Solo cambia la clasificación.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import prisma from "@/lib/db/prisma";
import { asegurarCatalogoCostos } from "@/lib/finanzas/costeo/catalogo";
import { aplicarClasificacion, etapaPorModo } from "@/lib/finanzas/costeo/clasificar";

export const dynamic = "force-dynamic";
const CLASIFICAR = "finanzas.movimientos.crear";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await getPermisos();
  if (!puedeAlguno(permisos, ["finanzas.movimientos.ver", CLASIFICAR])) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const org = session.user.tenantId;
  if ((await prisma.etapaCosto.count({ where: { organizacionId: org } })) === 0) await asegurarCatalogoCostos(org);
  const [movs, sinClasificar, subs, etapas, proyectos] = await Promise.all([
    prisma.movimiento.findMany({
      where: { organizacionId: org, estado: { not: "ANULADO" }, OR: [{ tipo: { in: ["GASTO", "INVERSION"] } }, { subcategoriaGastoId: { not: null } }] },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      select: { id: true, fecha: true, tipo: true, concepto: true, montoGs: true, subcategoriaGastoId: true, etapaCodigo: true, proyectoId: true,
        revisionPendiente: true, motivoRevision: true, categoria: { select: { nombre: true } }, division: { select: { etapaCodigo: true, porcentaje: true } } },
    }),
    prisma.movimiento.count({ where: { organizacionId: org, subcategoriaGastoId: null, tipo: { in: ["GASTO", "INVERSION"] }, estado: { not: "ANULADO" } } }),
    prisma.subcategoriaGasto.findMany({ where: { organizacionId: org }, orderBy: { orden: "asc" }, select: { id: true, codigo: true, nombre: true, modo: true, etapaCodigo: true, activa: true } }),
    prisma.etapaCosto.findMany({ where: { organizacionId: org }, orderBy: { orden: "asc" }, select: { codigo: true, nombre: true, tipo: true, activa: true } }),
    prisma.proyectoInversion.findMany({ where: { organizacionId: org }, orderBy: { fechaInicio: "desc" }, select: { id: true, nombre: true, activo: true } }),
  ]);
  return NextResponse.json({
    movimientos: movs.map(m => ({ ...m, division: m.division.map(x => ({ etapaCodigo: x.etapaCodigo, porcentaje: Number(x.porcentaje) })), montoGs: m.montoGs.toString(), fecha: m.fecha.toISOString().slice(0, 10), categoriaAnterior: m.categoria.nombre, categoria: undefined })),
    sinClasificar, subcategorias: subs, etapas, proyectos, puedeEditar: puede(permisos, CLASIFICAR),
  }, { headers: { "Cache-Control": "no-store" } });
}

const ops = z.discriminatedUnion("op", [
  z.object({ op: z.literal("migrar") }),
  z.object({ op: z.literal("asignar"), ids: z.array(z.string().uuid()).min(1, "Elegí al menos un movimiento").max(500),
    subcategoriaGastoId: z.string().uuid(), etapaCodigo: z.string().regex(/^[A-Z]{2,5}$/).nullable().optional(), proyectoId: z.string().uuid().nullable().optional() }),
]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), CLASIFICAR)) return NextResponse.json({ error: "No tenés permiso para clasificar movimientos." }, { status: 403 });
  const org = session.user.tenantId;
  const p = ops.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = p.data;
  try {
    if (d.op === "migrar") {
      if ((await prisma.etapaCosto.count({ where: { organizacionId: org } })) === 0) await asegurarCatalogoCostos(org);
      const r = await aplicarClasificacion(org, session.user.id);
      return NextResponse.json({ ok: true, aviso: r.clasificados
        ? `Se clasificaron ${r.clasificados.toLocaleString("es-PY")} movimientos; ${r.pendientes.toLocaleString("es-PY")} quedan para revisar.`
        : "No había movimientos sin clasificar." });
    }
    const sub = await prisma.subcategoriaGasto.findFirst({ where: { id: d.subcategoriaGastoId, organizacionId: org }, select: { modo: true, etapaCodigo: true } });
    if (!sub) return NextResponse.json({ error: "Esa subcategoría no existe." }, { status: 400 });
    let etapa: string | null = null, proyecto: string | null = null;
    if (sub.modo === "INVENTARIO") etapa = sub.etapaCodigo ?? null;
    else if (sub.modo === "INVERSION") {
      if (!d.proyectoId) return NextResponse.json({ error: "Toda inversión va a un proyecto: elegilo." }, { status: 400 });
      if (!(await prisma.proyectoInversion.count({ where: { id: d.proyectoId, organizacionId: org } }))) return NextResponse.json({ error: "Ese proyecto no existe." }, { status: 400 });
      etapa = "INV"; proyecto = d.proyectoId;
    } else {
      etapa = d.etapaCodigo ?? etapaPorModo(sub).etapaCodigo;
      if (!etapa) return NextResponse.json({ error: "Elegí la etapa donde se consumió." }, { status: 400 });
      if (!(await prisma.etapaCosto.count({ where: { organizacionId: org, codigo: etapa } }))) return NextResponse.json({ error: "Esa etapa no existe." }, { status: 400 });
    }
    // Reclasificar reemplaza una división anterior entre etapas
    const r = await prisma.$transaction(async tx => {
      await tx.movimientoEtapa.deleteMany({ where: { organizacionId: org, movimientoId: { in: d.ids } } });
      return tx.movimiento.updateMany({ where: { id: { in: d.ids }, organizacionId: org, estado: { not: "ANULADO" } }, data: {
        subcategoriaGastoId: d.subcategoriaGastoId, etapaCodigo: etapa, proyectoId: proyecto,
        revisionPendiente: false, motivoRevision: null, clasificadoPor: session.user.id, clasificadoEn: new Date(),
      } });
    });
    return NextResponse.json({ ok: true, aviso: `${r.count.toLocaleString("es-PY")} ${r.count === 1 ? "movimiento clasificado" : "movimientos clasificados"}.` });
  } catch (e) {
    console.error("[clasificacion-costos]", e);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 400 });
  }
}
