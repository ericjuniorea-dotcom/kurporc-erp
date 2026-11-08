"use server";
// Equipo y permisos (Fase 7). Cada acción exige su permiso y respeta las reglas:
// siempre un propietario, nadie da permisos que no tiene, solo el propietario edita a
// quien puede editar permisos, y cada cambio queda en la auditoría con antes y después.
import { createHash, randomBytes, randomInt } from "crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { COOKIE_ORG, getUsuario } from "@/lib/auth/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLAVES_PERMISOS, conVer } from "@/lib/permisos/catalogo";
import { ErrorPermiso, permisosDeMiembro, requirePermiso, type Permisos } from "@/lib/permisos/servidor";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";
import { consumirIntento } from "@/lib/seguridad/limites";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const DOMINIO_GESTIONADAS = "usuarios.kurporc.com";

async function ctx(actorId: string, organizacionId: string) {
  const h = await headers();
  return { actorId, organizacionId, ip: ipDe(h), userAgent: userAgentDe(h) };
}

async function origen() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kurporc.com");
}

function manejar(e: unknown): { ok: false; error: string } {
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  console.error("[equipo]", e);
  return { ok: false, error: e instanceof Error && e.message.startsWith("•") ? e.message.slice(1) : "No se pudo completar. Probá de nuevo." };
}

const ajusteSchema = z.object({ clave: z.string().max(80), efecto: z.enum(["PERMITIR", "DENEGAR"]) }).strict();
const alcanceSchema = {
  rolId: z.string().uuid("Elegí un rol"),
  cargo: z.string().trim().max(80).optional().default(""),
  ajustes: z.array(ajusteSchema).max(300).default([]),
  granjas: z.array(z.string().max(40)).max(200).default([]),     // [] = todas
  unidades: z.array(z.string().uuid()).max(200).default([]),     // [] = todas
  limiteCompraGs: z.string().regex(/^\d{0,13}$/).nullable().default("0"), // null = sin límite (solo propietario)
};

/** Permisos efectivos que tendría la persona con ese rol y esos ajustes. */
async function efectivos(organizacionId: string, rolId: string, ajustes: { clave: string; efecto: string }[]) {
  const rol = await prisma.rol.findFirst({ where: { id: rolId, organizacionId }, select: { permisos: { select: { permisoClave: true } } } });
  if (!rol) throw new Error("•Ese rol no existe en tu organización.");
  const set = new Set(rol.permisos.map(p => p.permisoClave));
  for (const a of ajustes) if (a.efecto === "PERMITIR") set.add(a.clave);
  for (const a of ajustes) if (a.efecto === "DENEGAR") set.delete(a.clave);
  return conVer(set);
}

/** Valida alcance y que el que asigna no dé más de lo que tiene. Devuelve los datos normalizados. */
async function validarAsignacion(actor: Permisos, d: { rolId: string; ajustes: { clave: string; efecto: string }[]; granjas: string[]; unidades: string[]; limiteCompraGs: string | null }) {
  const o = actor.organizacionId;
  for (const a of d.ajustes) if (!CLAVES_PERMISOS.has(a.clave)) throw new Error(`•Permiso desconocido: ${a.clave}`);
  const resultado = await efectivos(o, d.rolId, d.ajustes);
  if (!actor.esPropietario) {
    const sobra = Array.from(resultado).filter(c => !actor.claves.has(c));
    if (sobra.length) throw new Error(`•No podés dar permisos que vos no tenés (${sobra.slice(0, 3).join(", ")}${sobra.length > 3 ? "…" : ""}).`);
    if (d.limiteCompraGs === null) throw new Error("•Solo el Administrador General puede dar compras sin límite.");
  }
  if (d.granjas.length) {
    const n = await prisma.granja.count({ where: { organizacionId: o, id: { in: d.granjas } } });
    if (n !== d.granjas.length) throw new Error("•Alguna granja no es de tu organización.");
  }
  if (d.unidades.length) {
    const n = await prisma.unidadNegocio.count({ where: { organizacionId: o, id: { in: d.unidades } } });
    if (n !== d.unidades.length) throw new Error("•Alguna unidad de negocio no es de tu organización.");
  }
  return resultado;
}

