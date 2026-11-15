"use server";
// Sanidad y Nutrición: carga diaria de balanceado (descuenta del inventario con quién lo cargó) y plan de alimentación.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { requirePermiso, ErrorPermiso } from "@/lib/permisos/servidor";
import { invalidateInventario } from "@/lib/cache";
import { descontarStock } from "@/lib/inventario/descontar";
import { datosNutricionDia, fechaDia } from "@/lib/nutricion/dia";
import { asegurarPlanSugerido, MODULOS_NUTRICION, esModuloNutricion } from "@/lib/nutricion/plan";

type R = { ok: true; aviso?: string } | { ok: false; error: string };
const DIA = 86_400_000;
const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  console.error("[nutricion]", e);
  return { ok: false, error: "No se pudo completar." };
}

export async function nutricionDia(fecha: string) {
  const { permisos } = await requirePermiso("alimentacion.consumos.ver");
  return datosNutricionDia(permisos.organizacionId, FECHA.parse(fecha));
}

const consumo = z.object({
  fecha: FECHA,
  feedTypeId: z.string().min(1).max(40),
  farrowingId: z.string().max(40).nullable().optional(),
  kg: z.number().min(0, "Los kg no pueden ser negativos.").max(100_000),
});

/**
 * Guarda lo consumido en el día (por módulo, o por hembra en Maternidad). Si ya había un registro se corrige:
 * la diferencia se descuenta del stock (o vuelve al lote de donde salió). Queda quién lo cargó.
 */
export async function guardarConsumo(datos: z.input<typeof consumo>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("alimentacion.consumos.crear");
    const d = consumo.parse(datos);
    const org = permisos.organizacionId;
    if (fechaDia(d.fecha).getTime() > Date.now() + DIA) throw new Error("•No se puede cargar un día que todavía no pasó.");
    const tipo = await prisma.feedType.findFirst({ where: { id: d.feedTypeId, tenantId: org }, select: { id: true, name: true, productoBalanceadoId: true } });
    if (!tipo) throw new Error("•Ese balanceado no existe.");
    if (d.farrowingId && !(await prisma.farrowingEvent.findFirst({ where: { id: d.farrowingId, tenantId: org }, select: { id: true } }))) throw new Error("•Esa camada no existe.");
    const desde = fechaDia(d.fecha), hasta = new Date(desde.getTime() + DIA);
    let aviso: string | undefined;
    await conActor(session.user.id, async tx => {
      const previo = await tx.feedRecord.findFirst({ where: { tenantId: org, feedTypeId: tipo.id, farrowingId: d.farrowingId ?? null, nurseryBatchId: null, growingBatchId: null, recordDate: { gte: desde, lt: hasta } } });
      const antes = previo ? Number(previo.quantityKg) : 0;
      if (d.kg === 0 && previo) await tx.feedRecord.delete({ where: { id: previo.id } });
      const reg = d.kg === 0 ? previo : previo
        ? await tx.feedRecord.update({ where: { id: previo.id }, data: { quantityKg: d.kg, employeeId: session.user.id } })
        : await tx.feedRecord.create({ data: { tenantId: org, feedTypeId: tipo.id, farrowingId: d.farrowingId ?? null, recordDate: desde, quantityKg: d.kg, employeeId: session.user.id } });
      const diferencia = d.kg - antes;
      if (!tipo.productoBalanceadoId || !reg || Math.abs(diferencia) < 0.0005) return;
      if (diferencia > 0) {
        const r = await descontarStock(tx, { tenantId: org, productoId: tipo.productoBalanceadoId, cantidad: diferencia, origen: "ALIMENTACION", referenciaId: reg.id, usuarioId: session.user.id, nota: `Consumo del ${d.fecha.split("-").reverse().join("/")}` });
        if (r.faltante > 0) aviso = `En el inventario faltaron ${r.faltante.toLocaleString("es-PY")} kg de ${tipo.name}: se descontó lo que había.`;
      } else {
        // Corrección a la baja: vuelve al último lote del que salió para este registro
        const ultimo = await tx.movimientoInventario.findFirst({ where: { tenantId: org, referenciaId: reg.id, tipo: "SALIDA" }, orderBy: { fecha: "desc" }, select: { loteId: true } });
        if (ultimo?.loteId) {
          await tx.loteInventario.update({ where: { id: ultimo.loteId }, data: { cantidadActual: { increment: -diferencia } } });
          await tx.movimientoInventario.create({ data: { tenantId: org, productoId: tipo.productoBalanceadoId, loteId: ultimo.loteId, tipo: "ENTRADA", cantidad: -diferencia, origen: "ALIMENTACION", referenciaId: reg.id, usuarioId: session.user.id, nota: "Corrección del consumo cargado" } });
        }
      }
    });
    invalidateInventario(org);
    revalidatePath("/alimentacion");
    return { ok: true, aviso };
  } catch (e) { return manejar(e); }
}

