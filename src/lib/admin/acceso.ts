// Panel de plataforma (Fase 11): quién entra y registro de cada lectura de datos de una organización.
import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";
import { ipDe } from "@/lib/seguridad/auditoria";

export type NivelAdmin = "TOTAL" | "SOPORTE" | "MODERACION" | "LECTURA";
export const MOTIVOS = {
  SOPORTE: "Soporte a pedido de la organización",
  SEGURIDAD: "Seguridad (revisar un incidente o un abuso)",
  CUMPLIMIENTO_LEGAL: "Cumplimiento legal",
  ESTADISTICA: "Estadística de la plataforma",
  MEJORA_DEL_PRODUCTO: "Mejora del producto",
  OTRO: "Otro (detallar)",
} as const;
export type Motivo = keyof typeof MOTIVOS;
const COOKIE_MOTIVO = "kp_admin_motivo";
const DURACION_MOTIVO_MS = 2 * 60 * 60 * 1000; // el motivo vale 2 horas por organización

/** Administrador de plataforma de este request, o null. */
export const getAdmin = cache(async () => {
  const usuario = await getUsuario();
  if (!usuario?.esSuperadmin) return null;
  const a = await prisma.adminPlataforma.findUnique({ where: { userId: usuario.id }, select: { nivel: true } });
  if (!a) return null;
  return { usuario, nivel: a.nivel as NivelAdmin, verificado: usuario.aal === "aal2" };
});

/** Para páginas de /admin: un usuario común recibe 404 (no se revela que el panel existe). */
export async function requireAdmin(niveles?: NivelAdmin[]) {
  const a = await getAdmin();
  if (!a || !a.verificado) notFound();
  if (niveles && !niveles.includes(a.nivel)) notFound();
  return a;
}

type MotivoGuardado = Record<string, { motivo: Motivo; detalle: string; hasta: number }>;

async function motivosGuardados(): Promise<MotivoGuardado> {
  try { return JSON.parse((await cookies()).get(COOKIE_MOTIVO)?.value ?? "{}"); } catch { return {}; }
}

/** Motivo vigente para leer datos de esa organización (o null si hay que elegirlo). */
export async function motivoVigente(organizacionId: string) {
  const m = (await motivosGuardados())[organizacionId];
  return m && m.hasta > Date.now() ? m : null;
}

/** Guarda el motivo (cookie httpOnly, 2 horas). Solo desde una acción de servidor. */
export async function guardarMotivo(organizacionId: string, motivo: Motivo, detalle: string) {
  const todos = await motivosGuardados();
  const ahora = Date.now();
  for (const [k, v] of Object.entries(todos)) if (v.hasta <= ahora) delete todos[k];
  todos[organizacionId] = { motivo, detalle: detalle.slice(0, 200), hasta: ahora + DURACION_MOTIVO_MS };
  (await cookies()).set(COOKIE_MOTIVO, JSON.stringify(todos), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/admin", maxAge: DURACION_MOTIVO_MS / 1000,
  });
}

/** Deja la fila en acceso_plataforma. La organización la ve en Equipo → Actividad. */
export async function registrarAcceso(d: { adminId: string; organizacionId: string | null; seccion: string; motivo: string; detalle?: string | null; exportacion?: boolean; filas?: number }) {
  const ip = ipDe(await headers());
  await prisma.accesoPlataforma.create({
    data: { adminId: d.adminId, organizacionId: d.organizacionId, seccion: d.seccion.slice(0, 200), motivo: d.motivo, detalleMotivo: d.detalle || null, exportacion: !!d.exportacion, filas: d.filas ?? null, ip },
  }).catch(e => console.error("[acceso_plataforma]", e));
}
