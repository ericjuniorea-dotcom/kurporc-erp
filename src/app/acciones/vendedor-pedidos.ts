"use server";
// Pedidos y cotizaciones del lado de la tienda (Fase 13).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { exigirTienda } from "@/lib/mercado/vendedor";
import { hoyUTC } from "@/lib/finanzas/calculos";
import { avisar, transicionarPedido } from "@/lib/pedidos/servidor";
import type { Estado } from "@/lib/pedidos/reglas";

type R = { ok: true } | { ok: false; error: string };

function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  console.error("[vendedor-pedidos]", e);
  return { ok: false, error: "No se pudo completar. Probá de nuevo." };
}

const respuestaSchema = z.object({
  solicitudId: z.string().uuid(),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    publicacionId: z.string().uuid().nullable().optional(),
    descripcion: z.string().trim().min(2).max(200),
    precioUnitarioGs: z.coerce.number().int().positive("Precio inválido"),
    unidadVenta: z.string().trim().min(1).max(60),
    contenidoBase: z.coerce.number().positive("Contenido inválido"),
    cantidad: z.coerce.number().positive("Cantidad inválida"),
  })).min(1, "Cotizá al menos un producto"),
  costoEnvioGs: z.coerce.number().int().min(0),
  plazoDias: z.coerce.number().int().min(0).max(120),
  validaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de validez inválida"),
  nota: z.string().trim().max(1000).optional(),
}).strict();

export async function responderCotizacion(datos: z.input<typeof respuestaSchema>): Promise<R> {
  try {
    const t = await exigirTienda("tienda.cotizaciones.responder");
    const d = respuestaSchema.parse(datos);
    const s = await prisma.solicitudCotizacion.findUnique({ where: { id: d.solicitudId }, include: { items: true, tiendas: { where: { tiendaId: t.org.id } }, respuestas: { where: { tiendaId: t.org.id }, include: { pedidos: { select: { id: true } } } } } });
    if (!s || !s.tiendas.length) throw new Error("•La solicitud no existe.");
    if (s.estado !== "ABIERTA" || s.venceEn.getTime() < Date.now()) throw new Error("•La solicitud ya está cerrada.");
    if (s.respuestas[0]?.pedidos.length) throw new Error("•El comprador ya hizo el pedido con tu cotización.");
    const validaHasta = new Date(`${d.validaHasta}T00:00:00Z`);
    if (validaHasta.getTime() < hoyUTC().getTime()) throw new Error("•La validez tiene que ser de hoy en adelante.");
    const ids = new Set(s.items.map(i => i.id));
    if (!d.items.every(i => ids.has(i.itemId))) throw new Error("•Hay productos que no están en la solicitud.");
    // Las publicaciones citadas tienen que ser de esta tienda
    const pubIds = d.items.map(i => i.publicacionId).filter((x): x is string => !!x);
    if (pubIds.length && (await prisma.publicacion.count({ where: { id: { in: pubIds }, tiendaId: t.org.id } })) !== new Set(pubIds).size) throw new Error("•Publicación inválida.");
    const data = { items: d.items, costoEnvioGs: BigInt(d.costoEnvioGs), plazoDias: d.plazoDias, validaHasta, nota: d.nota || null, respondidaPor: t.usuarioId };
    await prisma.respuestaCotizacion.upsert({ where: { solicitudId_tiendaId: { solicitudId: s.id, tiendaId: t.org.id } }, create: { solicitudId: s.id, tiendaId: t.org.id, ...data }, update: data });
    await prisma.notificacion.create({ data: { userId: s.compradorId, organizacionId: s.organizacionId, tipo: "COTIZACION", titulo: `${t.org.farmName} respondió tu pedido de cotización`, cuerpo: `${d.items.length} producto${d.items.length > 1 ? "s" : ""}, entrega en ${d.plazoDias} días.`, enlace: `/compras/cotizaciones/${s.id}` } });
    revalidatePath(`/vendedor/cotizaciones/${s.id}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

const PERMISO: Partial<Record<Estado, string>> = {
  CONFIRMADO: "tienda.pedidos.confirmar", RECHAZADO: "tienda.pedidos.rechazar", EN_CAMINO: "tienda.pedidos.despachar",
  ENTREGADO: "tienda.pedidos.despachar", CANCELADO: "tienda.pedidos.rechazar",
};

export async function moverPedidoTienda(id: string, hacia: Estado, nota: string, fechaEstimada?: string): Promise<R> {
  try {
    const clave = PERMISO[hacia];
    if (!clave) throw new Error("•Acción inválida.");
    const t = await exigirTienda(clave);
    const p = await prisma.pedido.findUnique({ where: { id }, select: { tiendaId: true } });
    if (!p || p.tiendaId !== t.org.id) throw new Error("•El pedido no existe.");
    const extra = hacia === "CONFIRMADO" && fechaEstimada && /^\d{4}-\d{2}-\d{2}$/.test(fechaEstimada) ? { fechaEstimada: new Date(`${fechaEstimada}T00:00:00Z`) } : undefined;
    const error = await transicionarPedido({ pedidoId: id, hacia, rol: "VENDEDOR", actorId: t.usuarioId, nota: nota.trim() || null, extra });
    if (error) throw new Error(`•${error}`);
    revalidatePath(`/vendedor/pedidos/${id}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function responderResena(resenaId: string, texto: string): Promise<R> {
  try {
    const t = await exigirTienda("tienda.resenas.responder");
    const r = await prisma.resena.findUnique({ where: { id: resenaId }, include: { pedido: { select: { id: true, numero: true, organizacionId: true, tiendaId: true, compradorId: true } } } });
    if (!r || r.tiendaId !== t.org.id) throw new Error("•La reseña no existe.");
    const txt = texto.trim().slice(0, 1000);
    if (txt.length < 3) throw new Error("•Escribí la respuesta.");
    await prisma.resena.update({ where: { id: resenaId }, data: { respuesta: txt } });
    await avisar(r.pedido, "COMPRADOR", `${t.org.farmName} respondió tu reseña`, txt.slice(0, 200)).catch(() => {});
    revalidatePath(`/vendedor/pedidos/${r.pedido.id}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}
