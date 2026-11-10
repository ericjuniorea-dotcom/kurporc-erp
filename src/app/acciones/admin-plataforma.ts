"use server";
// Acciones del panel de plataforma (Fase 11, parte 2): vendedores, privacidad, incidentes,
// documentos legales y datos del operador. Todas exigen segundo factor y quedan en auditoría.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { getAdmin, type NivelAdmin } from "@/lib/admin/acceso";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

type R = { ok: true } | { ok: false; error: string };

async function admin(niveles: NivelAdmin[]) {
  const a = await getAdmin();
  if (!a || !a.verificado || !niveles.includes(a.nivel)) throw new Error("•Tu nivel de administrador no permite hacer esto.");
  return a;
}

async function auditar(actorId: string, entidad: string, entidadId: string | null, detalle: Record<string, string | number | boolean | null>, organizacionId?: string | null) {
  const h = await headers();
  await registrarAuditoria("PERMISOS_CAMBIADOS", entidad, entidadId, detalle, { actorId, actorEsPlataforma: true, organizacionId: organizacionId ?? null, ip: ipDe(h), userAgent: userAgentDe(h) });
}

function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (/ya fue publicado/.test(msg)) return { ok: false, error: "Ese documento ya fue publicado: para cambiarlo hay que crear una versión nueva." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  console.error("[admin-plataforma]", e);
  return { ok: false, error: "No se pudo completar." };
}