// ── Invitar por correo ───────────────────────────────────────────────
const invitarSchema = z.object({ email: z.string().trim().toLowerCase().email("Correo inválido").max(254), ...alcanceSchema }).strict();

export async function invitarPersona(datos: z.input<typeof invitarSchema>): Promise<R<{ enlace: string; vence: string }>> {
  try {
    const p = invitarSchema.safeParse(datos);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
    const { session, permisos } = await requirePermiso("equipo.miembros.invitar");
    const o = session.user.tenantId;
    const d = p.data;
    if (d.email.endsWith(`@${DOMINIO_GESTIONADAS}`)) return { ok: false, error: "Ese correo no se puede usar" };
    await validarAsignacion(permisos, d);

    const yaMiembro = await prisma.miembro.findFirst({ where: { organizacionId: o, perfil: { email: d.email } } });
    if (yaMiembro) return { ok: false, error: "Esa persona ya es parte de tu equipo." };
    if (!(await consumirIntento("invitaciones", o))) return { ok: false, error: "Llegaste al límite de 30 invitaciones por día." };

    await prisma.invitacion.updateMany({ where: { organizacionId: o, email: d.email, estado: "PENDIENTE" }, data: { estado: "REVOCADA" } });
    const token = randomBytes(32).toString("base64url");
    const vence = new Date(Date.now() + 7 * 86400000);
    const inv = await prisma.invitacion.create({
      data: {
        organizacionId: o, email: d.email, rolId: d.rolId, cargo: d.cargo || null, ajustes: d.ajustes,
        granjas: d.granjas, unidades: d.unidades, limiteCompraGs: d.limiteCompraGs === null ? null : BigInt(d.limiteCompraGs || "0"),
        tokenHash: createHash("sha256").update(token).digest("hex"), expiraEn: vence, invitadoPor: session.user.id,
      },
    });
    await registrarAuditoria("MIEMBRO_INVITADO", "invitacion", inv.id, { email: d.email, rolId: d.rolId, ajustes: d.ajustes.length }, await ctx(session.user.id, o));
    revalidatePath("/equipo");
    return { ok: true, enlace: `${await origen()}/invitacion/${token}`, vence: vence.toISOString() };
  } catch (e) { return manejar(e); }
}

export async function revocarInvitacion(datos: { id: string }): Promise<R> {
  try {
    const { session } = await requirePermiso("equipo.miembros.invitar");
    const r = await prisma.invitacion.updateMany({ where: { id: datos.id, organizacionId: session.user.tenantId, estado: "PENDIENTE" }, data: { estado: "REVOCADA" } });
    if (!r.count) return { ok: false, error: "La invitación ya no está pendiente." };
    revalidatePath("/equipo");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Cuenta gestionada (operario sin correo) ──────────────────────────
const gestionadaSchema = z.object({
  nombre: z.string().trim().min(2, "Escribí el nombre").max(120),
  usuario: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, "Usuario: 3 a 30 letras, números, punto o guion"),
  ...alcanceSchema,
}).strict();

function claveTemporal(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz", nums = "23456789";
  const pick = (s: string) => s[randomInt(s.length)];
  return `${Array.from({ length: 4 }, () => pick(letras)).join("")}-${Array.from({ length: 4 }, () => pick(nums)).join("")}-${Array.from({ length: 4 }, () => pick(letras)).join("")}`;
}

export async function crearCuentaGestionada(datos: z.input<typeof gestionadaSchema>): Promise<R<{ usuario: string; codigo: string; clave: string }>> {
  try {
    const p = gestionadaSchema.safeParse(datos);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
    const { session, permisos } = await requirePermiso("equipo.miembros.crear_gestionada");
    const o = session.user.tenantId;
    const d = p.data;
    await validarAsignacion(permisos, d);
    const org = await prisma.tenant.findUnique({ where: { id: o }, select: { slug: true, codigoUnion: true } });
    if (!org) return { ok: false, error: "Organización no encontrada" };

    const email = `${d.usuario}.${org.slug}@${DOMINIO_GESTIONADAS}`;
    if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "Ese usuario ya existe en tu organización. Elegí otro." };

    const clave = claveTemporal();
    const { data, error } = await createAdminClient().auth.admin.createUser({
      email, password: clave, email_confirm: true, user_metadata: { full_name: d.nombre },
    });
    if (error || !data.user) return { ok: false, error: "No se pudo crear la cuenta. Probá con otro usuario." };

    const perfil = await prisma.user.findUnique({ where: { authUserId: data.user.id }, select: { id: true } });
    if (!perfil) return { ok: false, error: "La cuenta se creó pero no su perfil. Avisá a soporte." };
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`select set_config('app.actor_id', ${session.user.id}, true)`;
      await tx.user.update({
        where: { id: perfil.id },
        data: { name: d.nombre, tipoAcceso: "GESTIONADA", proveedorLogin: "gestionada", debeCambiarClave: true, onboardingCompleto: true, tipoRegistro: "EMPRESA", tenantId: o },
      });
      await crearMiembroTx(tx, o, perfil.id, d, session.user.id);
    });
    await registrarAuditoria("MIEMBRO_INVITADO", "users", perfil.id, { tipo: "cuenta_gestionada", usuario: d.usuario }, await ctx(session.user.id, o));
    revalidatePath("/equipo");
    return { ok: true, usuario: d.usuario, codigo: org.codigoUnion, clave };
  } catch (e) { return manejar(e); }
}

