"use server";
// Buzón (Fase 15.2): problemas, dudas, ideas y funciones nuevas desde cualquier pantalla.
// La base es la fuente de verdad; el correo solo avisa. Cualquier persona con sesión puede mandar;
// solo el equipo de plataforma (TOTAL o SOPORTE) lo lee y gestiona.
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { getSession, getUsuario } from "@/lib/auth/config";
import { getAdmin } from "@/lib/admin/acceso";
import { consumirIntento } from "@/lib/seguridad/limites";
import { registrarAuditoria, ipDe, userAgentDe } from "@/lib/seguridad/auditoria";
import { esModulo, etiquetaModulo, moduloDeRuta } from "@/lib/modulos";
import { CORREO_SOPORTE } from "@/lib/contacto";
import { enviarAviso, SITIO } from "@/lib/correo/enviar";
import { demanda } from "@/lib/buzon/datos";

type R = { ok: true } | { ok: false; error: string };
const TIPOS = ["CONSULTA", "SUGERENCIA", "PROBLEMA", "FUNCION_NUEVA"] as const;
const ESTADOS = ["NUEVA", "EN_REVISION", "EN_DESARROLLO", "HECHA", "DESCARTADA"] as const;
const ESTADO_CLIENTE: Record<string, string> = { NUEVA: "Recibida", EN_REVISION: "La estamos viendo", EN_DESARROLLO: "La estamos haciendo", HECHA: "Hecha", DESCARTADA: "No la vamos a hacer por ahora" };

const esquema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.enum(["CONSULTA", "SUGERENCIA", "PROBLEMA"]),
    mensaje: z.string().trim().min(3, "Contanos un poco más.").max(4000, "Máximo 4.000 caracteres."),
    pagina: z.string().max(300).optional(), modulo: z.string().optional(),
  }),
  z.object({
    tipo: z.literal("FUNCION_NUEVA"),
    titulo: z.string().trim().min(5, "Poné un título de al menos 5 letras.").max(80, "El título va hasta 80 caracteres."),
    problema: z.string().trim().min(10, "Contanos qué problema te resuelve (al menos 10 letras).").max(1500, "Máximo 1.500 caracteres."),
    comoFuncionaria: z.string().trim().min(10, "Contanos cómo querés que funcione (al menos 10 letras).").max(1500, "Máximo 1.500 caracteres."),
    pagina: z.string().max(300).optional(), modulo: z.string().optional(),
  }),
]);

export async function enviarSugerencia(datos: {
  tipo: string; mensaje?: string; pagina?: string; modulo?: string; titulo?: string; problema?: string; comoFuncionaria?: string;
}): Promise<R> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Iniciá sesión para enviarla." };
  const p = esquema.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
  const session = await getSession().catch(() => null);
  if (session?.modoPlataforma) return { ok: false, error: "En modo plataforma no se puede enviar." };
  if (!(await consumirIntento("sugerencias", usuario.id))) return { ok: false, error: `Ya mandaste muchas hoy. Escribinos a ${CORREO_SOPORTE}.` };
  const d = p.data;
  const pagina = d.pagina?.slice(0, 300) || null;
  const modulo = esModulo(d.modulo) ? d.modulo : moduloDeRuta(pagina);
  const organizacionId = session?.user.tenantId ?? null;
  const fila = await prisma.sugerencia.create({
    data: d.tipo === "FUNCION_NUEVA"
      ? { usuarioId: usuario.id, organizacionId, tipo: d.tipo, pagina, modulo, titulo: d.titulo, problema: d.problema, comoFuncionaria: d.comoFuncionaria,
          mensaje: `${d.titulo}\n\nProblema: ${d.problema}\n\nCómo debería funcionar: ${d.comoFuncionaria}`.slice(0, 4000) }
      : { usuarioId: usuario.id, organizacionId, tipo: d.tipo, pagina, modulo, mensaje: d.mensaje },
    select: { id: true },
  });
  // Solo los problemas avisan al momento; el resto va en el resumen diario. El correo no lleva el texto del cliente.
  if (d.tipo === "PROBLEMA") {
    const org = organizacionId ? (await prisma.tenant.findUnique({ where: { id: organizacionId }, select: { farmName: true } }))?.farmName : null;
    after(async () => {
      await enviarAviso({
        para: CORREO_SOPORTE,
        asunto: `Buzón: problema en ${etiquetaModulo(modulo)}`,
        texto: `Llegó un problema al buzón.\n\nMódulo: ${etiquetaModulo(modulo)}\nOrganización: ${org ?? "sin organización"}\n\nVerlo: ${SITIO}/admin/buzon?estado=NUEVA&id=${fila.id}\n`,
      });
    });
  }
  return { ok: true };
}

/* ─── Gestión (Super Administrador) ─────────────────────────────────── */