// ── Vendedores ──────────────────────────────────────────────────────────────
export async function decidirVendedor(organizacionId: string, decision: "VERIFICADA" | "RECHAZADA", motivo: string): Promise<R> {
  try {
    const a = await admin(["TOTAL", "SOPORTE", "MODERACION"]);
    if (decision !== "VERIFICADA" && decision !== "RECHAZADA") throw new Error("•Decisión inválida.");
    const m = motivo.trim();
    if (decision === "RECHAZADA" && m.length < 5) throw new Error("•Escribí el motivo del rechazo: la tienda lo va a ver.");
    const org = await prisma.tenant.findUnique({ where: { id: organizacionId }, select: { tipo: true, farmName: true } });
    if (!org || org.tipo !== "VENDEDOR") throw new Error("•Esa organización no es una tienda.");
    await conActor(a.usuario.id, tx => tx.tenant.update({ where: { id: organizacionId }, data: { verificacion: decision } }));
    const duenos = await prisma.miembro.findMany({ where: { organizacionId, esPropietario: true }, select: { userId: true } });
    if (duenos.length) await prisma.notificacion.createMany({
      data: duenos.map(d => ({
        userId: d.userId, organizacionId, tipo: "VERIFICACION_TIENDA",
        titulo: decision === "VERIFICADA" ? "Tu tienda fue verificada" : "Tu tienda no pudo ser verificada",
        cuerpo: decision === "VERIFICADA" ? "Los compradores van a ver el sello de tienda verificada." : `Motivo: ${m}. Escribinos a soporte@kurporc.com para revisarlo.`,
        enlace: "/vendedor",
      })),
    });
    await auditar(a.usuario.id, "tenant", organizacionId, { tipo: "verificacion_tienda", decision, motivo: m || null }, organizacionId);
    revalidatePath("/admin/vendedores");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Privacidad ──────────────────────────────────────────────────────────────
const ESTADOS_PRIV = ["EN_CURSO", "RESPONDIDA", "RECHAZADA_CON_MOTIVO"] as const;
export async function responderPrivacidad(id: string, estado: string, respuesta: string): Promise<R> {
  try {
    const a = await admin(["TOTAL", "SOPORTE"]);
    if (!ESTADOS_PRIV.includes(estado as typeof ESTADOS_PRIV[number])) throw new Error("•Estado inválido.");
    const txt = respuesta.trim().slice(0, 4000);
    if (estado !== "EN_CURSO" && txt.length < 10) throw new Error("•Escribí la respuesta para la persona.");
    const s = await prisma.solicitudPrivacidad.findUnique({ where: { id }, select: { userId: true, tipo: true } });
    if (!s) throw new Error("•La solicitud no existe.");
    const cierra = estado !== "EN_CURSO";
    await conActor(a.usuario.id, tx => tx.solicitudPrivacidad.update({
      where: { id }, data: { estado, respuesta: txt || null, atendidaPor: a.usuario.id, respondidaEn: cierra ? new Date() : null },
    }));
    if (cierra) await prisma.notificacion.create({ data: { userId: s.userId, tipo: "PRIVACIDAD", titulo: "Respondimos tu solicitud sobre tus datos", cuerpo: txt.slice(0, 300), enlace: "/cuenta/privacidad" } });
    await auditar(a.usuario.id, "solicitud_privacidad", id, { tipo: s.tipo, estado });
    revalidatePath("/admin/privacidad");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Incidentes de seguridad ─────────────────────────────────────────────────
// datetime-local llega sin zona: es hora de Paraguay (UTC-3)
const py = (v: string) => new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(v) ? v : `${v.length === 16 ? `${v}:00` : v}-03:00`);
const fechaOpc = z.string().trim().optional().transform(v => (v ? py(v) : null)).refine(v => v === null || !isNaN(v.getTime()), "Fecha inválida");
const incidenteSchema = z.object({
  id: z.string().uuid().optional(),
  detectadoEn: z.string().trim().min(1, "Indicá cuándo se detectó").transform(py).refine(v => !isNaN(v.getTime()), "Fecha inválida"),
  descripcion: z.string().trim().min(10, "Describí el incidente").max(4000),
  datosAfectados: z.string().trim().max(2000).optional(),
  personasAfectadas: z.coerce.number().int().min(0).optional(),
  medidas: z.string().trim().max(4000).optional(),
  estado: z.enum(["ABIERTO", "CONTENIDO", "CERRADO"]),
  notificadoAgenciaEn: fechaOpc,
  notificadoTitularesEn: fechaOpc,
});
export async function guardarIncidente(datos: z.input<typeof incidenteSchema>): Promise<R> {
  try {
    const a = await admin(["TOTAL", "SOPORTE"]);
    const d = incidenteSchema.parse(datos);
    const data = {
      detectadoEn: d.detectadoEn, descripcion: d.descripcion, datosAfectados: d.datosAfectados || null,
      personasAfectadas: d.personasAfectadas ?? null, medidas: d.medidas || null, estado: d.estado,
      notificadoAgenciaEn: d.notificadoAgenciaEn, notificadoTitularesEn: d.notificadoTitularesEn,
    };
    const r = await conActor(a.usuario.id, tx => d.id
      ? tx.incidenteSeguridad.update({ where: { id: d.id }, data })
      : tx.incidenteSeguridad.create({ data: { ...data, registradoPor: a.usuario.id } }));
    await auditar(a.usuario.id, "incidente_seguridad", r.id, { tipo: d.id ? "incidente_actualizado" : "incidente_registrado", estado: d.estado });
    revalidatePath("/admin/seguridad");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Documentos legales ──────────────────────────────────────────────────────
export async function marcarAprobadoAsesor(id: string, aprobado: boolean, asesor: string): Promise<R> {
  try {
    const a = await admin(["TOTAL"]);
    if (aprobado && asesor.trim().length < 3) throw new Error("•Indicá quién lo aprobó (asesor o estudio jurídico).");
    const d = await prisma.documentoLegal.findUnique({ where: { id }, select: { codigo: true, version: true, estado: true } });
    if (!d) throw new Error("•El documento no existe.");
    await conActor(a.usuario.id, tx => tx.documentoLegal.update({ where: { id }, data: { aprobadoPorAsesor: aprobado } }));
    await auditar(a.usuario.id, "documento_legal", id, { tipo: "aprobacion_asesor", codigo: d.codigo, version: d.version, aprobado, asesor: asesor.trim().slice(0, 200) || null });
    revalidatePath("/admin/legal");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function publicarDocumento(id: string): Promise<R> {
  try {
    const a = await admin(["TOTAL"]);
    const d = await prisma.documentoLegal.findUnique({ where: { id }, select: { codigo: true, version: true, estado: true, aprobadoPorAsesor: true } });
    if (!d) throw new Error("•El documento no existe.");
    if (d.estado !== "BORRADOR") throw new Error("•Solo se publica un borrador.");
    if (!d.aprobadoPorAsesor) throw new Error("•Antes de publicarlo, el asesor legal tiene que aprobarlo.");
    await conActor(a.usuario.id, async tx => {
      await tx.documentoLegal.updateMany({ where: { codigo: d.codigo, estado: "PUBLICADO" }, data: { estado: "RETIRADO" } });
      await tx.documentoLegal.update({ where: { id }, data: { estado: "PUBLICADO", vigenteDesde: new Date(), publicadoPor: a.usuario.id } });
    });
    await auditar(a.usuario.id, "documento_legal", id, { tipo: "documento_publicado", codigo: d.codigo, version: d.version });
    revalidatePath("/admin/legal");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Datos del operador ──────────────────────────────────────────────────────
const configSchema = z.object({
  razonSocial: z.string().trim().min(2, "Razón social").max(200),
  ruc: z.string().trim().min(3, "RUC").max(30),
  domicilio: z.string().trim().min(5, "Domicilio").max(300),
  correoContacto: z.string().trim().toLowerCase().email("Correo de contacto inválido"),
  correoPrivacidad: z.string().trim().toLowerCase().email("Correo de privacidad inválido"),
  whatsappSoporte: z.string().trim().max(30).optional(),
  ciudadJurisdiccion: z.string().trim().min(2).max(100),
}).strict();
export async function guardarConfiguracion(datos: z.input<typeof configSchema>): Promise<R> {
  try {
    const a = await admin(["TOTAL"]);
    const d = configSchema.parse(datos);
    const data = { ...d, whatsappSoporte: d.whatsappSoporte || null };
    await conActor(a.usuario.id, tx => tx.configuracionPlataforma.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data }));
    await auditar(a.usuario.id, "configuracion_plataforma", "1", { tipo: "datos_operador" });
    revalidatePath("/admin/configuracion");
    return { ok: true };
  } catch (e) { return manejar(e); }
}
