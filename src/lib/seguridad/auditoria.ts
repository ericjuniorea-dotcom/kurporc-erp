// Registro de auditoría (Fase 2.1): quién hizo qué, cuándo y desde dónde.
// La tabla es de solo agregar. Un fallo al auditar nunca rompe la acción del
// usuario: se informa por consola y sigue.

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

export type AccionAuditoria =
  | "LOGIN" | "LOGIN_FALLIDO" | "LOGIN_BLOQUEADO" | "LOGOUT"
  | "MIEMBRO_INVITADO" | "MIEMBRO_SUSPENDIDO" | "PERMISOS_CAMBIADOS" | "PROPIEDAD_TRANSFERIDA"
  | "DATO_PERSONAL_VISTO" | "EXPORTACION"
  | "MOVIMIENTO_ANULADO" | "MES_CERRADO" | "MES_REABIERTO"
  | "CONTRATO_ACEPTADO" | "SOLICITUD_PRIVACIDAD" | "BAJA_SOLICITADA" | "SUPERADMIN_LECTURA";

export interface ContextoAuditoria {
  organizacionId?: string | null;
  actorId?: string | null;
  actorEsPlataforma?: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

type Cabeceras = Headers | Record<string, string | string[] | undefined> | undefined;

function cabecera(h: Cabeceras, nombre: string): string | undefined {
  if (!h) return undefined;
  if (typeof (h as Headers).get === "function") return (h as Headers).get(nombre) ?? undefined;
  const v = (h as Record<string, string | string[] | undefined>)[nombre];
  return Array.isArray(v) ? v[0] : v;
}

/** IP del cliente detrás del proxy de Vercel. */
export function ipDe(h: Cabeceras): string | null {
  const xff = cabecera(h, "x-forwarded-for");
  return (xff?.split(",")[0].trim() || cabecera(h, "x-real-ip") || null)?.slice(0, 64) ?? null;
}

export function userAgentDe(h: Cabeceras): string | null {
  return cabecera(h, "user-agent")?.slice(0, 400) ?? null;
}

export async function registrarAuditoria(
  accion: AccionAuditoria,
  entidad: string,
  entidadId: string | null,
  detalle: Prisma.InputJsonValue = {},
  ctx: ContextoAuditoria = {},
): Promise<void> {
  try {
    await prisma.auditoria.create({
      data: {
        accion, entidad, entidadId, detalle,
        organizacionId: ctx.organizacionId ?? null,
        actorId: ctx.actorId ?? null,
        actorEsPlataforma: ctx.actorEsPlataforma ?? false,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });
  } catch (e) {
    console.error("[auditoria] no se pudo registrar", accion, e);
  }
}
