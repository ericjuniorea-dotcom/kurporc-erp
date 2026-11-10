"use server";
// "Lo que te va a faltar" (Fase 14): configuración por producto, recálculo y compra a la publicación más conveniente.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requirePermiso, ErrorPermiso } from "@/lib/permisos/servidor";
import { calcularNecesidades } from "@/lib/necesidades/datos";
import { unidadesParaCubrir } from "@/lib/pedidos/reglas";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  console.error("[necesidades]", e);
  return { ok: false, error: "No se pudo completar." };
}

export async function recalcularNecesidades(): Promise<R> {
  try {
    const { permisos } = await requirePermiso("compras.necesidades.ver");
    await calcularNecesidades(permisos.organizacionId, { forzar: true });
    revalidatePath("/compras/necesidades");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

const ETAPAS = ["GESTATION", "LACTATION", "PRE_STARTER", "PHASE_1", "PHASE_2", "GROWING"] as const;
const paramSchema = z.object({
  stockItemId: z.string().min(1),
  metodo: z.enum(["AUTO", "RACION", "PROGRAMADO", "HISTORICO", "NO_PREDECIR"]),
  leadTimeDias: z.coerce.number().int().min(0).max(120),
  seguridadDias: z.coerce.number().int().min(0).max(120),
  cicloCompraDias: z.coerce.number().int().min(0).max(120),
  unidadCompra: z.coerce.number().positive("La unidad de compra tiene que ser mayor a 0"),
  mermaPct: z.coerce.number().min(0).max(80, "La merma va de 0 a 80 %"),
  productoCatalogoId: z.string().uuid().nullable(),
  etapas: z.array(z.enum(ETAPAS)),
}).strict();

export async function guardarParametroCompra(datos: z.input<typeof paramSchema>): Promise<R> {
  try {
    const { permisos } = await requirePermiso("compras.necesidades.configurar");
    const d = paramSchema.parse(datos);
    const org = permisos.organizacionId;
    const prod = await prisma.productoInventario.findFirst({ where: { id: d.stockItemId, tenantId: org }, select: { id: true, categoria: true } });
    if (!prod) throw new Error("•El producto no es de tu organización.");
    if (d.productoCatalogoId && !(await prisma.productoCatalogo.findFirst({ where: { id: d.productoCatalogoId, aprobado: true }, select: { id: true } }))) throw new Error("•Ese producto no está en el catálogo.");
    const data = { metodo: d.metodo, leadTimeDias: d.leadTimeDias, seguridadDias: d.seguridadDias, cicloCompraDias: d.cicloCompraDias, unidadCompra: d.unidadCompra, mermaPct: d.mermaPct / 100 };
    await prisma.$transaction(async tx => {
      await tx.parametroCompra.upsert({ where: { organizacionId_stockItemId: { organizacionId: org, stockItemId: prod.id } }, create: { organizacionId: org, stockItemId: prod.id, ...data }, update: data });
      if (d.productoCatalogoId) await tx.stockItemCatalogo.upsert({ where: { organizacionId_stockItemId: { organizacionId: org, stockItemId: prod.id } }, create: { organizacionId: org, stockItemId: prod.id, productoCatalogoId: d.productoCatalogoId }, update: { productoCatalogoId: d.productoCatalogoId } });
      else await tx.stockItemCatalogo.deleteMany({ where: { organizacionId: org, stockItemId: prod.id } });
      // Balanceado: qué etapas de alimentación se dan con este producto (fuente de la ración)
      if (prod.categoria === "BALANCEADO") {
        await tx.feedType.updateMany({ where: { tenantId: org, productoBalanceadoId: prod.id, phase: { notIn: [...d.etapas] } }, data: { productoBalanceadoId: null } });
        if (d.etapas.length) await tx.feedType.updateMany({ where: { tenantId: org, phase: { in: [...d.etapas] } }, data: { productoBalanceadoId: prod.id } });
      }
    });
    await calcularNecesidades(org, { forzar: true });
    revalidatePath("/compras/necesidades");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

/** "Comprar ya": la publicación activa más barata por unidad base que entrega en el departamento. */
export async function mejorPublicacion(productoCatalogoId: string, departamento: string, cantidadBase: number): Promise<R<{ slug: string; cantidad: number; tienda: string } | { slug: null }>> {
  try {
    const { permisos } = await requirePermiso("compras.pedidos.crear");
    const pubs = await prisma.publicacion.findMany({
      where: { productoCatalogoId, estado: "ACTIVA", zonasEntrega: { has: departamento }, tiendaId: { not: permisos.organizacionId }, tienda: { organizacion: { estado: "ACTIVA", verificacion: "VERIFICADA" } } },
      select: { slug: true, precioGs: true, contenidoBase: true, pedidoMinimo: true, tienda: { select: { organizacion: { select: { farmName: true } } } } },
    });
    if (!pubs.length) return { ok: true, slug: null };
    const mejor = pubs.reduce((a, b) => (Number(b.precioGs) / Number(b.contenidoBase) < Number(a.precioGs) / Number(a.contenidoBase) ? b : a));
    return { ok: true, slug: mejor.slug, cantidad: unidadesParaCubrir(cantidadBase, Number(mejor.contenidoBase), mejor.pedidoMinimo), tienda: mejor.tienda.organizacion.farmName };
  } catch (e) { return manejar(e); }
}
