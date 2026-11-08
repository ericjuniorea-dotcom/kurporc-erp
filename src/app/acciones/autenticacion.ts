"use server";
// Ingreso con Supabase Auth (Fase 3). Las contraseñas pasan por el servidor para
// aplicar el límite de intentos (Fase 2.3) y dejar auditoría. Google entra por
// /auth/callback.

import { headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import { getUsuario } from "@/lib/auth/config";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";
import { bloqueadoHasta, consumirIntento, limpiarIntentos } from "@/lib/seguridad/limites";
import { pendientesPersona, registrarAceptaciones } from "@/lib/legal/documentos";

export type Resultado = { ok: true; destino?: string } | { ok: false; error: string };

const DOMINIO_GESTIONADAS = "usuarios.kurporc.com";
const MENSAJE_BLOQUEO = "Demasiados intentos fallidos. Esperá unos minutos y volvé a probar.";
const MENSAJE_CREDENCIALES = "Correo o contraseña incorrectos.";

/** Solo rutas internas: evita redirigir a otro sitio con ?next=https://… */
export async function destinoSeguro(next: string | null | undefined, porDefecto = "/dashboard"): Promise<string> {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : porDefecto;
}

/** Motivo técnico del fallo para la auditoría (nunca incluye contraseñas ni claves). */
function diagnostico(e: unknown): string {
  if (!e || typeof e !== "object") return "sin error";
  const x = e as { name?: string; status?: number; message?: string; code?: string };
  return [x.name, x.status, x.code, x.message].filter(v => v !== undefined && v !== "").join(" | ").slice(0, 300);
}

async function contexto() {
  const h = await headers();
  return { ip: ipDe(h), userAgent: userAgentDe(h) };
}

async function origen(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kurporc.com");
}

async function ingresar(email: string, clave: string, next: string | null, metodo: string): Promise<Resultado> {
  const ctx = await contexto();
  const claveLimite = `${email}:${ctx.ip ?? "sin-ip"}`;

  if (await bloqueadoHasta("ingresoFallido", claveLimite)) {
    await registrarAuditoria("LOGIN_BLOQUEADO", "users", null, { email, metodo }, ctx);
    return { ok: false, error: MENSAJE_BLOQUEO };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: clave });

  if (error || !data.user) {
    await consumirIntento("ingresoFallido", claveLimite);
    await registrarAuditoria("LOGIN_FALLIDO", "users", null,
      { email, metodo, motivo: error?.code ?? "desconocido", detalle: diagnostico(error) }, ctx);
    if (!error?.code) console.error("[ingreso]", diagnostico(error));
    if (error?.code === "email_not_confirmed") {
      return { ok: false, error: "Todavía no confirmaste tu correo. Revisá tu bandeja de entrada." };
    }
    return { ok: false, error: MENSAJE_CREDENCIALES };
  }

  await limpiarIntentos("ingresoFallido", claveLimite);
  const u = await prisma.user.findUnique({ where: { authUserId: data.user.id }, select: { id: true, tenantId: true, isActive: true } });
  if (u && !u.isActive) {
    await supabase.auth.signOut();
    return { ok: false, error: "Tu cuenta está desactivada. Hablá con el administrador de tu organización." };
  }
  if (u) {
    await registrarAuditoria("LOGIN", "users", u.id, { metodo }, { ...ctx, actorId: u.id, organizacionId: u.tenantId });
    await prisma.user.update({ where: { id: u.id }, data: { ultimoAcceso: new Date() } });
  }
  return { ok: true, destino: await destinoSeguro(next) };
}

const esquemaCorreo = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido").max(254),
  clave: z.string().min(1, "Ingresá tu contraseña").max(200),
  next: z.string().max(500).nullable().optional(),
}).strict();

export async function ingresarConCorreo(datos: { email: string; clave: string; next?: string | null }): Promise<Resultado> {
  const p = esquemaCorreo.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
  return ingresar(p.data.email, p.data.clave, p.data.next ?? null, "correo");
}

const esquemaUsuario = z.object({
  usuario: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,40}$/, "Usuario inválido"),
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,12}$/, "Código de empresa inválido"),
  clave: z.string().min(1, "Ingresá tu contraseña").max(200),
  next: z.string().max(500).nullable().optional(),
}).strict();

/** Operarios sin correo (cuentas gestionadas): usuario + código de empresa + contraseña. */
export async function ingresarConUsuario(datos: { usuario: string; codigo: string; clave: string; next?: string | null }): Promise<Resultado> {
  const p = esquemaUsuario.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };

  const org = await prisma.tenant.findUnique({ where: { codigoUnion: p.data.codigo }, select: { slug: true } });
  // Si el código no existe se sigue igual (con un correo que no existe) para no revelar qué códigos son válidos.
  const email = `${p.data.usuario}.${org?.slug ?? "sin-organizacion"}@${DOMINIO_GESTIONADAS}`;
  const r = await ingresar(email, p.data.clave, p.data.next ?? null, "usuario");
  return r.ok ? r : { ok: false, error: r.error === MENSAJE_CREDENCIALES ? "Usuario, código o contraseña incorrectos." : r.error };
}

