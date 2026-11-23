// Finanzas · catálogos de costeo por etapa (Fase 1). GET: el catálogo de la organización (se siembra la primera vez).
// POST: editar (solo con «finanzas.categorias.editar», Administración). Nunca se borra: se activa o desactiva.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import prisma from "@/lib/db/prisma";
import { asegurarCatalogoCostos, catalogoCostos } from "@/lib/finanzas/costeo/catalogo";

export const dynamic = "force-dynamic";
const EDITAR = "finanzas.categorias.editar";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const permisos = await getPermisos();
  if (!puedeAlguno(permisos, ["finanzas.movimientos.ver", "finanzas.costos.ver", EDITAR])) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const org = session.user.tenantId;
  if ((await prisma.etapaCosto.count({ where: { organizacionId: org } })) === 0) await asegurarCatalogoCostos(org);
  const datos = await catalogoCostos(org);
  return NextResponse.json({ ...datos, puedeEditar: puede(permisos, EDITAR) }, { headers: { "Cache-Control": "no-store" } });
}

const texto = (max: number) => z.string().trim().max(max);
const codigoEtapa = z.string().trim().regex(/^[A-Z]{2,5}$/, "Código de etapa inválido").nullable().optional();
const ops = z.discriminatedUnion("op", [
  z.object({ op: z.literal("sembrar") }),
  z.object({ op: z.literal("etapa"), id: z.string().uuid().optional(), codigo: z.string().trim().regex(/^[A-Z]{2,5}$/, "El código va en mayúsculas (2 a 5 letras)").optional(),
    nombre: texto(80).min(2, "Escribí el nombre"), tipo: z.enum(["PRODUCTIVA", "APOYO", "ESTRUCTURA", "FINANCIERA", "INVERSION", "PENDIENTE_REPARTO"]).optional(),
    incluye: texto(300).default(""), unidadCosteo: texto(100).default(""), rolResponsable: texto(100).default(""), activa: z.boolean().default(true) }),
  z.object({ op: z.literal("categoria"), id: z.string().uuid(), nombre: texto(80).min(2, "Escribí el nombre"), activa: z.boolean() }),
  z.object({ op: z.literal("subcategoria"), id: z.string().uuid().optional(), categoriaId: z.string().uuid().optional(),
    codigo: z.string().trim().regex(/^[A-Z]{3}-\d{2}$/, "El código es como ALI-01").optional(), nombre: texto(120).min(2, "Escribí el nombre"),
    modo: z.enum(["INVENTARIO", "DIRECTO", "REPARTO", "INVERSION"]), etapaRegla: texto(200).default(""), etapaCodigo: codigoEtapa,
    notaControl: texto(300).nullable().optional(), activa: z.boolean().default(true) }),
  z.object({ op: z.literal("item"), id: z.string().max(40), subcategoriaGastoId: z.string().uuid().nullable(), etapaConsumoCodigo: codigoEtapa }),
  z.object({ op: z.literal("proyecto"), id: z.string().uuid().optional(), nombre: texto(120).min(2, "Escribí el nombre del proyecto"),
    granjaId: z.string().max(40).nullable().optional(), estado: z.enum(["PLANIFICADO", "EN_CURSO", "TERMINADO", "CANCELADO"]),
    presupuestoGs: z.string().regex(/^\d{0,15}$/, "Presupuesto en guaraníes, sin puntos").nullable().optional(),
    fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio inválida"), fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
    vidaUtilMeses: z.number().int().min(1).max(600).nullable().optional(), etapaCodigo: codigoEtapa, notas: texto(500).nullable().optional(), activo: z.boolean().default(true) }),
]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), EDITAR)) return NextResponse.json({ error: "Solo Administración puede editar los catálogos de costos." }, { status: 403 });
  const org = session.user.tenantId;
  const p = ops.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  const d = p.data;
  try {
    if (d.op === "sembrar") {
      const n = await asegurarCatalogoCostos(org);
      return NextResponse.json({ ok: true, aviso: n ? `Se agregaron ${n} elementos del catálogo sugerido.` : "El catálogo ya estaba completo." });
    }
    if (d.op === "etapa") {
      if (d.id) {
        const r = await prisma.etapaCosto.updateMany({ where: { id: d.id, organizacionId: org }, data: { nombre: d.nombre, incluye: d.incluye, unidadCosteo: d.unidadCosteo, rolResponsable: d.rolResponsable, activa: d.activa } });
        if (!r.count) return NextResponse.json({ error: "Esa etapa no existe." }, { status: 404 });
      } else {
        if (!d.codigo || !d.tipo) return NextResponse.json({ error: "Falta el código y el tipo de la etapa." }, { status: 400 });
        const orden = await prisma.etapaCosto.count({ where: { organizacionId: org } });
        await prisma.etapaCosto.create({ data: { organizacionId: org, codigo: d.codigo, nombre: d.nombre, tipo: d.tipo, incluye: d.incluye, unidadCosteo: d.unidadCosteo, rolResponsable: d.rolResponsable, orden } });
      }
    } else if (d.op === "categoria") {
      await prisma.categoriaGasto.updateMany({ where: { id: d.id, organizacionId: org }, data: { nombre: d.nombre, activa: d.activa } });
    } else if (d.op === "subcategoria") {
      if (d.etapaCodigo && !(await prisma.etapaCosto.count({ where: { organizacionId: org, codigo: d.etapaCodigo } }))) return NextResponse.json({ error: "Esa etapa no existe." }, { status: 400 });
      if (d.id) {
        const r = await prisma.subcategoriaGasto.updateMany({ where: { id: d.id, organizacionId: org }, data: { nombre: d.nombre, modo: d.modo, etapaRegla: d.etapaRegla, etapaCodigo: d.etapaCodigo ?? null, notaControl: d.notaControl ?? null, activa: d.activa } });
        if (!r.count) return NextResponse.json({ error: "Esa subcategoría no existe." }, { status: 404 });
      } else {
        if (!d.categoriaId || !d.codigo) return NextResponse.json({ error: "Falta la categoría y el código." }, { status: 400 });
        const cat = await prisma.categoriaGasto.findFirst({ where: { id: d.categoriaId, organizacionId: org }, select: { codigo: true } });
        if (!cat) return NextResponse.json({ error: "Esa categoría no existe." }, { status: 400 });
        if (!d.codigo.startsWith(`${cat.codigo}-`)) return NextResponse.json({ error: `El código tiene que empezar con ${cat.codigo}-` }, { status: 400 });
        const orden = await prisma.subcategoriaGasto.count({ where: { organizacionId: org } });
        await prisma.subcategoriaGasto.create({ data: { organizacionId: org, categoriaId: d.categoriaId, codigo: d.codigo, nombre: d.nombre, modo: d.modo, etapaRegla: d.etapaRegla, etapaCodigo: d.etapaCodigo ?? null, notaControl: d.notaControl ?? null, orden } });
      }
    } else if (d.op === "item") {
      if (d.subcategoriaGastoId && !(await prisma.subcategoriaGasto.count({ where: { id: d.subcategoriaGastoId, organizacionId: org } }))) return NextResponse.json({ error: "Esa subcategoría no existe." }, { status: 400 });
      const r = await prisma.productoInventario.updateMany({ where: { id: d.id, tenantId: org }, data: { subcategoriaGastoId: d.subcategoriaGastoId, etapaConsumoCodigo: d.etapaConsumoCodigo ?? null } });
      if (!r.count) return NextResponse.json({ error: "Ese ítem no existe." }, { status: 404 });
    } else if (d.op === "proyecto") {
      if (d.granjaId && !(await prisma.granja.count({ where: { id: d.granjaId, organizacionId: org } }))) return NextResponse.json({ error: "Esa granja no es de tu organización." }, { status: 400 });
      const datos = { nombre: d.nombre, granjaId: d.granjaId || null, estado: d.estado, presupuestoGs: d.presupuestoGs ? BigInt(d.presupuestoGs) : null,
        fechaInicio: new Date(`${d.fechaInicio}T00:00:00Z`), fechaFin: d.fechaFin ? new Date(`${d.fechaFin}T00:00:00Z`) : null,
        vidaUtilMeses: d.vidaUtilMeses ?? null, etapaCodigo: d.etapaCodigo ?? null, notas: d.notas || null, activo: d.activo };
      if (d.id) {
        const r = await prisma.proyectoInversion.updateMany({ where: { id: d.id, organizacionId: org }, data: datos });
        if (!r.count) return NextResponse.json({ error: "Ese proyecto no existe." }, { status: 404 });
      } else await prisma.proyectoInversion.create({ data: { organizacionId: org, ...datos } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error && /Unique constraint/i.test(e.message) ? "Ya existe uno con ese código." : "No se pudo guardar.";
    if (msg === "No se pudo guardar.") console.error("[catalogos-costos]", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
