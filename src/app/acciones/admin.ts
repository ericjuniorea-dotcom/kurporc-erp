"use server";
// Acciones del panel de plataforma (Fase 11). Solo administradores; los cambios de administradores
// los controla además la base (solo un TOTAL autoriza, siempre queda un TOTAL).
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { getAdmin, guardarMotivo, MOTIVOS, type Motivo } from "@/lib/admin/acceso";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

type R = { ok: true } | { ok: false; error: string };

async function soloTotal() {
  const a = await getAdmin();
  if (!a || !a.verificado || a.nivel !== "TOTAL") throw new Error("•Solo un Super Administrador TOTAL puede hacer esto.");
  return a;
}

function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (/No se puede dejar la plataforma sin un Super Administrador TOTAL/.test(msg)) return { ok: false, error: "No se puede dejar la plataforma sin un Super Administrador TOTAL." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  console.error("[admin]", e);
  return { ok: false, error: "No se pudo completar." };
}

export async function elegirMotivo(organizacionId: string, motivo: string, detalle: string): Promise<R> {
  try {
    const a = await getAdmin();
    if (!a || !a.verificado || a.nivel === "LECTURA" || a.nivel === "MODERACION") throw new Error("•Tu nivel no permite abrir datos de una organización.");
    if (!(motivo in MOTIVOS)) throw new Error("•Elegí un motivo.");
    if (motivo === "OTRO" && detalle.trim().length < 5) throw new Error("•Detallá el motivo.");
    if (!(await prisma.tenant.findUnique({ where: { id: organizacionId }, select: { id: true } }))) throw new Error("•Esa organización no existe.");
    await guardarMotivo(organizacionId, motivo as Motivo, detalle.trim());
    return { ok: true };
  } catch (e) { return manejar(e); }
}

const altaSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  nivel: z.enum(["TOTAL", "SOPORTE", "MODERACION", "LECTURA"]),
}).strict();

export async function autorizarAdmin(datos: z.input<typeof altaSchema>): Promise<R> {
  try {
    const a = await soloTotal();
    const d = altaSchema.parse(datos);
    const u = await prisma.user.findFirst({ where: { email: d.email }, select: { id: true, authUserId: true, isActive: true } });
    if (!u || !u.authUserId || !u.isActive) throw new Error("•Esa persona tiene que haber creado su cuenta en KurPorc primero.");
    await conActor(a.usuario.id, tx => tx.adminPlataforma.upsert({ where: { userId: u.id }, create: { userId: u.id, nivel: d.nivel }, update: { nivel: d.nivel } }));
    const h = await headers();
    await registrarAuditoria("PERMISOS_CAMBIADOS", "admin_plataforma", u.id, { tipo: "admin_plataforma_autorizado", email: d.email, nivel: d.nivel }, { actorId: a.usuario.id, actorEsPlataforma: true, ip: ipDe(h), userAgent: userAgentDe(h) });
    revalidatePath("/admin/administradores");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function quitarAdmin(userId: string): Promise<R> {
  try {
    const a = await soloTotal();
    if (userId === a.usuario.id) throw new Error("•No te podés quitar a vos mismo.");
    const objetivo = await prisma.adminPlataforma.findUnique({ where: { userId }, select: { perfil: { select: { email: true } } } });
    if (!objetivo) throw new Error("•No es administrador.");
    await conActor(a.usuario.id, tx => tx.adminPlataforma.delete({ where: { userId } }));
    const h = await headers();
    await registrarAuditoria("PERMISOS_CAMBIADOS", "admin_plataforma", userId, { tipo: "admin_plataforma_quitado", email: objetivo.perfil.email }, { actorId: a.usuario.id, actorEsPlataforma: true, ip: ipDe(h), userAgent: userAgentDe(h) });
    revalidatePath("/admin/administradores");
    return { ok: true };
  } catch (e) { return manejar(e); }
}