async function adminBuzon() {
  const a = await getAdmin();
  if (!a || !a.verificado || !["TOTAL", "SOPORTE"].includes(a.nivel)) return null;
  return a;
}
async function auditar(adminId: string, id: string, detalle: Record<string, string | boolean | null | string[]>) {
  const h = await headers();
  await registrarAuditoria("BUZON_GESTIONADO", "sugerencia", id, detalle, { actorId: adminId, actorEsPlataforma: true, ip: ipDe(h), userAgent: userAgentDe(h) });
}
function refrescar() { revalidatePath("/admin/buzon"); revalidatePath("/admin/buzon/hoja-de-ruta"); revalidatePath("/cuenta/hoja-de-ruta"); }

const cambio = z.object({
  id: z.string().uuid(),
  estado: z.enum(ESTADOS).optional(),
  respuesta: z.string().trim().max(4000).optional(),
  tipo: z.enum(TIPOS).optional(),
  modulo: z.string().refine(esModulo, "Módulo inválido").optional(),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA", ""]).optional(),
});

export async function actualizarSugerencia(datos: z.input<typeof cambio>): Promise<R> {
  const a = await adminBuzon();
  if (!a) return { ok: false, error: "Sin permiso." };
  const p = cambio.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
  const antes = await prisma.sugerencia.findUnique({ where: { id: p.data.id } });
  if (!antes) return { ok: false, error: "No existe." };
  const d = p.data;
  if (d.tipo === "FUNCION_NUEVA" && antes.tipo !== "FUNCION_NUEVA" && !antes.titulo)
    return { ok: false, error: "Para pasarla a «Función nueva» abrí el detalle: necesita título, problema y cómo funcionaría." };
  const data = {
    ...(d.estado ? { estado: d.estado } : {}),
    ...(d.respuesta !== undefined ? { respuesta: d.respuesta || null } : {}),
    ...(d.tipo ? { tipo: d.tipo } : {}),
    ...(d.modulo ? { modulo: d.modulo } : {}),
    ...(d.prioridad !== undefined ? { prioridad: d.prioridad || null } : {}),
  };
  await prisma.sugerencia.update({ where: { id: d.id }, data });
  const cambioEstado = !!d.estado && d.estado !== antes.estado;
  const cambioRespuesta = d.respuesta !== undefined && (d.respuesta || null) !== antes.respuesta && !!d.respuesta;
  if (cambioEstado || cambioRespuesta) {
    await prisma.notificacion.create({ data: {
      userId: antes.usuarioId, organizacionId: antes.organizacionId, tipo: "BUZON",
      titulo: "Respondimos tu mensaje",
      cuerpo: cambioRespuesta ? "Tenés una respuesta en «Ayuda y sugerencias»." : `Tu mensaje ahora está: ${ESTADO_CLIENTE[d.estado!]}.`,
      enlace: "?ayuda=1",
    } });
  }
  await auditar(a.usuario.id, d.id, { cambios: Object.keys(data), estado: d.estado ?? null });
  refrescar();
  return { ok: true };
}

const publicar = z.object({
  id: z.string().uuid(),
  publica: z.boolean(),
  tituloPublico: z.string().trim().max(80).optional(),
  descripcionPublica: z.string().trim().max(600).optional(),
});

/** Publica (o retira) un mensaje en la hoja de ruta con texto reescrito. Nunca se muestra el original. */
export async function publicarEnHojaDeRuta(datos: z.input<typeof publicar>): Promise<R> {
  const a = await adminBuzon();
  if (!a) return { ok: false, error: "Sin permiso." };
  const p = publicar.safeParse(datos);
  if (!p.success) return { ok: false, error: "Datos inválidos" };
  const d = p.data;
  if (d.publica && ((d.tituloPublico ?? "").length < 5 || (d.descripcionPublica ?? "").length < 10))
    return { ok: false, error: "Escribí un título (5+ letras) y una descripción (10+ letras) para los clientes." };
  const s = await prisma.sugerencia.findUnique({ where: { id: d.id }, select: { agrupadaEn: true } });
  if (!s) return { ok: false, error: "No existe." };
  if (d.publica && s.agrupadaEn) return { ok: false, error: "Está agrupada en otro mensaje: publicá el principal." };
  await prisma.sugerencia.update({ where: { id: d.id }, data: d.publica
    ? { publica: true, tituloPublico: d.tituloPublico, descripcionPublica: d.descripcionPublica }
    : { publica: false } });
  await auditar(a.usuario.id, d.id, { publica: d.publica });
  refrescar();
  return { ok: true };
}

