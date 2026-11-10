"use server";
// Panel de vendedor (Fase 12): publicaciones, fotos, propuesta de productos y datos de la tienda.
// Regla clave: sin verificación de la tienda, las publicaciones no pasan de BORRADOR.
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirTienda } from "@/lib/mercado/vendedor";
import { motivoNoPublicable, slugificar, UNIDADES } from "@/lib/mercado/calculo";
import { DEPARTAMENTOS } from "@/lib/validaciones/paraguay";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const BUCKET = "mercado";
const MAX_FOTO = 300 * 1024;

function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  console.error("[vendedor]", e);
  return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
}

const urlFotoPropia = (u: string) => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!base && u.startsWith(`${base}/storage/v1/object/public/${BUCKET}/`);
};

const publicacionSchema = z.object({
  id: z.string().uuid().optional(),
  productoCatalogoId: z.string().uuid().nullable().optional(),
  categoriaId: z.string().uuid({ message: "Elegí una categoría" }),
  titulo: z.string().trim().min(4, "El título es muy corto").max(120),
  descripcion: z.string().trim().max(4000).optional(),
  marca: z.string().trim().max(80).optional(),
  precioGs: z.coerce.number().int("El precio va en guaraníes, sin decimales").positive("Indicá el precio"),
  unidadVenta: z.string().trim().min(2, "Indicá cómo se vende (ej. Bolsa 40 kg)").max(60),
  unidadBase: z.enum(UNIDADES as [string, ...string[]]),
  contenidoBase: z.coerce.number().positive("Indicá cuánto contiene (ej. 40 kg)").max(1_000_000),
  pedidoMinimo: z.coerce.number().int().min(1).max(100_000),
  stockDisponible: z.coerce.number().int().min(0).nullable().optional(),
  plazoEntregaDias: z.coerce.number().int().min(0).max(120),
  zonasEntrega: z.array(z.enum(DEPARTAMENTOS)).min(1, "Elegí al menos un departamento de entrega"),
  fotos: z.array(z.string().url()).max(6, "Hasta 6 fotos").refine(xs => xs.every(urlFotoPropia), "Fotos inválidas"),
  declaracionSanitaria: z.boolean(),
  publicar: z.boolean(),
}).strict();

export async function guardarPublicacion(datos: z.input<typeof publicacionSchema>): Promise<R<{ id: string; slug: string; aviso: string | null }>> {
  try {
    const d = publicacionSchema.parse(datos);
    const t = await exigirTienda(d.id ? "tienda.publicaciones.editar" : "tienda.publicaciones.crear");
    const categoria = await prisma.categoriaMercado.findUnique({ where: { id: d.categoriaId } });
    if (!categoria) throw new Error("•Elegí una categoría.");
    let requiereReceta = false;
    if (d.productoCatalogoId) {
      const prod = await prisma.productoCatalogo.findUnique({ where: { id: d.productoCatalogoId } });
      if (!prod || (!prod.aprobado && prod.propuestoPor !== t.org.id)) throw new Error("•Ese producto no está en el catálogo.");
      requiereReceta = prod.requiereReceta;
    }
    // Animales: la categoría o su madre exigen tienda verificada y declaración SENACSA
    const madre = categoria.padreId ? await prisma.categoriaMercado.findUnique({ where: { id: categoria.padreId } }) : null;
    const requiereVerif = categoria.requiereVerificacion || !!madre?.requiereVerificacion;

    const previa = d.id ? await prisma.publicacion.findUnique({ where: { id: d.id } }) : null;
    if (d.id && (!previa || previa.tiendaId !== t.org.id)) throw new Error("•La publicación no existe.");
    if (previa && previa.precioGs !== BigInt(d.precioGs) && !t.puede("tienda.precios.editar")) throw new Error("•No tenés permiso para cambiar precios.");
    if (previa?.estado === "RECHAZADA" && d.publicar) throw new Error("•Moderación rechazó esta publicación. Corregila y escribinos a soporte@kurporc.com para revisarla.");

    const bloqueo = motivoNoPublicable({ tiendaVerificada: t.org.verificacion === "VERIFICADA", categoriaRequiereVerificacion: requiereVerif, declaracionSanitaria: d.declaracionSanitaria, fotos: d.fotos.length });
    const estado = previa?.estado === "RECHAZADA" ? "RECHAZADA" : d.publicar && !bloqueo ? "ACTIVA" : d.publicar ? "BORRADOR" : previa?.estado === "ACTIVA" ? "PAUSADA" : (previa?.estado ?? "BORRADOR");
    const data = {
      productoCatalogoId: d.productoCatalogoId ?? null, categoriaId: d.categoriaId, titulo: d.titulo, descripcion: d.descripcion || null, marca: d.marca || null,
      precioGs: BigInt(d.precioGs), unidadVenta: d.unidadVenta, unidadBase: d.unidadBase as "KG", contenidoBase: d.contenidoBase,
      pedidoMinimo: d.pedidoMinimo, stockDisponible: d.stockDisponible ?? null, plazoEntregaDias: d.plazoEntregaDias, zonasEntrega: d.zonasEntrega,
      fotos: d.fotos, requiereReceta, declaracionSanitaria: d.declaracionSanitaria, estado: estado as "BORRADOR",
    };
    const p = previa
      ? await prisma.publicacion.update({ where: { id: previa.id }, data })
      : await prisma.publicacion.create({ data: { ...data, tiendaId: t.org.id, slug: `${slugificar(d.titulo)}-${randomBytes(3).toString("hex")}` } });
    revalidatePath("/vendedor/productos");
    revalidatePath(`/mercado/p/${p.slug}`);
    return { ok: true, id: p.id, slug: p.slug, aviso: d.publicar && bloqueo ? bloqueo : null };
  } catch (e) { return manejar(e); }
}

