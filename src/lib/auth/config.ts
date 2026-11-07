// Sesión de la aplicación (Fase 3: Supabase Auth).
//
// La identidad viene de Supabase Auth (cookie de sesión). La organización activa
// viene de la cookie `kp_org`, SIEMPRE validada contra `miembro` en el servidor (D4).
// La forma de `session.user` es la misma que tenía con NextAuth, para que las
// pantallas y APIs existentes no cambien: id, email, name, tenantId, roles…
// `roles` son los roles legados (IDs 1-14) hasta que la Fase 7 los reemplace por permisos.

import { cache } from "react";
import { cookies } from "next/headers";
import prisma from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import { tienePendientes } from "@/lib/legal/documentos";

// Los 14 roles legados (IDs 1-14). Se reemplazan por el catálogo de permisos en la Fase 7.
export const ROLES = {
  SUPER_ADMIN:        1,
  FARM_ADMIN:         2,
  GENERAL_MANAGER:    3,
  VET_CHIEF:          4,
  PRODUCTION_CHIEF:   5,
  BAL_MANAGER:        6,
  LOGISTICS_MANAGER:  7,
  HR_CHIEF:           8,
  ACCOUNTANT:         9,
  MATERNITY_MANAGER:  10,
  GESTATION_MANAGER:  11,
  NURSERY_MANAGER:    12,
  FIELD_OPERATOR:     13,
  EMPLOYEE_PORTAL:    14,
} as const;

export type RoleId = (typeof ROLES)[keyof typeof ROLES];

/** Nombre de la cookie con la organización activa. Nunca se confía en ella sin validar. */
export const COOKIE_ORG = "kp_org";

export interface Membresia {
  organizacionId: string;
  nombre: string;
  slug: string;
  tipo: string;
  esPropietario: boolean;
  rol: string | null;
}

export interface UsuarioSesion {
  id: string;            // users.id
  authUserId: string;    // auth.users.id
  email: string;
  name: string;
  avatarUrl: string | null;
  language: string;
  debeCambiarClave: boolean;
  onboardingCompleto: boolean;
  esSuperadmin: boolean;
}

export interface AppSession {
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string;      // organización activa (validada)
    tenantSlug: string;
    farmName: string;
    plan: string;
    roles: number[];
    language: string;
    avatarUrl: string | null;
  };
  membresias: Membresia[];
  aal: string | null;      // "aal1" | "aal2" (segundo factor)
}

/**
 * Persona autenticada (aunque todavía no pertenezca a ninguna organización).
 * null = sin sesión de Supabase o sin perfil en `users`.
 */
export const getUsuario = cache(async (): Promise<(UsuarioSesion & { aal: string | null; faltaSegundoFactor: boolean; faltaAceptarContrato: boolean }) | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  // Tiene el segundo factor activado pero esta sesión todavía no lo verificó (aal1 → aal2)
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const faltaSegundoFactor = nivel?.currentLevel === "aal1" && nivel?.nextLevel === "aal2";

  const u = await prisma.user.findUnique({
    where: { authUserId: claims.sub },
    select: {
      id: true, email: true, name: true, avatarUrl: true, language: true, isActive: true,
      debeCambiarClave: true, onboardingCompleto: true, authUserId: true,
      adminPlataforma: { select: { userId: true } },
    },
  });
  if (!u || !u.isActive) return null;

  return {
    id: u.id, authUserId: u.authUserId!, email: u.email, name: u.name, avatarUrl: u.avatarUrl,
    language: u.language, debeCambiarClave: u.debeCambiarClave, onboardingCompleto: u.onboardingCompleto,
    esSuperadmin: !!u.adminPlataforma,
    aal: typeof claims.aal === "string" ? claims.aal : null,
    faltaSegundoFactor,
    // Términos y Privacidad vigentes sin aceptar (Fase 4): sin esto no se usa la plataforma
    faltaAceptarContrato: await tienePendientes(u.id),
  };
});

/**
 * Sesión del ERP: persona + organización activa validada.
 * null = sin sesión, perfil inactivo o sin ninguna membresía activa.
 * Se calcula una sola vez por request (React cache).
 */
export const getSession = cache(async (): Promise<AppSession | null> => {
  const usuario = await getUsuario();
  // Sin segundo factor verificado (si lo tiene activado) o sin aceptar el contrato vigente,
  // no hay acceso a datos del ERP
  if (!usuario || usuario.faltaSegundoFactor || usuario.faltaAceptarContrato) return null;

  const [miembros, rolesLegados] = await Promise.all([
    prisma.miembro.findMany({
      where: { userId: usuario.id, estado: "ACTIVO", organizacion: { estado: "ACTIVA" } },
      select: {
        organizacionId: true, esPropietario: true,
        rol: { select: { nombre: true } },
        organizacion: { select: { id: true, farmName: true, slug: true, tipo: true, plan: true } },
      },
      orderBy: [{ esPropietario: "desc" }, { createdAt: "asc" }],
    }),
    prisma.userRole.findMany({ where: { userId: usuario.id }, select: { roleId: true } }),
  ]);
  if (miembros.length === 0) return null;

  const pedida = (await cookies()).get(COOKIE_ORG)?.value;
  const activa = miembros.find(m => m.organizacionId === pedida) ?? miembros[0];

  return {
    user: {
      id: usuario.id,
      email: usuario.email,
      name: usuario.name,
      tenantId: activa.organizacion.id,
      tenantSlug: activa.organizacion.slug,
      farmName: activa.organizacion.farmName,
      plan: activa.organizacion.plan,
      roles: rolesLegados.map(r => r.roleId),
      language: usuario.language,
      avatarUrl: usuario.avatarUrl,
    },
    membresias: miembros.map(m => ({
      organizacionId: m.organizacionId,
      nombre: m.organizacion.farmName,
      slug: m.organizacion.slug,
      tipo: m.organizacion.tipo,
      esPropietario: m.esPropietario,
      rol: m.rol?.nombre ?? null,
    })),
    aal: usuario.aal,
  };
});

// Helpers de verificación de roles legados — los roles son acumulables
export function hasRole(roles: number[], roleId: RoleId): boolean {
  return roles.includes(roleId);
}

export function hasAnyRole(roles: number[], ...roleIds: RoleId[]): boolean {
  return roleIds.some((id) => roles.includes(id));
}

export function canApproveStockAdjustments(roles: number[]): boolean {
  // Solo el Jefe de producción (o la administración) aprueba ajustes de stock
  return roles.includes(ROLES.PRODUCTION_CHIEF) ||
         roles.includes(ROLES.FARM_ADMIN) ||
         roles.includes(ROLES.SUPER_ADMIN);
}

export function canAccessFinancials(roles: number[]): boolean {
  return roles.includes(ROLES.FARM_ADMIN) ||
         roles.includes(ROLES.ACCOUNTANT) ||
         roles.includes(ROLES.SUPER_ADMIN);
}