/** Agrupa un mensaje en otro (los pedidos se suman y la hoja de ruta muestra uno solo). destinoId null = desagrupar. */
export async function agruparSugerencia(id: string, destinoId: string | null): Promise<R> {
  const a = await adminBuzon();
  if (!a) return { ok: false, error: "Sin permiso." };
  if (!z.string().uuid().safeParse(id).success || (destinoId !== null && !z.string().uuid().safeParse(destinoId).success)) return { ok: false, error: "Datos inválidos" };
  if (destinoId === id) return { ok: false, error: "No se puede agrupar consigo mismo." };
  let raiz: string | null = null;
  if (destinoId) {
    const destino = await prisma.sugerencia.findUnique({ where: { id: destinoId }, select: { id: true, agrupadaEn: true } });
    if (!destino) return { ok: false, error: "No existe el mensaje principal." };
    raiz = destino.agrupadaEn ?? destino.id; // siempre a la raíz: un solo nivel
    if (raiz === id) return { ok: false, error: "Ese mensaje ya está agrupado en este." };
  }
  await prisma.$transaction(async tx => {
    if (raiz) {
      await tx.sugerencia.updateMany({ where: { agrupadaEn: id }, data: { agrupadaEn: raiz } }); // los que colgaban de este pasan a la raíz
      // Los votos que tenía este mensaje pasan a la raíz (sin duplicar)
      await tx.$executeRaw`insert into public.sugerencia_voto (sugerencia_id, usuario_id, organizacion_id, created_at)
        select ${raiz}::uuid, usuario_id, organizacion_id, created_at from public.sugerencia_voto where sugerencia_id = ${id}::uuid
        on conflict do nothing`;
      await tx.sugerenciaVoto.deleteMany({ where: { sugerenciaId: id } });
    }
    await tx.sugerencia.update({ where: { id }, data: { agrupadaEn: raiz, ...(raiz ? { publica: false } : {}) } });
  });
  await auditar(a.usuario.id, id, { agrupadaEn: raiz });
  refrescar();
  return { ok: true };
}

/* ─── Cliente ───────────────────────────────────────────────────────── */

/** Lo que mandó la persona y lo que le respondimos (para que vea que se tuvo en cuenta). */
export async function misSugerencias() {
  const usuario = await getUsuario();
  if (!usuario) return [];
  const filas = await prisma.sugerencia.findMany({
    where: { usuarioId: usuario.id }, orderBy: { createdAt: "desc" }, take: 10,
    select: { id: true, tipo: true, mensaje: true, titulo: true, modulo: true, estado: true, respuesta: true, createdAt: true },
  });
  return filas.map(f => ({ ...f, createdAt: f.createdAt.toISOString() }));
}

/** Respuestas del buzón sin leer (punto en la pestaña de Ayuda). */
export async function avisosBuzon(): Promise<number> {
  const usuario = await getUsuario();
  if (!usuario) return 0;
  return prisma.notificacion.count({ where: { userId: usuario.id, tipo: "BUZON", leida: false } });
}
export async function marcarAvisosBuzonLeidos(): Promise<void> {
  const usuario = await getUsuario();
  if (!usuario) return;
  await prisma.notificacion.updateMany({ where: { userId: usuario.id, tipo: "BUZON", leida: false }, data: { leida: true } });
}

/** «Yo también la quiero»: alterna el voto de la persona en una función publicada. */
export async function votarFuncion(id: string): Promise<R & { votado?: boolean }> {
  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Iniciá sesión para votar." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Datos inválidos" };
  const session = await getSession().catch(() => null);
  if (session?.modoPlataforma) return { ok: false, error: "En modo plataforma no se puede votar." };
  const s = await prisma.sugerencia.findFirst({ where: { id, publica: true, agrupadaEn: null, estado: { not: "DESCARTADA" } }, select: { id: true } });
  if (!s) return { ok: false, error: "Esa función ya no está en la hoja de ruta." };
  const clave = { sugerenciaId_usuarioId: { sugerenciaId: id, usuarioId: usuario.id } };
  const ya = await prisma.sugerenciaVoto.findUnique({ where: clave });
  if (ya) await prisma.sugerenciaVoto.delete({ where: clave });
  else await prisma.sugerenciaVoto.create({ data: { sugerenciaId: id, usuarioId: usuario.id, organizacionId: session?.user.tenantId ?? null } });
  revalidatePath("/cuenta/hoja-de-ruta");
  return { ok: true, votado: !ya };
}

/** Hoja de ruta pública: solo texto reescrito, estado y pedidos. Nunca el mensaje, el autor ni la organización. */
export async function hojaDeRuta() {
  const usuario = await getUsuario();
  const filas = await prisma.sugerencia.findMany({
    where: { publica: true, agrupadaEn: null, estado: { not: "DESCARTADA" } },
    select: { id: true, tituloPublico: true, descripcionPublica: true, estado: true, modulo: true },
    orderBy: { updatedAt: "desc" },
  });
  const [n, mios] = await Promise.all([
    demanda(filas.map(f => f.id)),
    usuario ? prisma.sugerenciaVoto.findMany({ where: { usuarioId: usuario.id, sugerenciaId: { in: filas.map(f => f.id) } }, select: { sugerenciaId: true } }) : [],
  ]);
  const votadas = new Set(mios.map(m => m.sugerenciaId));
  return filas.map(f => ({
    id: f.id, titulo: f.tituloPublico ?? "", descripcion: f.descripcionPublica ?? "", estado: f.estado,
    modulo: etiquetaModulo(f.modulo), votos: n.get(f.id) ?? 0, votada: votadas.has(f.id),
  }));
}

