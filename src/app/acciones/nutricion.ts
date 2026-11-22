"use server";
// Sanidad y Nutrición: carga diaria de balanceado (descuenta del inventario con quién lo cargó) y plan de alimentación.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { requirePermiso, ErrorPermiso, puede } from "@/lib/permisos/servidor";
import { invalidateInventario } from "@/lib/cache";
import { descontarStock } from "@/lib/inventario/descontar";
import { datosNutricionDia, fechaDia } from "@/lib/nutricion/dia";
import { consumoPorPeriodo } from "@/lib/nutricion/periodo";
import { asegurarPlanSugerido, MODULOS_NUTRICION, esModuloNutricion } from "@/lib/nutricion/plan";
import { registrarAuditoria } from "@/lib/seguridad/auditoria";

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
  const d = await datosNutricionDia(permisos.organizacionId, FECHA.parse(fecha));
  // Anular solo con el permiso «anular» (lo da el Administrador General)
  const anula = puede(permisos, "alimentacion.consumos.anular");
  return { ...d, registros: d.registros.map(r => ({ ...r, puedeAnular: anula && !r.anulado })) };
}

const hoyPY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date());

const consumo = z.object({
  fecha: FECHA,
  feedTypeId: z.string().min(1).max(40),
  farrowingId: z.string().max(40).nullable().optional(),
  kg: z.number().gt(0, "Cargá cuántos kg se entregaron.").max(100_000),
});

/**
 * Registra una entrega de balanceado (por módulo, o por hembra en Maternidad). Cada entrega es un registro nuevo:
 * en un día puede haber varias del mismo balanceado. Descuenta del inventario y queda quién la cargó y a qué hora.
 */
export async function registrarConsumo(datos: z.input<typeof consumo>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("alimentacion.consumos.crear");
    const d = consumo.parse(datos);
    const org = permisos.organizacionId;
    if (fechaDia(d.fecha).getTime() > Date.now() + DIA) throw new Error("•No se puede cargar un día que todavía no pasó.");
    const tipo = await prisma.feedType.findFirst({ where: { id: d.feedTypeId, tenantId: org }, select: { id: true, name: true, productoBalanceadoId: true } });
    if (!tipo) throw new Error("•Ese balanceado no existe.");
    if (d.farrowingId && !(await prisma.farrowingEvent.findFirst({ where: { id: d.farrowingId, tenantId: org }, select: { id: true } }))) throw new Error("•Esa camada no existe.");
    let aviso: string | undefined;
    await conActor(session.user.id, async tx => {
      const reg = await tx.feedRecord.create({ data: { tenantId: org, feedTypeId: tipo.id, farrowingId: d.farrowingId ?? null, recordDate: fechaDia(d.fecha), quantityKg: d.kg, employeeId: session.user.id } });
      if (!tipo.productoBalanceadoId) return;
      const r = await descontarStock(tx, { tenantId: org, productoId: tipo.productoBalanceadoId, cantidad: d.kg, origen: "ALIMENTACION", referenciaId: reg.id, usuarioId: session.user.id, nota: `Consumo del ${d.fecha.split("-").reverse().join("/")}` });
      if (r.faltante > 0) aviso = `Guardado. En el inventario faltaron ${r.faltante.toLocaleString("es-PY")} kg de ${tipo.name}: se descontó lo que había.`;
    });
    invalidateInventario(org);
    return { ok: true, aviso };
  } catch (e) { return manejar(e); }
}

/**
 * Anula una carga (nunca se borra): queda quién la anuló, cuándo y por qué, el balanceado vuelve a los lotes de
 * donde salió y deja de contar en consumos y costos. Solo con el permiso «anular» (lo da el Administrador General).
 */
export async function anularConsumo(id: string, motivo: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("alimentacion.consumos.anular");
    const org = permisos.organizacionId;
    const texto = String(motivo ?? "").trim().slice(0, 300);
    if (texto.length < 3) throw new Error("•Escribí por qué la anulás.");
    const reg = await prisma.feedRecord.findFirst({ where: { id: String(id).slice(0, 40), tenantId: org }, select: { id: true, anuladoEn: true, quantityKg: true, recordDate: true, feedType: { select: { name: true } } } });
    if (!reg) throw new Error("•Esa carga no existe.");
    if (reg.anuladoEn) throw new Error("•Esa carga ya estaba anulada.");
    await conActor(session.user.id, async tx => {
      const salidas = await tx.movimientoInventario.findMany({ where: { tenantId: org, referenciaId: reg.id, origen: "ALIMENTACION", tipo: "SALIDA" }, select: { loteId: true, productoId: true, cantidad: true } });
      const entradas = await tx.movimientoInventario.findMany({ where: { tenantId: org, referenciaId: reg.id, origen: "ALIMENTACION", tipo: "ENTRADA" }, select: { loteId: true, cantidad: true } });
      // Neto por lote (descuenta devoluciones anteriores) y vuelve al stock
      const neto = new Map<string, { productoId: string; cant: number }>();
      for (const m of salidas) if (m.loteId) neto.set(m.loteId, { productoId: m.productoId, cant: (neto.get(m.loteId)?.cant ?? 0) + Number(m.cantidad) });
      for (const m of entradas) if (m.loteId && neto.has(m.loteId)) neto.get(m.loteId)!.cant -= Number(m.cantidad);
      for (const [loteId, { productoId, cant }] of neto) {
        if (cant <= 0.0005) continue;
        await tx.loteInventario.update({ where: { id: loteId }, data: { cantidadActual: { increment: cant } } });
        await tx.movimientoInventario.create({ data: { tenantId: org, productoId, loteId, tipo: "ENTRADA", cantidad: cant, origen: "ALIMENTACION", referenciaId: reg.id, usuarioId: session.user.id, nota: "Carga de consumo anulada" } });
      }
      await tx.feedRecord.update({ where: { id: reg.id }, data: { anuladoEn: new Date(), anuladoPor: session.user.id, motivoAnulacion: texto } });
    });
    await registrarAuditoria("MOVIMIENTO_ANULADO", "feed_record", reg.id, { motivo: texto, kg: Number(reg.quantityKg), balanceado: reg.feedType.name, fecha: reg.recordDate.toISOString().slice(0, 10) }, { actorId: session.user.id, organizacionId: org });
    invalidateInventario(org);
    return { ok: true };
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

/* ─── Consumo por período ───────────────────────────────────────────── */

const periodoSchema = z.object({ desde: FECHA, hasta: FECHA, agrupar: z.enum(["dia", "semana", "mes", "anio"]) });

/** Consumo de balanceado por día, semana, mes o año (como mucho 3 años de una vez). */
export async function consumoPeriodo(datos: z.input<typeof periodoSchema>) {
  const { permisos } = await requirePermiso("alimentacion.consumos.ver");
  const d = periodoSchema.parse(datos);
  if (d.desde > d.hasta) throw new Error("La fecha desde es posterior a la fecha hasta.");
  if (fechaDia(d.hasta).getTime() - fechaDia(d.desde).getTime() > 3 * 366 * DIA) throw new Error("Elegí un rango de hasta 3 años.");
  return consumoPorPeriodo(permisos.organizacionId, d.desde, d.hasta, d.agrupar);
}
