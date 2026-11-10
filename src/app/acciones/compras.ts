"use server";
// Compras en el Mercado del lado del productor (Fase 13): cotizaciones, pedidos, aprobación,
// recepción (entra a Stock y a Finanzas en una sola transacción) y reseña.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { invalidateInventario } from "@/lib/cache";
import { requirePermiso, puede, ErrorPermiso } from "@/lib/permisos/servidor";
import { ipDe, userAgentDe } from "@/lib/seguridad/auditoria";
import { DEPARTAMENTOS } from "@/lib/validaciones/paraguay";
import { hoyUTC } from "@/lib/finanzas/calculos";
import { requiereAprobacion, subtotalLinea, type ItemRespuesta } from "@/lib/pedidos/reglas";
import { ejecutarRecepcion } from "@/lib/pedidos/recepcion";
import { avisar, conActorYNota, registrarAceptacionMercado, siguienteNumero, terminosMercadoPendientes, tiendasParaCotizar, transicionarPedido } from "@/lib/pedidos/servidor";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string; terminos?: boolean };
const DIA = 86_400_000;
const METODOS = ["TRANSFERENCIA", "EFECTIVO", "CONTRA_ENTREGA", "CREDITO_VENDEDOR"] as const;

function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  if (/mes .*cerrado|cerrado/i.test(msg)) return { ok: false, error: "Ese mes ya está cerrado en Finanzas: recibí con una fecha del mes abierto." };
  console.error("[compras]", e);
  return { ok: false, error: "No se pudo completar. Probá de nuevo." };
}

async function exigirTerminos(userId: string): Promise<{ ok: false; error: string; terminos: true } | null> {
  return (await terminosMercadoPendientes(userId)) ? { ok: false, error: "Antes de pedir o cotizar, aceptá los Términos del Mercado.", terminos: true } : null;
}

export async function aceptarTerminosMercado(): Promise<R> {
  try {
    const { session } = await requirePermiso("compras.cotizaciones.ver");
    const h = await headers();
    await registrarAceptacionMercado(session.user.id, session.user.tenantId, ipDe(h), userAgentDe(h));
    return { ok: true };
  } catch (e) { return manejar(e); }
}

async function granjaDe(org: string, granjaId: string | null | undefined) {
  if (!granjaId) return null;
  const g = await prisma.granja.findFirst({ where: { id: granjaId, organizacionId: org }, select: { id: true, nombre: true, departamento: true } });
  if (!g) throw new Error("•Esa granja no es de tu organización.");
  return g;
}

// ── Cotización ─────────────────────────────────────────────────────────────
const solicitudSchema = z.object({
  items: z.array(z.object({ productoCatalogoId: z.string().uuid(), cantidadBase: z.coerce.number().positive("Indicá la cantidad"), nota: z.string().trim().max(300).optional() })).min(1, "Agregá al menos un producto").max(30),
  granjaId: z.string().optional().nullable(),
  departamento: z.enum(DEPARTAMENTOS, { errorMap: () => ({ message: "Elegí el departamento de entrega" }) }),
  fechaRequerida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  nota: z.string().trim().max(1000).optional(),
  origen: z.enum(["MANUAL", "MOTOR_NECESIDADES"]).default("MANUAL"),
}).strict();

