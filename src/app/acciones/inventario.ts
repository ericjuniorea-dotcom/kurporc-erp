"use server";
// Inventario (ex Logística). La compra se registra en Finanzas y llega acá como recepción pendiente:
// el encargado la acepta (entra al stock con lote, vencimiento y costo) o la rechaza.
// Anular y eliminar: solo el Administrador General; anular deja el registro.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { requirePermiso, ErrorPermiso } from "@/lib/permisos/servidor";
import { invalidateInventario } from "@/lib/cache";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

type R = { ok: true } | { ok: false; error: string };

function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  console.error("[inventario]", e);
  return { ok: false, error: "No se pudo completar." };
}
const refrescar = (org: string) => { invalidateInventario(org); revalidatePath("/inventario"); };
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
async function ctx(actorId: string, organizacionId: string) {
  const h = await headers();
  return { actorId, organizacionId, ip: ipDe(h), userAgent: userAgentDe(h) };
}

const aceptar = z.object({
  id: z.string().uuid(),
  cantidadRecibida: z.number().positive("La cantidad recibida tiene que ser mayor a 0.").max(1e9),
  numeroLote: z.string().trim().min(1, "Escribí el número de lote (o «S/L» si no tiene).").max(60),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  nota: z.string().trim().max(300).optional(),
});