export async function restablecerClaveGestionada(datos: { miembroId: string }): Promise<R<{ clave: string }>> {
  try {
    const { session } = await requirePermiso("equipo.miembros.crear_gestionada");
    const m = await prisma.miembro.findFirst({
      where: { id: datos.miembroId, organizacionId: session.user.tenantId },
      select: { perfil: { select: { id: true, authUserId: true, tipoAcceso: true } } },
    });
    if (!m || m.perfil.tipoAcceso !== "GESTIONADA" || !m.perfil.authUserId) return { ok: false, error: "Solo se puede para usuarios de operario." };
    const clave = claveTemporal();
    const { error } = await createAdminClient().auth.admin.updateUserById(m.perfil.authUserId, { password: clave });
    if (error) return { ok: false, error: "No se pudo cambiar la contraseña." };
    await prisma.user.update({ where: { id: m.perfil.id }, data: { debeCambiarClave: true } });
    await registrarAuditoria("PERMISOS_CAMBIADOS", "users", m.perfil.id, { tipo: "clave_restablecida" }, await ctx(session.user.id, session.user.tenantId));
    return { ok: true, clave };
  } catch (e) { return manejar(e); }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function crearMiembroTx(tx: Tx, organizacionId: string, userId: string,
  d: { rolId: string; cargo?: string; ajustes: { clave: string; efecto: string }[]; granjas: string[]; unidades: string[]; limiteCompraGs: string | null },
  invitadoPor: string | null) {
  const m = await tx.miembro.create({
    data: {
      organizacionId, userId, rolId: d.rolId, cargo: d.cargo || null, invitadoPor,
      alcanceGranjas: d.granjas.length ? "SELECCION" : "TODAS",
      alcanceUnidades: d.unidades.length ? "SELECCION" : "TODAS",
      limiteCompraGs: d.limiteCompraGs === null ? null : BigInt(d.limiteCompraGs || "0"),
    },
  });
  if (d.granjas.length) await tx.miembroGranja.createMany({ data: d.granjas.map(granjaId => ({ miembroId: m.id, granjaId })) });
  if (d.unidades.length) await tx.miembroUnidad.createMany({ data: d.unidades.map(unidadId => ({ miembroId: m.id, unidadId })) });
  if (d.ajustes.length) await tx.miembroPermiso.createMany({ data: d.ajustes.map(a => ({ miembroId: m.id, permisoClave: a.clave, efecto: a.efecto as "PERMITIR" | "DENEGAR" })) });
  return m;
}

// ── Editar, suspender, quitar ────────────────────────────────────────
const editarSchema = z.object({ miembroId: z.string().uuid(), ...alcanceSchema }).strict();

async function miembroEditable(actor: Permisos, actorUserId: string, miembroId: string) {
  const m = await prisma.miembro.findFirst({
    where: { id: miembroId, organizacionId: actor.organizacionId },
    select: { id: true, userId: true, esPropietario: true },
  });
  if (!m) throw new Error("•Esa persona no es parte de tu organización.");
  if (m.esPropietario) throw new Error("•Al Administrador General no se le cambian permisos. Para eso se transfiere la propiedad.");
  if (m.userId === actorUserId) throw new Error("•No podés cambiar tus propios permisos.");
  if (!actor.esPropietario) {
    const otro = await permisosDeMiembro(m.userId, actor.organizacionId);
    if (otro?.claves.has("equipo.permisos.editar")) throw new Error("•Solo el Administrador General puede editar a quien también edita permisos.");
  }
  return m;
}

export async function actualizarMiembro(datos: z.input<typeof editarSchema>): Promise<R> {
  try {
    const p = editarSchema.safeParse(datos);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
    const { session, permisos } = await requirePermiso("equipo.permisos.editar");
    const d = p.data;
    const m = await miembroEditable(permisos, session.user.id, d.miembroId);
    await validarAsignacion(permisos, d);
    const antes = await permisosDeMiembro(m.userId, permisos.organizacionId);

    await prisma.$transaction(async tx => {
      await tx.$executeRaw`select set_config('app.actor_id', ${session.user.id}, true)`;
      await tx.miembroPermiso.deleteMany({ where: { miembroId: m.id } });
      await tx.miembroGranja.deleteMany({ where: { miembroId: m.id } });
      await tx.miembroUnidad.deleteMany({ where: { miembroId: m.id } });
      await tx.miembro.update({
        where: { id: m.id },
        data: {
          rolId: d.rolId, cargo: d.cargo || null,
          alcanceGranjas: d.granjas.length ? "SELECCION" : "TODAS", alcanceUnidades: d.unidades.length ? "SELECCION" : "TODAS",
          limiteCompraGs: d.limiteCompraGs === null ? null : BigInt(d.limiteCompraGs || "0"),
        },
      });
      if (d.granjas.length) await tx.miembroGranja.createMany({ data: d.granjas.map(granjaId => ({ miembroId: m.id, granjaId })) });
      if (d.unidades.length) await tx.miembroUnidad.createMany({ data: d.unidades.map(unidadId => ({ miembroId: m.id, unidadId })) });
      if (d.ajustes.length) await tx.miembroPermiso.createMany({ data: d.ajustes.map(a => ({ miembroId: m.id, permisoClave: a.clave, efecto: a.efecto })) });
    });
    const despues = await permisosDeMiembro(m.userId, permisos.organizacionId);
    const a = new Set(antes?.claves ?? []), b = new Set(despues?.claves ?? []);
    await registrarAuditoria("PERMISOS_CAMBIADOS", "miembro", m.id, {
      agregados: Array.from(b).filter(c => !a.has(c)), quitados: Array.from(a).filter(c => !b.has(c)),
      rolId: d.rolId, granjas: d.granjas, unidades: d.unidades,
    }, await ctx(session.user.id, permisos.organizacionId));
    revalidatePath("/equipo");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function cambiarEstadoMiembro(datos: { miembroId: string; estado: "ACTIVO" | "SUSPENDIDO" }): Promise<R> {
  try {
    if (!["ACTIVO", "SUSPENDIDO"].includes(datos.estado)) return { ok: false, error: "Estado inválido" };
    const { session, permisos } = await requirePermiso("equipo.miembros.suspender");
    const m = await miembroEditable(permisos, session.user.id, datos.miembroId);
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`select set_config('app.actor_id', ${session.user.id}, true)`;
      await tx.miembro.update({ where: { id: m.id }, data: { estado: datos.estado } });
    });
    await registrarAuditoria("MIEMBRO_SUSPENDIDO", "miembro", m.id, { estado: datos.estado }, await ctx(session.user.id, permisos.organizacionId));
    revalidatePath("/equipo");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function quitarMiembro(datos: { miembroId: string }): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("equipo.miembros.quitar");
    const m = await miembroEditable(permisos, session.user.id, datos.miembroId);
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`select set_config('app.actor_id', ${session.user.id}, true)`;
      await tx.miembro.delete({ where: { id: m.id } });
    });
    await registrarAuditoria("MIEMBRO_SUSPENDIDO", "miembro", m.id, { quitado: true, userId: m.userId }, await ctx(session.user.id, permisos.organizacionId));
    revalidatePath("/equipo");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Pedidos para unirse ("Tengo un código de empresa") ───────────────
export async function resolverSolicitud(datos: { id: string; aprobar: boolean; rolId?: string }): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("equipo.solicitudes.aprobar");
    const o = session.user.tenantId;
    const s = await prisma.solicitudUnion.findFirst({ where: { id: datos.id, organizacionId: o, estado: "PENDIENTE" } });
    if (!s) return { ok: false, error: "El pedido ya no está pendiente." };
    if (!datos.aprobar) {
      await prisma.solicitudUnion.update({ where: { id: s.id }, data: { estado: "RECHAZADA" } });
      revalidatePath("/equipo");
      return { ok: true };
    }
    if (!datos.rolId) return { ok: false, error: "Elegí el rol" };
    const d = { rolId: datos.rolId, ajustes: [], granjas: [], unidades: [], limiteCompraGs: "0" as string | null };
    await validarAsignacion(permisos, d);
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`select set_config('app.actor_id', ${session.user.id}, true)`;
      await crearMiembroTx(tx, o, s.userId, d, session.user.id);
      await tx.solicitudUnion.update({ where: { id: s.id }, data: { estado: "APROBADA" } });
      await tx.notificacion.create({ data: { userId: s.userId, organizacionId: o, tipo: "SOLICITUD_APROBADA", titulo: `Ya sos parte de ${session.user.farmName}`, enlace: "/dashboard" } });
    });
    await registrarAuditoria("MIEMBRO_INVITADO", "solicitud_union", s.id, { aprobada: true, rolId: datos.rolId }, await ctx(session.user.id, o));
    revalidatePath("/equipo");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Aceptar una invitación (la persona invitada) ─────────────────────