export async function crearSolicitudCotizacion(datos: z.input<typeof solicitudSchema>): Promise<R<{ id: string; tiendas: number }>> {
  try {
    const { session, permisos } = await requirePermiso("compras.cotizaciones.crear");
    const t = await exigirTerminos(session.user.id); if (t) return t;
    const d = solicitudSchema.parse(datos);
    const org = permisos.organizacionId;
    await granjaDe(org, d.granjaId);
    const ids = Array.from(new Set(d.items.map(i => i.productoCatalogoId)));
    const productos = await prisma.productoCatalogo.count({ where: { id: { in: ids }, aprobado: true } });
    if (productos !== ids.length) throw new Error("•Algún producto no está en el catálogo.");
    const tiendas = await tiendasParaCotizar(ids, d.departamento, org);
    if (!tiendas.length) throw new Error(`•Todavía no hay tiendas verificadas que entreguen esos productos en ${d.departamento}. Probá con otro departamento o pedí directo desde el Mercado.`);
    const s = await prisma.solicitudCotizacion.create({
      data: {
        compradorId: session.user.id, organizacionId: org, granjaDestinoId: d.granjaId || null, departamento: d.departamento,
        fechaRequerida: d.fechaRequerida ? new Date(`${d.fechaRequerida}T00:00:00Z`) : null, origen: d.origen, nota: d.nota || null,
        venceEn: new Date(Date.now() + 7 * DIA),
        items: { create: d.items.map(i => ({ productoCatalogoId: i.productoCatalogoId, cantidadBase: i.cantidadBase, nota: i.nota || null })) },
        tiendas: { create: tiendas.map(tiendaId => ({ tiendaId })) },
      },
    });
    const miembros = await prisma.miembro.findMany({
      where: { organizacionId: { in: tiendas }, estado: "ACTIVO", OR: [{ esPropietario: true }, { rol: { permisos: { some: { permisoClave: "tienda.cotizaciones.responder" } } } }] },
      select: { userId: true, organizacionId: true },
    });
    if (miembros.length) await prisma.notificacion.createMany({
      data: miembros.map(m => ({ userId: m.userId, organizacionId: m.organizacionId, tipo: "COTIZACION", titulo: `Pedido de cotización para ${d.departamento}`, cuerpo: `${d.items.length} producto${d.items.length > 1 ? "s" : ""}. Respondé antes de 7 días.`, enlace: `/vendedor/cotizaciones/${s.id}` })),
    });
    revalidatePath("/compras");
    return { ok: true, id: s.id, tiendas: tiendas.length };
  } catch (e) { return manejar(e); }
}