/** Acepta una recepción: crea el lote, lo suma al stock y deja el movimiento con quién lo recibió. */
export async function aceptarRecepcion(datos: z.input<typeof aceptar>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("stock.entradas.crear");
    const d = aceptar.parse(datos);
    const org = permisos.organizacionId;
    const r = await prisma.recepcionInventario.findFirst({ where: { id: d.id, tenantId: org }, include: { producto: { select: { categoria: true } } } });
    if (!r) throw new Error("•Esa recepción no existe.");
    if (r.estado !== "PENDIENTE") throw new Error("•Esa recepción ya fue resuelta.");
    const venceTxt = d.fechaVencimiento || (r.fechaVencimiento ? r.fechaVencimiento.toISOString().slice(0, 10) : "");
    if (!venceTxt && (r.producto.categoria === "VACUNA" || r.producto.categoria === "MEDICAMENTO")) throw new Error("•Las vacunas y los medicamentos necesitan la fecha de vencimiento.");
    // Sin vencimiento (balanceado, equipamiento): se guarda a 2 años para que no figure como vencido
    const vence = venceTxt ? dia(venceTxt) : new Date(Date.now() + 730 * 86_400_000);
    const cant = new Prisma.Decimal(d.cantidadRecibida);
    await conActor(session.user.id, async tx => {
      const lote = await tx.loteInventario.create({
        data: {
          tenantId: org, vacunaId: r.productoId, numeroLote: d.numeroLote, proveedor: r.proveedor, fechaVencimiento: vence,
          cantidadInicial: cant, cantidadActual: cant, costoUnitario: r.costoUnitario, observaciones: d.nota || null,
        },
      });
      await tx.movimientoInventario.create({
        data: { tenantId: org, productoId: r.productoId, loteId: lote.id, tipo: "ENTRADA", cantidad: cant, origen: "COMPRA", referenciaId: r.id, usuarioId: session.user.id,
          nota: Number(cant) !== Number(r.cantidad) ? `Se compraron ${Number(r.cantidad)} y llegaron ${Number(cant)}` : null },
      });
      await tx.recepcionInventario.update({
        where: { id: r.id },
        data: { estado: "ACEPTADA", cantidadRecibida: cant, loteId: lote.id, numeroLote: d.numeroLote, fechaVencimiento: vence, resueltaPor: session.user.id, resueltaEn: new Date(), nota: d.nota || r.nota },
      });
    });
    refrescar(org);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function rechazarRecepcion(id: string, motivo: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("stock.entradas.crear");
    const texto = motivo.trim();
    if (texto.length < 3) throw new Error("•Contá por qué la rechazás.");
    const r = await prisma.recepcionInventario.findFirst({ where: { id, tenantId: permisos.organizacionId } });
    if (!r) throw new Error("•Esa recepción no existe.");
    if (r.estado !== "PENDIENTE") throw new Error("•Esa recepción ya fue resuelta.");
    await prisma.recepcionInventario.update({ where: { id }, data: { estado: "RECHAZADA", resueltaPor: session.user.id, resueltaEn: new Date(), nota: texto } });
    refrescar(permisos.organizacionId);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

/** Solo el Administrador General. Si ya entró al stock y no se usó nada, se descuenta el lote completo; queda el registro. */
export async function anularRecepcion(id: string, motivo: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("stock.items.ver");
    if (!permisos.esPropietario) throw new Error("•Solo el Administrador General puede anular.");
    const texto = motivo.trim();
    if (texto.length < 5) throw new Error("•Escribí el motivo (al menos 5 letras).");
    const org = permisos.organizacionId;
    const r = await prisma.recepcionInventario.findFirst({ where: { id, tenantId: org }, include: { lote: true } });
    if (!r) throw new Error("•Esa recepción no existe.");
    if (r.estado === "ANULADA" || r.estado === "RECHAZADA") throw new Error("•Ya estaba cerrada.");
    await conActor(session.user.id, async tx => {
      if (r.estado === "ACEPTADA" && r.lote) {
        if (Number(r.lote.cantidadActual) !== Number(r.lote.cantidadInicial)) throw new Error("•De ese lote ya se usó una parte: corregí con un ajuste de stock en vez de anular.");
        await tx.loteInventario.update({ where: { id: r.lote.id }, data: { cantidadActual: 0, observaciones: `Anulado: ${texto}` } });
        await tx.movimientoInventario.create({
          data: { tenantId: org, productoId: r.productoId, loteId: r.lote.id, tipo: "AJUSTE", cantidad: r.lote.cantidadInicial.negated(), origen: "AJUSTE_MANUAL", referenciaId: r.id, usuarioId: session.user.id, nota: `Recepción anulada: ${texto}` },
        });
      }
      await tx.recepcionInventario.update({ where: { id }, data: { estado: "ANULADA", resueltaPor: session.user.id, resueltaEn: new Date(), nota: texto } });
    });
    await registrarAuditoria("MOVIMIENTO_ANULADO", "recepcion_inventario", id, { motivo: texto }, await ctx(session.user.id, org));
    refrescar(org);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

/**
 * Solo el Administrador General. Un producto sin ningún uso se elimina; uno con historia se anula
 * (deja de ofrecerse, su historia queda).
 */
export async function eliminarProducto(id: string): Promise<R & { anulado?: boolean }> {
  try {
    const { session, permisos } = await requirePermiso("stock.items.ver");
    if (!permisos.esPropietario) throw new Error("•Solo el Administrador General puede eliminar productos.");
    const org = permisos.organizacionId;
    const p = await prisma.productoInventario.findFirst({
      where: { id, tenantId: org },
      select: { nombre: true, _count: { select: { lotes: true, movimientos: true, recepciones: true, protocoloItems: true, eventosVacunacion: true, aplicaciones: true, feedTypesBalanceado: true } } },
    });
    if (!p) throw new Error("•Ese producto no existe.");
    const usado = Object.values(p._count).some(n => n > 0);
    await conActor(session.user.id, tx => usado
      ? tx.productoInventario.update({ where: { id }, data: { isActive: false } })
      : tx.productoInventario.delete({ where: { id } }));
    await registrarAuditoria("MOVIMIENTO_ANULADO", "producto_inventario", id, { nombre: p.nombre, accion: usado ? "anulado" : "eliminado" }, await ctx(session.user.id, org));
    refrescar(org);
    return { ok: true, anulado: usado };
  } catch (e) { return manejar(e); }
}

/** Recepciones para la pantalla de Inventario: las pendientes y las últimas resueltas. */
export async function recepciones() {
  const { permisos } = await requirePermiso("stock.items.ver");
  const filas = await prisma.recepcionInventario.findMany({
    where: { tenantId: permisos.organizacionId },
    orderBy: [{ estado: "desc" }, { createdAt: "desc" }], take: 60,
    include: { producto: { select: { nombre: true, unidadMedida: true, categoria: true, codigo: true } }, movimiento: { select: { facturaNumero: true, fecha: true } } },
  });
  const ids = Array.from(new Set(filas.flatMap(f => [f.compradoPor, f.resueltaPor]).filter((x): x is string => !!x)));
  const personas = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map(u => [u.id, u.name]));
  return {
    esAdmin: permisos.esPropietario,
    filas: filas.map(f => ({
      id: f.id, estado: f.estado, producto: f.producto.nombre, codigo: f.producto.codigo, categoria: f.producto.categoria, unidad: f.producto.unidadMedida,
      cantidad: Number(f.cantidad), cantidadRecibida: f.cantidadRecibida ? Number(f.cantidadRecibida) : null,
      costoUnitario: f.costoUnitario ? Number(f.costoUnitario) : null, proveedor: f.proveedor, factura: f.movimiento?.facturaNumero ?? null,
      fechaCompra: (f.movimiento?.fecha ?? f.createdAt).toISOString(), numeroLote: f.numeroLote,
      fechaVencimiento: f.fechaVencimiento?.toISOString().slice(0, 10) ?? null,
      compradoPor: personas.get(f.compradoPor) ?? "—", resueltaPor: f.resueltaPor ? personas.get(f.resueltaPor) ?? "—" : null,
      resueltaEn: f.resueltaEn?.toISOString() ?? null, nota: f.nota,
    })),
  };
}

const PREFIJO: Record<string, string> = { VACUNA: "V", SUPLEMENTO: "S", MEDICAMENTO: "M", BALANCEADO: "B", EQUIPAMIENTO: "E" };
const nuevo = z.object({
  nombre: z.string().trim().min(2, "Escribí el nombre del producto.").max(120),
  categoria: z.enum(["VACUNA", "SUPLEMENTO", "MEDICAMENTO", "BALANCEADO", "EQUIPAMIENTO"]),
  unidadMedida: z.enum(["DOSIS", "ML", "KG", "UNIDAD", "SACO"]),
  stockMinimo: z.number().int().min(0).max(1e9).nullable().optional(),
  detalle: z.string().trim().max(120).optional(),
});

/** Alta de un artículo: se hace una sola vez; después las compras y los usos lo mueven. */
export async function crearProducto(datos: z.input<typeof nuevo>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("stock.items.crear");
    const d = nuevo.parse(datos);
    const org = permisos.organizacionId;
    if (await prisma.productoInventario.findFirst({ where: { tenantId: org, isActive: true, nombre: { equals: d.nombre, mode: "insensitive" } }, select: { id: true } }))
      throw new Error("•Ya existe un producto con ese nombre.");
    const prefijo = PREFIJO[d.categoria];
    const usados = await prisma.productoInventario.findMany({ where: { tenantId: org, codigo: { startsWith: `${prefijo}-` } }, select: { codigo: true } });
    const siguiente = usados.reduce((m, u) => Math.max(m, Number(u.codigo?.split("-")[1]) || 0), 0) + 1;
    await conActor(session.user.id, tx => tx.productoInventario.create({
      data: {
        tenantId: org, nombre: d.nombre, enfermedad: d.detalle ?? "", categoria: d.categoria, unidadMedida: d.unidadMedida,
        codigo: `${prefijo}-${String(siguiente).padStart(3, "0")}`, stockMinimo: d.stockMinimo ?? null,
        sectorDestino: d.categoria === "BALANCEADO" ? "lote" : "plantel",
      },
    }));
    refrescar(org);
    return { ok: true };
  } catch (e) { return manejar(e); }
}
