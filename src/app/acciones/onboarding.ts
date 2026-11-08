"use server";
// Asistente de primeros pasos (Fase 6).
import { cookies, headers } from "next/headers";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { COOKIE_ORG, getUsuario } from "@/lib/auth/config";
import { crearOrganizacion } from "@/lib/organizaciones/crear";
import { normalizarRuc } from "@/lib/validaciones/ruc";
import { buscarRuc, type ResultadoRuc } from "@/lib/validaciones/padron";
import { consumirIntento } from "@/lib/seguridad/limites";
import { documentoVigente, hashTexto } from "@/lib/legal/documentos";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

type R = { ok: true; destino?: string } | { ok: false; error: string };

async function usuarioListo() {
  const u = await getUsuario();
  if (!u) return { error: "Tu sesión venció. Volvé a ingresar." as const };
  if (u.faltaAceptarContrato) return { error: "Primero aceptá los Términos y la Privacidad." as const };
  return { u };
}

const telefono = z.string().trim().regex(/^(\+595\s?)?[0-9\s]{6,15}$/, "Teléfono inválido (ej. +595 981 123456)");

const esquemaPersona = z.object({
  nombre: z.string().trim().min(2, "Escribí tu nombre").max(120),
  telefono: telefono.or(z.literal("")),
  departamento: z.string().trim().min(1, "Elegí tu departamento").max(60),
  distrito: z.string().trim().max(80),
}).strict();

function normalizarTelefono(t: string): string | null {
  if (!t) return null;
  const limpio = t.replace(/\s/g, "");
  return limpio.startsWith("+595") ? limpio : `+595${limpio.replace(/^0/, "")}`;
}

export async function guardarDatosPersonales(datos: z.infer<typeof esquemaPersona>): Promise<R> {
  const p = esquemaPersona.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
  const r = await usuarioListo();
  if ("error" in r) return { ok: false, error: r.error! };
  await prisma.user.update({
    where: { id: r.u.id },
    data: { name: p.data.nombre, phone: normalizarTelefono(p.data.telefono), departamento: p.data.departamento, distrito: p.data.distrito || null },
  });
  return { ok: true };
}

export async function terminarComoComprador(): Promise<R> {
  const r = await usuarioListo();
  if ("error" in r) return { ok: false, error: r.error! };
  await prisma.user.update({ where: { id: r.u.id }, data: { tipoRegistro: "COMPRADOR", onboardingCompleto: true } });
  return { ok: true, destino: "/cuenta/sin-organizacion" };
}

const TEXTO_FACULTADES = "Declaro que tengo facultades para representar a esta organización y acepto, en su nombre, el documento indicado.";

const esquemaOrg = z.object({
  tipo: z.enum(["INDIVIDUAL", "EMPRESA", "VENDEDOR"]),
  nombre: z.string().trim().min(2, "Escribí el nombre").max(80),
  razonSocial: z.string().trim().max(120).optional().default(""),
  ruc: z.string().trim().max(15).optional().default(""),
  departamento: z.string().trim().min(1, "Elegí el departamento").max(60),
  distrito: z.string().trim().max(80).optional().default(""),
  whatsapp: telefono.or(z.literal("")).optional().default(""),
  nombreGranja: z.string().trim().max(80).optional().default(""),
  madresAprox: z.coerce.number().int().min(0).max(100000).optional(),
  sistemaProductivo: z.enum(["CICLO_COMPLETO", "CRIA", "ENGORDE", "CRIA_RECRIA"]).optional(),
  categoriasVenta: z.array(z.string().max(40)).max(10).optional().default([]),
  zonasEntrega: z.array(z.string().max(40)).max(20).optional().default([]),
  aceptaAcuerdo: z.literal(true, { errorMap: () => ({ message: "Tenés que tildar la casilla del acuerdo" }) }),
  hashAcuerdo: z.string().regex(/^[a-f0-9]{64}$/),
  claveCreacion: z.string().uuid(),
}).strict();