export async function cancelarSolicitud(id: string): Promise<R> {
  try {
    const { permisos } = await requirePermiso("compras.cotizaciones.crear");
    const r = await prisma.solicitudCotizacion.updateMany({ where: { id, organizacionId: permisos.organizacionId, estado: "ABIERTA" }, data: { estado: "CANCELADA" } });
    if (!r.count) throw new Error("•La solicitud ya no está abierta.");
    revalidatePath(`/compras/cotizaciones/${id}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Crear pedido (directo o desde una cotización) ──────────────────────────
type Linea = { publicacionId: string | null; productoCatalogoId: string | null; descripcion: string; unidadVenta: string; unidadBase: string; cantidad: number; contenidoBase: number; precioUnitarioGs: bigint };

async function crearPedido(d: { userId: string; org: string; esPropietario: boolean; limite: bigint | null; tiendaId: string; respuestaId?: string; lineas: Linea[]; envioGs: bigint; metodoPago: typeof METODOS[number]; granjaId: string | null; direccion: string | null; notas: string | null; plazoDias: number }) {
  if (d.tiendaId === d.org) throw new Error("•No podés comprarle a tu propia tienda.");
  const subtotal = d.lineas.reduce((s, l) => s + subtotalLinea(l.cantidad, l.precioUnitarioGs), 0n);
  const total = subtotal + d.envioGs;
  const aprobar = requiereAprobacion(total, d.limite, d.esPropietario);
  const estado = aprobar ? "PENDIENTE_APROBACION" : "ENVIADO";
  const pedido = await conActorYNota(d.userId, aprobar ? "Supera el límite de compra: necesita aprobación" : null, async tx => {
    const numero = await siguienteNumero(tx);
    return tx.pedido.create({
      data: {
        numero, compradorId: d.userId, organizacionId: d.org, tiendaId: d.tiendaId, respuestaId: d.respuestaId ?? null, estado,
        subtotalGs: subtotal, envioGs: d.envioGs, totalGs: total, metodoPago: d.metodoPago, granjaDestinoId: d.granjaId, direccion: d.direccion, notas: d.notas,
        fechaEstimada: new Date(hoyUTC().getTime() + d.plazoDias * DIA),
        items: { create: d.lineas.map(l => ({ publicacionId: l.publicacionId, productoCatalogoId: l.productoCatalogoId, descripcion: l.descripcion, unidadVenta: l.unidadVenta, unidadBase: l.unidadBase, cantidad: l.cantidad, contenidoBase: l.contenidoBase, precioUnitarioGs: l.precioUnitarioGs, subtotalGs: subtotalLinea(l.cantidad, l.precioUnitarioGs) })) },
      },
      select: { id: true, numero: true, organizacionId: true, tiendaId: true, compradorId: true },
    });
  });
  await (aprobar
    ? avisar(pedido, "APROBADOR", `El pedido ${pedido.numero} espera tu aprobación`, `Total Gs ${Number(total).toLocaleString("es-PY")}`)
    : avisar(pedido, "VENDEDOR", `Pedido nuevo ${pedido.numero}`, `Total Gs ${Number(total).toLocaleString("es-PY")}`)).catch(e => console.error("[pedido aviso]", e));
  return { pedido, aprobar };
}

const directoSchema = z.object({
  publicacionId: z.string().uuid(),
  cantidad: z.coerce.number().int("Pedí unidades enteras").positive(),
  metodoPago: z.enum(METODOS),
  granjaId: z.string().optional().nullable(),
  direccion: z.string().trim().max(300).optional(),
  notas: z.string().trim().max(1000).optional(),
}).strict();

export async function pedirDirecto(datos: z.input<typeof directoSchema>): Promise<R<{ id: string; aprobar: boolean }>> {
  try {
    const { session, permisos } = await requirePermiso("compras.pedidos.crear");
    const t = await exigirTerminos(session.user.id); if (t) return t;
    const d = directoSchema.parse(datos);
    const p = await prisma.publicacion.findUnique({ where: { id: d.publicacionId }, include: { tienda: { include: { organizacion: { select: { estado: true, verificacion: true } } } } } });
    if (!p || p.estado !== "ACTIVA" || p.tienda.organizacion.estado !== "ACTIVA" || p.tienda.organizacion.verificacion === "RECHAZADA") throw new Error("•Esa publicación ya no está disponible.");
    if (d.cantidad < p.pedidoMinimo) throw new Error(`•El pedido mínimo es ${p.pedidoMinimo}.`);
    if (p.stockDisponible !== null && d.cantidad > p.stockDisponible) throw new Error(`•La tienda tiene ${p.stockDisponible} disponibles.`);
    const granja = await granjaDe(permisos.organizacionId, d.granjaId);
    const { pedido, aprobar } = await crearPedido({
      userId: session.user.id, org: permisos.organizacionId, esPropietario: permisos.esPropietario, limite: permisos.limiteCompraGs,
      tiendaId: p.tiendaId, lineas: [{ publicacionId: p.id, productoCatalogoId: p.productoCatalogoId, descripcion: `${p.titulo} · ${p.unidadVenta}`, unidadVenta: p.unidadVenta, unidadBase: p.unidadBase, cantidad: d.cantidad, contenidoBase: Number(p.contenidoBase), precioUnitarioGs: p.precioGs }],
      envioGs: 0n, metodoPago: d.metodoPago, granjaId: granja?.id ?? null, direccion: d.direccion || null, notas: d.notas || null, plazoDias: p.plazoEntregaDias,
    });
    revalidatePath("/compras");
    return { ok: true, id: pedido.id, aprobar };
  } catch (e) { return manejar(e); }
}

export async function aceptarRespuesta(respuestaId: string, metodoPago: string, direccion: string): Promise<R<{ id: string; aprobar: boolean }>> {
  try {
    const { session, permisos } = await requirePermiso("compras.pedidos.crear");
    const t = await exigirTerminos(session.user.id); if (t) return t;
    const metodo = z.enum(METODOS).parse(metodoPago);
    const r = await prisma.respuestaCotizacion.findUnique({ where: { id: respuestaId }, include: { solicitud: { include: { items: { include: { producto: true } } } }, pedidos: { select: { id: true } } } });
    if (!r || r.solicitud.organizacionId !== permisos.organizacionId) throw new Error("•La cotización no existe.");
    if (r.solicitud.estado !== "ABIERTA") throw new Error("•Esta solicitud ya está cerrada.");
    if (r.pedidos.length) throw new Error("•Ya hiciste un pedido con esta cotización.");
    if (r.validaHasta.getTime() < hoyUTC().getTime()) throw new Error("•La cotización venció. Pedile a la tienda que la renueve.");
    const items = r.items as unknown as ItemRespuesta[];
    const lineas: Linea[] = items.filter(i => i.cantidad > 0).map(i => {
      const it = r.solicitud.items.find(x => x.id === i.itemId);
      return { publicacionId: i.publicacionId ?? null, productoCatalogoId: it?.productoCatalogoId ?? null, descripcion: i.descripcion, unidadVenta: i.unidadVenta, unidadBase: it?.producto.unidadBase ?? "UNIDAD", cantidad: i.cantidad, contenidoBase: i.contenidoBase, precioUnitarioGs: BigInt(Math.round(i.precioUnitarioGs)) };
    });
    if (!lineas.length) throw new Error("•La cotización no tiene productos.");
    const { pedido, aprobar } = await crearPedido({
      userId: session.user.id, org: permisos.organizacionId, esPropietario: permisos.esPropietario, limite: permisos.limiteCompraGs,
      tiendaId: r.tiendaId, respuestaId: r.id, lineas, envioGs: r.costoEnvioGs, metodoPago: metodo, granjaId: r.solicitud.granjaDestinoId,
      direccion: direccion.trim().slice(0, 300) || null, notas: r.solicitud.nota, plazoDias: r.plazoDias,
    });
    await prisma.solicitudCotizacion.update({ where: { id: r.solicitudId }, data: { estado: "CERRADA" } });
    revalidatePath("/compras");
    return { ok: true, id: pedido.id, aprobar };
  } catch (e) { return manejar(e); }
}

// ── Aprobación y cancelación ───────────────────────────────────────────────
async function pedidoDeMiOrg(id: string, org: string) {
  const p = await prisma.pedido.findUnique({ where: { id }, select: { id: true, organizacionId: true, compradorId: true, estado: true, totalGs: true } });
  if (!p || p.organizacionId !== org) throw new Error("•El pedido no existe.");
  return p;
}

export async function aprobarPedido(id: string, aprobar: boolean, nota: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("compras.pedidos.aprobar");
    const p = await pedidoDeMiOrg(id, permisos.organizacionId);
    if (p.compradorId === session.user.id && !permisos.esPropietario) throw new Error("•No podés aprobar tu propio pedido.");
    const error = await transicionarPedido({ pedidoId: p.id, hacia: aprobar ? "ENVIADO" : "BORRADOR", rol: "APROBADOR", actorId: session.user.id, nota: nota || (aprobar ? "Aprobado" : null), extra: aprobar ? { aprobadoPor: session.user.id } : undefined });
    if (error) throw new Error(`•${error}`);
    revalidatePath(`/compras/pedidos/${id}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

/** Reenvía un borrador (por ejemplo, después de que no se aprobó). Vuelve a mirar el límite. */
export async function enviarBorrador(id: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("compras.pedidos.crear");
    const p = await pedidoDeMiOrg(id, permisos.organizacionId);
    const hacia = requiereAprobacion(p.totalGs, permisos.limiteCompraGs, permisos.esPropietario) ? "PENDIENTE_APROBACION" : "ENVIADO";
    const error = await transicionarPedido({ pedidoId: p.id, hacia, rol: "COMPRADOR", actorId: session.user.id });
    if (error) throw new Error(`•${error}`);
    revalidatePath(`/compras/pedidos/${id}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function cancelarPedido(id: string, motivo: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("compras.pedidos.cancelar");
    const p = await pedidoDeMiOrg(id, permisos.organizacionId);
    const error = await transicionarPedido({ pedidoId: p.id, hacia: "CANCELADO", rol: "COMPRADOR", actorId: session.user.id, nota: motivo });
    if (error) throw new Error(`•${error}`);
    revalidatePath(`/compras/pedidos/${id}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Recepción: Stock + Finanzas + RECIBIDO en una transacción (13.4) ──────
const recepcionSchema = z.object({
  pedidoId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  unidadId: z.string().uuid({ message: "Elegí la unidad de negocio" }),
  items: z.array(z.object({
    itemId: z.string().uuid(),
    cantidadRecibida: z.coerce.number().min(0),
    productoInventarioId: z.string().nullable(), // null = no entra a stock (equipos, servicios)
    cantidadStock: z.coerce.number().min(0), // en la unidad del producto de stock
    lote: z.string().trim().max(60).optional(),
    vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  })).min(1),
  pagado: z.boolean(),
  cuentaFondosId: z.string().uuid().optional().nullable(),
  vencimientoPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  facturaNumero: z.string().trim().max(40).optional(),
}).strict();


export async function recibirPedido(datos: z.input<typeof recepcionSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("compras.pedidos.recibir");
    const d = recepcionSchema.parse(datos);
    const org = permisos.organizacionId;
    const unidad = await prisma.unidadNegocio.findFirst({ where: { id: d.unidadId, organizacionId: org, activa: true }, select: { id: true } });
    if (!unidad || !puede(permisos, "compras.pedidos.recibir", { unidadId: unidad.id })) throw new Error("•No podés cargar en esa unidad de negocio.");
    if (d.pagado && !puede(permisos, "finanzas.pagar.registrar_pago")) throw new Error("•No tenés permiso para registrar pagos: dejalo como pendiente (va a Cuentas por pagar).");
    const { nota, pedido } = await ejecutarRecepcion(org, session.user.id, { ...d, vencimientoPago: d.vencimientoPago || undefined, items: d.items.map(i => ({ ...i, vencimiento: i.vencimiento || undefined })) });
    invalidateInventario(org);
    await avisar(pedido, "VENDEDOR", `El comprador recibió el pedido ${pedido.numero}`, nota).catch(() => {});
    revalidatePath(`/compras/pedidos/${pedido.id}`);
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Reseña ─────────────────────────────────────────────────────────────────
export async function dejarResena(pedidoId: string, calificacion: number, comentario: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("compras.pedidos.ver");
    const p = await pedidoDeMiOrg(pedidoId, permisos.organizacionId);
    if (p.estado !== "RECIBIDO") throw new Error("•Podés calificar a la tienda cuando recibas el pedido.");
    const c = Math.round(Number(calificacion));
    if (!(c >= 1 && c <= 5)) throw new Error("•Elegí de 1 a 5 estrellas.");
    if (await prisma.resena.findUnique({ where: { pedidoId }, select: { id: true } })) throw new Error("•Ya calificaste este pedido.");
    const ped = await prisma.pedido.findUnique({ where: { id: pedidoId }, select: { tiendaId: true, numero: true, organizacionId: true, compradorId: true, id: true } });
    await prisma.resena.create({ data: { pedidoId, tiendaId: ped!.tiendaId, autorId: session.user.id, calificacion: c, comentario: comentario.trim().slice(0, 1000) || null } });
    await avisar(ped!, "VENDEDOR", `Nueva reseña de ${c} estrella${c > 1 ? "s" : ""} (pedido ${ped!.numero})`, comentario.trim().slice(0, 200) || undefined).catch(() => {});
    revalidatePath(`/compras/pedidos/${pedidoId}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}