/* ─── Plan de alimentación ──────────────────────────────────────────── */

export async function cargarPlanSugerido(): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("alimentacion.etapas.configurar");
    const r = await conActor(session.user.id, tx => asegurarPlanSugerido(tx, permisos.organizacionId));
    invalidateInventario(permisos.organizacionId);
    revalidatePath("/alimentacion");
    return { ok: true, aviso: r.productos ? `Se crearon ${r.productos} balanceados en el inventario.` : undefined };
  } catch (e) { return manejar(e); }
}

const tipoSchema = z.object({
  id: z.string().max(40).optional(),
  modulo: z.string().refine(esModuloNutricion, "Módulo inválido"),
  productoId: z.string().min(1, "Elegí el balanceado del inventario.").max(40),
  kgPorAnimal: z.number().min(0).max(100).nullable(),
});

/** Agrega o cambia un balanceado de un módulo (el nombre es el del producto del inventario). */
export async function guardarTipoBalanceado(datos: z.input<typeof tipoSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("alimentacion.etapas.configurar");
    const d = tipoSchema.parse(datos);
    const org = permisos.organizacionId;
    const prod = await prisma.productoInventario.findFirst({ where: { id: d.productoId, tenantId: org, categoria: "BALANCEADO", isActive: true }, select: { nombre: true } });
    if (!prod) throw new Error("•Ese balanceado no está en el inventario (creálo en Inventario → Nuevo producto).");
    const modulo = d.modulo as keyof typeof MODULOS_NUTRICION;
    const phase = { GESTACION: "GESTATION", MATERNIDAD_HEMBRAS: "LACTATION", MATERNIDAD_LECHONES: "PRE_STARTER", INICIACION: "PHASE_1", ENGORDE: "GROWING" }[modulo];
    const datosTipo = { name: prod.nombre, modulo, por: MODULOS_NUTRICION[modulo].por, kgPorAnimalDia: d.kgPorAnimal, productoBalanceadoId: d.productoId, phase, isActive: true };
    await conActor(session.user.id, async tx => {
      if (d.id) {
        if (!(await tx.feedType.findFirst({ where: { id: d.id, tenantId: org } }))) throw new Error("•Ese balanceado no existe.");
        await tx.feedType.update({ where: { id: d.id }, data: datosTipo });
      } else {
        const orden = (await tx.feedType.aggregate({ where: { tenantId: org }, _max: { sortOrder: true } }))._max.sortOrder ?? 0;
        await tx.feedType.create({ data: { tenantId: org, sortOrder: orden + 1, ...datosTipo } });
      }
    });
    revalidatePath("/alimentacion");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function quitarTipoBalanceado(id: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("alimentacion.etapas.configurar");
    const t = await prisma.feedType.findFirst({ where: { id, tenantId: permisos.organizacionId } });
    if (!t) throw new Error("•Ese balanceado no existe.");
    await conActor(session.user.id, tx => tx.feedType.update({ where: { id }, data: { isActive: false } }));
    revalidatePath("/alimentacion");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

/** Plan para la pantalla de configuración: módulos, balanceados elegidos y balanceados disponibles en el inventario. */
export async function planAlimentacion() {
  const { permisos } = await requirePermiso("alimentacion.consumos.ver");
  const org = permisos.organizacionId;
  const [tipos, productos] = await Promise.all([
    prisma.feedType.findMany({ where: { tenantId: org, isActive: true }, orderBy: [{ sortOrder: "asc" }], select: { id: true, name: true, modulo: true, kgPorAnimalDia: true, productoBalanceadoId: true } }),
    prisma.productoInventario.findMany({ where: { tenantId: org, categoria: "BALANCEADO", isActive: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, codigo: true } }),
  ]);
  return {
    tipos: tipos.filter(t => esModuloNutricion(t.modulo)).map(t => ({ id: t.id, nombre: t.name, modulo: t.modulo, kgPorAnimal: t.kgPorAnimalDia ? Number(t.kgPorAnimalDia) : null, productoId: t.productoBalanceadoId })),
    productos,
  };
}