/** Siempre responde lo mismo, exista o no el correo (no revela qué cuentas existen). */
export async function recuperarClave(datos: { email: string }): Promise<Resultado> {
  const p = z.object({ email: z.string().trim().toLowerCase().email("Correo inválido").max(254) }).strict().safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Correo inválido" };

  const ctx = await contexto();
  if (!(await consumirIntento("recuperarClave", p.data.email))) {
    return { ok: false, error: "Ya pediste varios correos de recuperación. Probá de nuevo en una hora." };
  }
  if (p.data.email.endsWith(`@${DOMINIO_GESTIONADAS}`)) {
    return { ok: true }; // las cuentas gestionadas no reciben correo: les cambia la clave su administrador
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(p.data.email, {
    redirectTo: `${await origen()}/auth/callback?next=/cuenta/cambiar-clave`,
  });
  if (error) console.error("[recuperar]", error.code, error.message);
  await registrarAuditoria("LOGIN", "users", null, { tipo: "recuperacion_solicitada", email: p.data.email }, ctx);
  return { ok: true };
}

const esquemaClave = z.object({
  clave: z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(200),
  repetir: z.string(),
}).strict().refine(d => d.clave === d.repetir, { message: "Las contraseñas no coinciden", path: ["repetir"] });

export async function cambiarClave(datos: { clave: string; repetir: string }): Promise<Resultado> {
  const p = esquemaClave.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };

  const usuario = await getUsuario();
  if (!usuario) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: p.data.clave });
  if (error) {
    if (error.code === "same_password") return { ok: false, error: "La contraseña nueva tiene que ser distinta de la anterior." };
    if (error.code === "weak_password") return { ok: false, error: "Esa contraseña es muy débil o aparece en filtraciones conocidas. Elegí otra." };
    return { ok: false, error: "No se pudo cambiar la contraseña. Probá de nuevo." };
  }
  await prisma.user.update({ where: { id: usuario.id }, data: { debeCambiarClave: false } });
  await registrarAuditoria("LOGIN", "users", usuario.id, { tipo: "clave_cambiada" }, { ...(await contexto()), actorId: usuario.id });
  return { ok: true, destino: "/dashboard" };
}

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, "Escribí tu nombre").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido").max(254),
  clave: z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(200),
  acepta: z.literal(true, { errorMap: () => ({ message: "Tenés que tildar la casilla para crear la cuenta" }) }),
  tipo: z.enum(["COMPRADOR", "INDIVIDUAL", "EMPRESA", "VENDEDOR"]).optional(),
}).strict();

/**
 * Registro con correo y contraseña (Fase 6). Sin la casilla tildada no se crea la cuenta.
 * La respuesta es la misma exista o no el correo (no revela qué cuentas existen).
 */
export async function registrarConCorreo(datos: z.input<typeof esquemaRegistro>): Promise<Resultado> {
  const p = esquemaRegistro.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
  if (p.data.email.endsWith(`@${DOMINIO_GESTIONADAS}`)) return { ok: false, error: "Ese correo no se puede usar" };

  const ctx = await contexto();
  if (!(await consumirIntento("registro", ctx.ip ?? "sin-ip"))) {
    return { ok: false, error: "Se crearon demasiadas cuentas desde esta conexión. Probá de nuevo en una hora." };
  }

  const next = `/onboarding${p.data.tipo ? `?tipo=${p.data.tipo}` : ""}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: p.data.email,
    password: p.data.clave,
    options: {
      emailRedirectTo: `${await origen()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: p.data.nombre },
    },
  });
  if (error) {
    if (error.code === "weak_password") return { ok: false, error: "Esa contraseña es muy débil o aparece en filtraciones conocidas. Elegí otra." };
    if (error.code === "over_email_send_rate_limit") return { ok: false, error: "Se enviaron muchos correos en poco tiempo. Probá de nuevo en un rato o registrate con Google." };
    console.error("[registro]", diagnostico(error));
    return { ok: false, error: "No se pudo crear la cuenta. Probá de nuevo." };
  }

  // Cuenta nueva (identities vacío = el correo ya existía): se guarda la aceptación ya mismo
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    const u = await prisma.user.findUnique({ where: { authUserId: data.user.id }, select: { id: true } });
    if (u) {
      const pendientes = await pendientesPersona(u.id);
      await registrarAceptaciones(u.id, pendientes, { ...ctx, metodo: "CASILLA_REGISTRO" });
      await registrarAuditoria("CONTRATO_ACEPTADO", "documento_legal", null,
        { documentos: pendientes.map(d => `${d.codigo} ${d.version}`), metodo: "registro_correo" }, { ...ctx, actorId: u.id });
    }
  }
  return { ok: true };
}
