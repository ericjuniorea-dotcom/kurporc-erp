// Fase 12 · Consultas del Mercado (solo servidor). Lo público: publicaciones ACTIVAS de tiendas
// activas no rechazadas. Mismo orden para todas las tiendas, incluida la del operador (12.5).
import "server-only";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { palabrasBusqueda, type UnidadBase } from "./calculo";

export const POR_PAGINA = 24;
export type Orden = "precio" | "nuevos" | "calificacion" | "relevancia";

export type Tarjeta = {
  id: string; slug: string; titulo: string; marca: string | null; precioGs: bigint; unidadVenta: string; unidadBase: UnidadBase;
  contenidoBase: number; foto: string | null; zonas: string[]; requiereReceta: boolean; categoria: string;
  tienda: { nombre: string; slug: string; verificada: boolean; calificacion: number; resenas: number };
};

export async function categoriasMercado() {
  const cats = await prisma.categoriaMercado.findMany({ orderBy: [{ orden: "asc" }, { nombre: "asc" }] });
  const raices = cats.filter(c => !c.padreId);
  return raices.map(r => ({ ...r, hijas: cats.filter(c => c.padreId === r.id) }));
}

type Filtros = { q?: string; categoria?: string; depto?: string; precioMax?: number; verificados?: boolean; orden?: Orden; pagina?: number; tienda?: string; ids?: string[] };

export async function buscarPublicaciones(f: Filtros): Promise<{ tarjetas: Tarjeta[]; total: number }> {
  const cond: Prisma.Sql[] = [Prisma.sql`p.estado = 'ACTIVA'`, Prisma.sql`t.estado = 'ACTIVA'`, Prisma.sql`t.verificacion <> 'RECHAZADA'`];
  const palabras = palabrasBusqueda(f.q ?? "");
  const texto = Prisma.sql`public.texto_busqueda(p.titulo || ' ' || coalesce(p.marca, '') || ' ' || coalesce(p.descripcion, ''))`;
  for (const w of palabras) cond.push(Prisma.sql`${texto} like ${"%" + w + "%"}`);
  if (f.categoria) {
    // La categoría elegida y sus hijas
    cond.push(Prisma.sql`p.categoria_id in (select id from categoria_mercado where slug = ${f.categoria} or padre_id = (select id from categoria_mercado where slug = ${f.categoria}))`);
  }
  if (f.depto) cond.push(Prisma.sql`${f.depto} = any(p.zonas_entrega)`);
  if (f.verificados) cond.push(Prisma.sql`t.verificacion = 'VERIFICADA'`);
  if (f.precioMax && f.precioMax > 0) cond.push(Prisma.sql`p.precio_gs <= ${BigInt(Math.round(f.precioMax))}`);
  if (f.tienda) cond.push(Prisma.sql`t.slug = ${f.tienda}`);
  if (f.ids) cond.push(Prisma.sql`p.id::text = any(${f.ids})`);
  const where = Prisma.join(cond, " and ");
  const orden = f.orden === "precio" ? Prisma.sql`p.precio_gs::numeric / p.contenido_base asc`
    : f.orden === "calificacion" ? Prisma.sql`ti.calificacion desc, ti.total_resenas desc, p.created_at desc`
    : f.orden === "relevancia" && palabras.length ? Prisma.sql`extensions.similarity(${texto}, ${palabras.join(" ")}) desc, p.created_at desc`
    : Prisma.sql`p.created_at desc`;
  const pagina = Math.max(0, f.pagina ?? 0);
  const desde = Prisma.sql`from publicacion p join tienda ti on ti.organizacion_id = p.tienda_id join tenants t on t.id = p.tienda_id join categoria_mercado c on c.id = p.categoria_id where ${where}`;
  const [filas, total] = await Promise.all([
    prisma.$queryRaw<{ id: string; slug: string; titulo: string; marca: string | null; precio_gs: bigint; unidad_venta: string; unidad_base: UnidadBase; contenido_base: Prisma.Decimal; foto: string | null; zonas_entrega: string[]; requiere_receta: boolean; categoria: string; tienda: string; tienda_slug: string; verificacion: string; calificacion: Prisma.Decimal; total_resenas: number }[]>`
      select p.id, p.slug, p.titulo, p.marca, p.precio_gs, p.unidad_venta, p.unidad_base, p.contenido_base, p.fotos[1] as foto, p.zonas_entrega, p.requiere_receta,
             c.nombre as categoria, t."farmName" as tienda, t.slug as tienda_slug, t.verificacion::text as verificacion, ti.calificacion, ti.total_resenas
      ${desde} order by ${orden} limit ${POR_PAGINA} offset ${pagina * POR_PAGINA}`,
    prisma.$queryRaw<{ n: bigint }[]>`select count(*) as n ${desde}`.then(r => Number(r[0]?.n ?? 0)),
  ]);
  return {
    total,
    tarjetas: filas.map(r => ({
      id: r.id, slug: r.slug, titulo: r.titulo, marca: r.marca, precioGs: r.precio_gs, unidadVenta: r.unidad_venta, unidadBase: r.unidad_base,
      contenidoBase: Number(r.contenido_base), foto: r.foto, zonas: r.zonas_entrega, requiereReceta: r.requiere_receta, categoria: r.categoria,
      tienda: { nombre: r.tienda, slug: r.tienda_slug, verificada: r.verificacion === "VERIFICADA", calificacion: Number(r.calificacion), resenas: r.total_resenas },
    })),
  };
}

/** Publicación por slug. Pública solo si está ACTIVA; la tienda dueña la ve en cualquier estado. */
export async function publicacionPorSlug(slug: string, tiendaQueMira?: string | null) {
  const p = await prisma.publicacion.findUnique({ where: { slug } });
  if (!p) return null;
  const [tienda, org, categoria, producto] = await Promise.all([
    prisma.tienda.findUnique({ where: { organizacionId: p.tiendaId } }),
    prisma.tenant.findUnique({ where: { id: p.tiendaId }, select: { farmName: true, slug: true, verificacion: true, estado: true, departamento: true, whatsapp: true, logoUrl: true } }),
    prisma.categoriaMercado.findUnique({ where: { id: p.categoriaId } }),
    p.productoCatalogoId ? prisma.productoCatalogo.findUnique({ where: { id: p.productoCatalogoId }, select: { codigo: true, nombre: true } }) : null,
  ]);
  if (!org || !tienda || !categoria) return null;
  const visible = p.estado === "ACTIVA" && org.estado === "ACTIVA" && org.verificacion !== "RECHAZADA";
  if (!visible && tiendaQueMira !== p.tiendaId) return null;
  return { p, tienda, org, categoria, producto, visible };
}

export async function tiendaPorSlug(slug: string) {
  const org = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, farmName: true, slug: true, tipo: true, verificacion: true, estado: true, departamento: true, distrito: true, logoUrl: true, createdAt: true } });
  if (!org || org.tipo !== "VENDEDOR" || org.estado !== "ACTIVA" || org.verificacion === "RECHAZADA") return null;
  const tienda = await prisma.tienda.findUnique({ where: { organizacionId: org.id } });
  return tienda ? { org, tienda } : null;
}
