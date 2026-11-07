"use server";
// Derechos de la persona sobre sus datos (Fase 4.3, Ley 7593/2025).
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";
import { TIPOS_SOLICITUD, type TipoSolicitud } from "@/lib/legal/privacidad";

type R = { ok: true; mensaje?: string } | { ok: false; error: string };
const DIAS_RESPUESTA = 30;

async function ctx(actorId: string) {
  const h = await headers();
  return { actorId, ip: ipDe(h), userAgent: userAgentDe(h) };
}

const esquemaPerfil = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(120),
  phone: z.string().trim().regex(/^(\+595\s?)?[0-9\s]{6,15}$/, "Teléfono inválido (ej. +595 981 123456)").or(z.literal("")),
  departamento: z.string().trim().max(60),
  distrito: z.string().trim().max(80),
}).strict();

export async function actualizarPerfil(datos: z.infer<typeof esquemaPerfil>): Promise<R> {
  const p = esquemaPerfil.safeParse(datos);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Datos inválidos" };
  const u = await getUsuario();
  if (!u) return { ok: false, error: "Tu sesión venció" };
  await prisma.user.update({
    where: { id: u.id },
    data: {
      name: p.data.name,
      phone: p.data.phone ? p.data.phone.replace(/\s/g, "").replace(/^(?!\+595)/, "+595") : null,
      departamento: p.data.departamento || null,
      distrito: p.data.distrito || null,
    },
  });
  revalidatePath("/cuenta/privacidad");
  return { ok: true, mensaje: "Datos actualizados" };
}

const esquemaSolicitud = z.object({
  tipo: z.enum(Object.keys(TIPOS_SOLICITUD) as [TipoSolicitud, ...TipoSolicitud[]]),
  detalle: z.string().trim().max(2000),
}).strict();

export async function crearSolicitud(datos: { tipo: string; detalle: string }): Promise<R> {
  const p = esquemaSolicitud.safeParse(datos);
  if (!p.success) return { ok: false, error: "Elegí el tipo de solicitud" };
  const u = await getUsuario();
  if (!u) return { ok: false, error: "Tu sesión venció" };
  const abiertas = await prisma.solicitudPrivacidad.count({ where: { userId: u.id, estado: { in: ["RECIBIDA", "EN_CURSO"] } } });
  if (abiertas >= 5) return { ok: false, error: "Ya tenés 5 solicitudes en curso. Esperá la respuesta antes de hacer otra." };
  const s = await prisma.solicitudPrivacidad.create({
    data: { userId: u.id, tipo: p.data.tipo, detalle: p.data.detalle || null, venceEn: new Date(Date.now() + DIAS_RESPUESTA * 86400000) },
  });
  await registrarAuditoria("SOLICITUD_PRIVACIDAD", "solicitud_privacidad", s.id, { tipo: p.data.tipo }, await ctx(u.id));
  revalidatePath("/cuenta/privacidad");
  return { ok: true, mensaje: `Solicitud recibida. Te respondemos antes del ${s.venceEn.toLocaleDateString("es-PY", { timeZone: "America/Asuncion" })}.` };
}

export async function pedirBaja(datos: { confirmacion: string }): Promise<R> {
  const u = await getUsuario();
  if (!u) return { ok: false, error: "Tu sesión venció" };
  if (datos.confirmacion.trim().toLowerCase() !== u.email.toLowerCase()) {
    return { ok: false, error: "Escribí tu correo exactamente como figura para confirmar" };
  }
  // Un propietario con equipo primero tiene que transferir la propiedad o cerrar la organización
  const conEquipo = await prisma.miembro.findFirst({
    where: { userId: u.id, esPropietario: true, estado: "ACTIVO", organizacion: { miembros: { some: { userId: { not: u.id }, estado: "ACTIVO" } } } },
    select: { organizacion: { select: { farmName: true } } },
  });
  if (conEquipo) {
    return { ok: false, error: `Sos el Administrador General de ${conEquipo.organizacion.farmName}, que tiene más personas. Primero transferí la propiedad o cerrá la organización.` };
  }
  const yaPedida = await prisma.solicitudPrivacidad.findFirst({ where: { userId: u.id, tipo: "SUPRESION", estado: { in: ["RECIBIDA", "EN_CURSO"] } } });
  if (!yaPedida) {
    await prisma.$transaction([
      prisma.solicitudPrivacidad.create({
        data: { userId: u.id, tipo: "SUPRESION", detalle: "Baja de la cuenta pedida desde el portal de privacidad", venceEn: new Date(Date.now() + DIAS_RESPUESTA * 86400000) },
      }),
      prisma.user.update({ where: { id: u.id }, data: { bajaSolicitadaEn: new Date() } }),
    ]);
    await registrarAuditoria("BAJA_SOLICITADA", "users", u.id, {}, await ctx(u.id));
  }
  revalidatePath("/cuenta/privacidad");
  return { ok: true, mensaje: "Pedido de baja recibido. Tenés 30 días para arrepentirte; después se borran o anonimizan tus datos, salvo lo que la ley obliga a guardar." };
}

export async function cancelarBaja(): Promise<R> {
  const u = await getUsuario();
  if (!u) return { ok: false, error: "Tu sesión venció" };
  await prisma.$transaction([
    prisma.solicitudPrivacidad.updateMany({ where: { userId: u.id, tipo: "SUPRESION", estado: { in: ["RECIBIDA", "EN_CURSO"] } }, data: { estado: "CANCELADA" } }),
    prisma.user.update({ where: { id: u.id }, data: { bajaSolicitadaEn: null } }),
  ]);
  revalidatePath("/cuenta/privacidad");
  return { ok: true, mensaje: "Cancelaste el pedido de baja. Tu cuenta sigue activa." };
}
