// Fase 13 · Pedidos y cotizaciones del lado del servidor. Una sola función mueve el estado de un pedido
// (transicionarPedido): valida actor y permiso, deja la nota para el evento (que escribe el trigger)
// y avisa a la otra parte.
import "server-only";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { documentoVigente } from "@/lib/legal/documentos";
import { NOMBRE_ESTADO, validarTransicion, type Estado, type Rol } from "./reglas";

export const TEXTO_CASILLA_MERCADO = "Acepto los Términos del Mercado KurPorc.";

/** Términos del Mercado vigentes que la persona todavía no aceptó (null si no hay nada pendiente). */
export async function terminosMercadoPendientes(userId: string) {
  const doc = await documentoVigente("TERMINOS_MERCADO");
  if (!doc) return null;
  const ya = await prisma.aceptacionDocumento.findFirst({ where: { userId, documentoId: doc.id, aceptado: true }, select: { id: true } });
  if (ya) return null;
  if (!doc.requiereReaceptacion && (await prisma.aceptacionDocumento.findFirst({ where: { userId, codigo: "TERMINOS_MERCADO", aceptado: true }, select: { id: true } }))) return null;
  return doc;
}

export async function registrarAceptacionMercado(userId: string, organizacionId: string, ip: string | null, userAgent: string | null) {
  const doc = await terminosMercadoPendientes(userId);
  if (!doc) return;
  await prisma.aceptacionDocumento.create({
    data: { userId, organizacionId, documentoId: doc.id, codigo: doc.codigo, version: doc.version, hashSha256: doc.hashMostrado, aceptado: true, textoCasilla: TEXTO_CASILLA_MERCADO, ip, userAgent, metodo: "CASILLA" },
  });
}

/** Personas a avisar de cada lado. */
async function destinatarios(pedido: { organizacionId: string; tiendaId: string; compradorId: string }, lado: "COMPRADOR" | "VENDEDOR" | "APROBADOR") {
  if (lado === "COMPRADOR") return [pedido.compradorId];
  const org = lado === "VENDEDOR" ? pedido.tiendaId : pedido.organizacionId;
  const clave = lado === "VENDEDOR" ? "tienda.pedidos.ver" : "compras.pedidos.aprobar";
  const ms = await prisma.miembro.findMany({
    where: { organizacionId: org, estado: "ACTIVO", OR: [{ esPropietario: true }, { rol: { permisos: { some: { permisoClave: clave } } } }] },
    select: { userId: true },
  });
  return Array.from(new Set(ms.map(m => m.userId)));
}

export async function avisar(pedido: { id: string; numero: string; organizacionId: string; tiendaId: string; compradorId: string }, lado: "COMPRADOR" | "VENDEDOR" | "APROBADOR", titulo: string, cuerpo?: string) {
  const ids = await destinatarios(pedido, lado);
  if (!ids.length) return;
  const enlace = lado === "VENDEDOR" ? `/vendedor/pedidos/${pedido.id}` : `/compras/pedidos/${pedido.id}`;
  await prisma.notificacion.createMany({
    data: ids.map(userId => ({ userId, organizacionId: lado === "VENDEDOR" ? pedido.tiendaId : pedido.organizacionId, tipo: "PEDIDO", titulo, cuerpo: cuerpo ?? null, enlace })),
  });
}

/** Dentro de una transacción con actor: fija la nota que el trigger guarda en pedido_evento. */
export async function fijarNota(tx: Prisma.TransactionClient, nota: string | null | undefined) {
  await tx.$executeRaw`select set_config('app.nota', ${(nota ?? "").slice(0, 1000)}, true)`;
}

export async function conActorYNota<T>(actorId: string, nota: string | null | undefined, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`select set_config('app.actor_id', ${actorId}, true)`;
    await fijarNota(tx, nota);
    return fn(tx);
  }, { timeout: 20_000 });
}

