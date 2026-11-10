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
import { CATALOGO_PERMISOS } from "@/lib/permisos/catalogo";
import { leerModoPlataforma, registrarVistaPlataforma, type ModoPlataforma } from "@/lib/admin/modo-plataforma";

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
  /** Permisos efectivos (solo para la UI; los arma el layout del ERP). */
  permisos?: string[];
  esPropietario?: boolean;
  /** Super Administrador viendo esta organización en solo lectura (Fase 11, "Ver todo"). */
  modoPlataforma?: ModoPlataforma;
}

// En modo plataforma: solo permisos de ver, sin datos personales de funcionarios
const PERMISOS_PLATAFORMA = CATALOGO_PERMISOS.filter(p => p.accion.startsWith("ver") && p.clave !== "rrhh.datos_personales.ver").map(p => ({ permisoClave: p.clave }));

async function sesionPlataforma(usuario: UsuarioSesion & { aal: string | null }): Promise<AppSession | null> {
  if (!usuario.esSuperadmin || usuario.aal !== "aal2") return null;
  const modo = await leerModoPlataforma(usuario.id);
  if (!modo) return null;
  const [admin, org] = await Promise.all([
    prisma.adminPlataforma.findUnique({ where: { userId: usuario.id }, select: { nivel: true } }),
    prisma.tenant.findUnique({ where: { id: modo.org }, select: { id: true, farmName: true, slug: true, tipo: true, plan: true } }),
  ]);
  if (!admin || (admin.nivel !== "TOTAL" && admin.nivel !== "SOPORTE") || !org) return null;
  miembroActivo().valor = {
    id: "plataforma", esPropietario: false, estado: "ACTIVO", alcanceGranjas: "TODAS", alcanceUnidades: "TODAS", limiteCompraGs: null,
    rol: { codigo: "PLATAFORMA", nombre: "Plataforma (solo lectura)", permisos: PERMISOS_PLATAFORMA },
    permisosAjuste: [], granjas: [], unidades: [],
  };
  await registrarVistaPlataforma(modo);
  return {
    user: {
      id: usuario.id, email: usuario.email, name: usuario.name,
      tenantId: org.id, tenantSlug: org.slug, farmName: org.farmName, plan: org.plan,
      roles: [], language: usuario.language, avatarUrl: usuario.avatarUrl,
    },
    membresias: [{ organizacionId: org.id, nombre: org.farmName, slug: org.slug, tipo: org.tipo, esPropietario: false, rol: "Plataforma (solo lectura)" }],
    aal: usuario.aal,
    modoPlataforma: modo,
  };
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

  // En paralelo: nivel del segundo factor (aal1 → aal2) y el perfil
  const [{ data: nivel }, u] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    prisma.user.findUnique({
    where: { authUserId: claims.sub },
    select: {
      id: true, email: true, name: true, avatarUrl: true, language: true, isActive: true,
      debeCambiarClave: true, onboardingCompleto: true, authUserId: true,
      adminPlataforma: { select: { userId: true } },
    },
    }),
  ]);
  const faltaSegundoFactor = nivel?.currentLevel === "aal1" && nivel?.nextLevel === "aal2";
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

/** Campos de la membresía que necesita el cálculo de permisos (src/lib/permisos/servidor.ts). */
export const SELECT_PERMISOS = {
  id: true, esPropietario: true, estado: true, alcanceGranjas: true, alcanceUnidades: true, limiteCompraGs: true,
  permisosAjuste: { select: { permisoClave: true, efecto: true } },
  granjas: { select: { granjaId: true } },
  unidades: { select: { unidadId: true } },
} as const;

/** Membresía activa de este request (la completa getSession; la lee getPermisos sin otra consulta). */
export const miembroActivo = cache((): { valor: unknown } => ({ valor: null }));

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
  const plataforma = await sesionPlataforma(usuario);
  if (plataforma) return plataforma;

  // Una sola consulta: membresías + todo lo necesario para los permisos (lo reusa getPermisos)
  const miembros = await prisma.miembro.findMany({
      where: { userId: usuario.id, estado: "ACTIVO", organizacion: { estado: "ACTIVA" } },
      select: {
        ...SELECT_PERMISOS,
        organizacionId: true,
        rol: { select: { nombre: true, codigo: true, permisos: { select: { permisoClave: true } } } },
        organizacion: { select: { id: true, farmName: true, slug: true, tipo: true, plan: true } },
      },
      orderBy: [{ esPropietario: "desc" }, { createdAt: "asc" }],
    });
  if (miembros.length === 0) return null;

  const pedida = (await cookies()).get(COOKIE_ORG)?.value;
  // Sin cookie válida: primero una granja o empresa (el ERP), después una tienda
  const activa = miembros.find(m => m.organizacionId === pedida)
    ?? miembros.find(m => m.organizacion.tipo !== "VENDEDOR")
    ?? miembros[0];

  miembroActivo().valor = activa;
  return {
    user: {
      id: usuario.id,
      email: usuario.email,
      name: usuario.name,
      tenantId: activa.organizacion.id,
      tenantSlug: activa.organizacion.slug,
      farmName: activa.organizacion.farmName,
      plan: activa.organizacion.plan,
      roles: [], // roles legados: ya no se usan (Fase 7); los permisos están en getPermisos()
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