export async function crearMiOrganizacion(datos: z.input<typeof esquemaOrg>): Promise<R> {
  const p = esquemaOrg.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
  const d = p.data;
  const r = await usuarioListo();
  if ("error" in r) return { ok: false, error: r.error! };

  let ruc: string | null = null;
  if (d.ruc) {
    ruc = normalizarRuc(d.ruc);
    if (!ruc) return { ok: false, error: "El RUC no es válido. Escribilo con guion y dígito verificador, ej. 4799016-3." };
  }
  // El RUC se verifica contra el padrón de la DNIT: si está activo, la razón social sale de ahí
  // y la tienda queda verificada; si todavía no figura, la tienda opera igual y se verifica sola después.
  let razonSocial = d.razonSocial || null;
  let verificada = false;
  if (ruc) {
    const p = await buscarRuc(ruc);
    if (p.valido && p.activo) { razonSocial = p.razonSocial; verificada = true; }
  }
  if (d.tipo === "VENDEDOR") {
    if (!ruc) return { ok: false, error: "Para vender en el Mercado el RUC es obligatorio." };
    if (!razonSocial) return { ok: false, error: "Escribí la razón social como figura en la DNIT." };
  }

  // El acuerdo aceptado tiene que ser exactamente el vigente que se mostró
  const codigoAcuerdo = d.tipo === "VENDEDOR" ? "TERMINOS_VENDEDOR" : "ACUERDO_ORGANIZACION";
  const acuerdo = await documentoVigente(codigoAcuerdo);
  if (!acuerdo) return { ok: false, error: "No se encontró el acuerdo vigente. Probá de nuevo en unos minutos." };
  if (acuerdo.hashMostrado !== d.hashAcuerdo) return { ok: false, error: "El acuerdo se actualizó. Recargá la página para ver la versión nueva." };

  const { id, creada } = await crearOrganizacion(r.u.id, {
    tipo: d.tipo, nombre: d.nombre, razonSocial, ruc, rucVerificado: verificada,
    departamento: d.departamento, distrito: d.distrito || null, whatsapp: normalizarTelefono(d.whatsapp),
    nombreGranja: d.nombreGranja || null, madresAprox: d.madresAprox ?? null, sistemaProductivo: d.sistemaProductivo ?? null,
    categoriasVenta: d.categoriasVenta, zonasEntrega: d.zonasEntrega, claveCreacion: d.claveCreacion,
  });

  const h = await headers();
  const ctx = { ip: ipDe(h), userAgent: userAgentDe(h) };
  if (creada) {
    await prisma.aceptacionDocumento.create({
      data: {
        userId: r.u.id, organizacionId: id, actuaComo: "REPRESENTANTE_ORGANIZACION",
        documentoId: acuerdo.id, codigo: acuerdo.codigo, version: acuerdo.version,
        hashSha256: hashTexto(acuerdo.contenido), aceptado: true, textoCasilla: TEXTO_FACULTADES,
        ip: ctx.ip, userAgent: ctx.userAgent, metodo: "CASILLA",
      },
    });
    await registrarAuditoria("CONTRATO_ACEPTADO", "tenants", id,
      { documento: `${acuerdo.codigo} ${acuerdo.version}`, tipo: d.tipo }, { ...ctx, actorId: r.u.id, organizacionId: id });
  }

  (await cookies()).set(COOKIE_ORG, id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
  });
  return { ok: true, destino: d.tipo === "VENDEDOR" ? "/vendedor" : "/dashboard" };
}

const esquemaUnion = z.object({
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,12}$/, "Código inválido"),
  mensaje: z.string().trim().max(500).optional().default(""),
}).strict();

/** "Tengo un código de empresa": pide unirse; el Administrador General lo aprueba en Equipo (Fase 7). */
export async function pedirUnirme(datos: z.input<typeof esquemaUnion>): Promise<R> {
  const p = esquemaUnion.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
  const r = await usuarioListo();
  if ("error" in r) return { ok: false, error: r.error! };

  const org = await prisma.tenant.findUnique({ where: { codigoUnion: p.data.codigo }, select: { id: true, farmName: true, tipo: true } });
  if (!org || org.tipo === "VENDEDOR") return { ok: false, error: "No encontramos una empresa con ese código. Revisalo con tu administrador." };
  const ya = await prisma.miembro.findUnique({ where: { organizacionId_userId: { organizacionId: org.id, userId: r.u.id } } });
  if (ya) return { ok: false, error: `Ya sos parte de ${org.farmName}.` };

  await prisma.solicitudUnion.upsert({
    where: { organizacionId_userId: { organizacionId: org.id, userId: r.u.id } },
    create: { organizacionId: org.id, userId: r.u.id, mensaje: p.data.mensaje || null },
    update: { mensaje: p.data.mensaje || null, estado: "PENDIENTE" },
  });
  await prisma.user.update({ where: { id: r.u.id }, data: { onboardingCompleto: true } });
  return { ok: true, destino: "/cuenta/sin-organizacion?solicitud=enviada" };
}

/** Busca el RUC en el padrón de la DNIT para completar la razón social en el formulario. */
export async function consultarRuc(texto: string): Promise<ResultadoRuc | { valido: false; mensaje: string }> {
  const u = await getUsuario();
  if (!u) return { valido: false, mensaje: "Iniciá sesión." };
  if (!(await consumirIntento("consultaRuc", u.id))) return { valido: false, mensaje: "Demasiadas consultas. Probá en un rato." };
  return buscarRuc(String(texto).slice(0, 20));
}