export async function aceptarInvitacion(datos: { token: string }): Promise<R<{ destino: string }>> {
  try {
    const usuario = await getUsuario();
    if (!usuario) return { ok: false, error: "Ingresá para aceptar la invitación." };
    if (usuario.faltaAceptarContrato) return { ok: false, error: "Primero aceptá los Términos y la Privacidad." };
    const inv = await prisma.invitacion.findUnique({ where: { tokenHash: createHash("sha256").update(String(datos.token)).digest("hex") } });
    if (!inv || inv.estado !== "PENDIENTE" || inv.expiraEn < new Date()) return { ok: false, error: "La invitación no es válida o venció. Pedile otra a quien te invitó." };
    if (inv.email.toLowerCase() !== usuario.email.toLowerCase()) {
      return { ok: false, error: `Esta invitación es para ${inv.email}. Ingresá con ese correo.` };
    }
    const ya = await prisma.miembro.findUnique({ where: { organizacionId_userId: { organizacionId: inv.organizacionId, userId: usuario.id } } });
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`select set_config('app.actor_id', ${usuario.id}, true)`;
      if (!ya) {
        await crearMiembroTx(tx, inv.organizacionId, usuario.id, {
          rolId: inv.rolId, cargo: inv.cargo ?? "",
          ajustes: (inv.ajustes as { clave: string; efecto: string }[]) ?? [],
          granjas: (inv.granjas as string[]) ?? [], unidades: (inv.unidades as string[]) ?? [],
          limiteCompraGs: inv.limiteCompraGs === null ? null : inv.limiteCompraGs.toString(),
        }, inv.invitadoPor);
      }
      await tx.invitacion.update({ where: { id: inv.id }, data: { estado: "ACEPTADA" } });
      await tx.user.update({ where: { id: usuario.id }, data: { onboardingCompleto: true } });
      await tx.notificacion.create({ data: { userId: inv.invitadoPor, organizacionId: inv.organizacionId, tipo: "INVITACION_ACEPTADA", titulo: `${usuario.name} aceptó tu invitación`, enlace: "/equipo" } });
    });
    (await cookies()).set(COOKIE_ORG, inv.organizacionId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return { ok: true, destino: "/dashboard" };
  } catch (e) { return manejar(e); }
}