const AVISO: Partial<Record<Estado, { lado: "COMPRADOR" | "VENDEDOR" | "APROBADOR"; titulo: (n: string) => string }>> = {
  ENVIADO: { lado: "VENDEDOR", titulo: n => `Pedido nuevo ${n}` },
  PENDIENTE_APROBACION: { lado: "APROBADOR", titulo: n => `El pedido ${n} espera tu aprobación` },
  BORRADOR: { lado: "COMPRADOR", titulo: n => `No se aprobó el pedido ${n}` },
  CONFIRMADO: { lado: "COMPRADOR", titulo: n => `La tienda confirmó tu pedido ${n}` },
  RECHAZADO: { lado: "COMPRADOR", titulo: n => `La tienda rechazó tu pedido ${n}` },
  EN_CAMINO: { lado: "COMPRADOR", titulo: n => `Tu pedido ${n} está en camino` },
  ENTREGADO: { lado: "COMPRADOR", titulo: n => `La tienda marcó tu pedido ${n} como entregado` },
  RECIBIDO: { lado: "VENDEDOR", titulo: n => `El comprador recibió el pedido ${n}` },
};

/**
 * Mueve el estado de un pedido. `extra` son otros campos que cambian junto con el estado
 * (fecha estimada, aprobador…). Devuelve null o el motivo por el que no se pudo.
 */
export async function transicionarPedido(d: { pedidoId: string; hacia: Estado; rol: Rol; actorId: string; nota?: string | null; extra?: Prisma.PedidoUpdateInput; enTx?: (tx: Prisma.TransactionClient) => Promise<void> }): Promise<string | null> {
  const p = await prisma.pedido.findUnique({ where: { id: d.pedidoId }, select: { id: true, numero: true, estado: true, organizacionId: true, tiendaId: true, compradorId: true } });
  if (!p) return "El pedido no existe.";
  const error = validarTransicion(p.estado as Estado, d.hacia, d.rol, d.nota);
  if (error) return error;
  await conActorYNota(d.actorId, d.nota, async tx => {
    if (d.enTx) await d.enTx(tx);
    // Condición sobre el estado leído: si otro lo cambió entretanto, no se pisa
    const r = await tx.pedido.updateMany({ where: { id: p.id, estado: p.estado }, data: { ...(d.extra as Prisma.PedidoUpdateManyMutationInput ?? {}), estado: d.hacia } });
    if (r.count !== 1) throw new Error("•El pedido cambió mientras lo mirabas. Recargá la página.");
  });
  const aviso = d.hacia === "CANCELADO"
    ? { lado: (d.rol === "VENDEDOR" ? "COMPRADOR" : "VENDEDOR") as "COMPRADOR" | "VENDEDOR", titulo: (n: string) => `Se canceló el pedido ${n}` }
    : AVISO[d.hacia];
  if (aviso) await avisar(p, aviso.lado, aviso.titulo(p.numero), d.nota ? `Nota: ${d.nota}` : `Estado: ${NOMBRE_ESTADO[d.hacia]}.`).catch(e => console.error("[pedido aviso]", e));
  return null;
}

export async function siguienteNumero(tx: Prisma.TransactionClient): Promise<string> {
  const r = await tx.$queryRaw<{ n: string }[]>`select public.siguiente_numero_pedido() as n`;
  return r[0].n;
}

/** Tiendas a las que se manda una solicitud: verificadas, activas, que entregan en el departamento y publican esos productos.
 *  Orden: más productos cubiertos, mejor calificación, respuesta más rápida en cotizaciones anteriores. */
export async function tiendasParaCotizar(productoIds: string[], departamento: string, excluirOrg: string, maximo = 10) {
  const filas = await prisma.$queryRaw<{ tienda_id: string; productos: bigint; calificacion: number }[]>`
    select p.tienda_id, count(distinct p.producto_catalogo_id) as productos, ti.calificacion::float as calificacion
    from publicacion p join tienda ti on ti.organizacion_id = p.tienda_id join tenants t on t.id = p.tienda_id
    left join lateral (
      select avg(extract(epoch from rc.created_at - sc.created_at)) as segundos
      from respuesta_cotizacion rc join solicitud_cotizacion sc on sc.id = rc.solicitud_id where rc.tienda_id = p.tienda_id
    ) rapidez on true
    where p.estado = 'ACTIVA' and t.estado = 'ACTIVA' and t.verificacion = 'VERIFICADA' and t.id <> ${excluirOrg}
      and p.producto_catalogo_id::text = any(${productoIds}) and ${departamento} = any(p.zonas_entrega)
    group by p.tienda_id, ti.calificacion, rapidez.segundos
    order by count(distinct p.producto_catalogo_id) desc, ti.calificacion desc, rapidez.segundos asc nulls last, min(p.created_at) asc
    limit ${maximo}`;
  return filas.map(f => f.tienda_id);
}