export async function cambiarEstadoPublicacion(id: string, estado: "ACTIVA" | "PAUSADA"): Promise<R<{ aviso: string | null }>> {
  try {
    const t = await exigirTienda("tienda.publicaciones.pausar");
    const p = await prisma.publicacion.findUnique({ where: { id } });
    if (!p || p.tiendaId !== t.org.id) throw new Error("•La publicación no existe.");
    if (p.estado === "RECHAZADA") throw new Error("•Moderación rechazó esta publicación: no se puede reactivar.");
    if (estado === "ACTIVA") {
      const cat = await prisma.categoriaMercado.findUnique({ where: { id: p.categoriaId } });
      const madre = cat?.padreId ? await prisma.categoriaMercado.findUnique({ where: { id: cat.padreId } }) : null;
      const bloqueo = motivoNoPublicable({ tiendaVerificada: t.org.verificacion === "VERIFICADA", categoriaRequiereVerificacion: !!cat?.requiereVerificacion || !!madre?.requiereVerificacion, declaracionSanitaria: p.declaracionSanitaria, fotos: p.fotos.length });
      if (bloqueo) return { ok: true, aviso: bloqueo };
    }
    await prisma.publicacion.update({ where: { id }, data: { estado } });
    revalidatePath("/vendedor/productos");
    return { ok: true, aviso: null };
  } catch (e) { return manejar(e); }
}

/** Foto ya convertida a WebP en el navegador (≤ 300 KB). Se valida el contenido real, no el nombre. */
export async function subirFoto(form: FormData): Promise<R<{ url: string }>> {
  try {
    const t = await exigirTienda("tienda.publicaciones.crear");
    const f = form.get("foto");
    if (!(f instanceof File)) throw new Error("•Elegí una foto.");
    if (f.size > MAX_FOTO) throw new Error("•La foto pesa más de 300 KB.");
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") throw new Error("•La foto tiene que ser WebP.");
    const ruta = `${t.org.id}/${Date.now()}-${randomBytes(4).toString("hex")}.webp`;
    const sb = createAdminClient();
    const { error } = await sb.storage.from(BUCKET).upload(ruta, buf, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
    if (error) { console.error("[subirFoto]", error.message); throw new Error("•No se pudo subir la foto."); }
    return { ok: true, url: sb.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl };
  } catch (e) { return manejar(e); }
}

const propuestaSchema = z.object({
  nombre: z.string().trim().min(3, "Nombre del producto").max(120),
  categoriaId: z.string().uuid({ message: "Elegí una categoría" }),
  unidadBase: z.enum(UNIDADES as [string, ...string[]]),
}).strict();

/** "Proponer producto": entra al catálogo sin aprobar; la tienda lo puede usar ya, los demás cuando se apruebe. */
export async function proponerProducto(datos: z.input<typeof propuestaSchema>): Promise<R<{ id: string }>> {
  try {
    const d = propuestaSchema.parse(datos);
    const t = await exigirTienda("tienda.publicaciones.crear");
    if (!(await prisma.categoriaMercado.findUnique({ where: { id: d.categoriaId }, select: { id: true } }))) throw new Error("•Elegí una categoría.");
    const p = await prisma.productoCatalogo.create({
      data: { codigo: `PROP-${randomBytes(4).toString("hex").toUpperCase()}`, nombre: d.nombre, categoriaId: d.categoriaId, unidadBase: d.unidadBase as "KG", aprobado: false, propuestoPor: t.org.id },
    });
    return { ok: true, id: p.id };
  } catch (e) { return manejar(e); }
}

const tiendaSchema = z.object({
  descripcion: z.string().trim().max(2000).optional(),
  zonasEntrega: z.array(z.enum(DEPARTAMENTOS)),
  horario: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(30).regex(/^\+?[\d\s()-]*$/, "WhatsApp inválido").optional(),
}).strict();

export async function guardarTienda(datos: z.input<typeof tiendaSchema>): Promise<R> {
  try {
    const d = tiendaSchema.parse(datos);
    const t = await exigirTienda("tienda.perfil.editar");
    await conActor(t.usuarioId, async tx => {
      await tx.tienda.update({ where: { organizacionId: t.org.id }, data: { descripcion: d.descripcion || null, zonasEntrega: d.zonasEntrega, horario: d.horario || null } });
      await tx.tenant.update({ where: { id: t.org.id }, data: { whatsapp: d.whatsapp || null } });
    });
    revalidatePath("/vendedor/tienda");
    return { ok: true };
  } catch (e) { return manejar(e); }
}
