// Permisos en el servidor (Fase 7.5). Misma lógica que la función SQL tiene_permiso():
//   propietario → todo · rol + ajustes PERMITIR − ajustes DENEGAR · alcance de granjas y unidades.
// Ocultar botones en la UI es comodidad; la seguridad es esto, en cada API y acción.
import { cache } from "react";
import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getSession, type AppSession } from "@/lib/auth/config";
import { CATALOGO_PERMISOS, type PermisoClave } from "./catalogo";

export interface Permisos {
  organizacionId: string;
  miembroId: string;
  esPropietario: boolean;
  claves: Set<string>;
  granjas: "TODAS" | string[];
  unidades: "TODAS" | string[];
  limiteCompraGs: bigint | null;
  rol: string | null;
  /** Permisos sensibles que tiene pero que no aplican hasta que verifique el segundo factor. */
  bloqueadosPorSegundoFactor: string[];
}

const SOLO_PROPIETARIO = new Set(CATALOGO_PERMISOS.filter(p => p.soloPropietario).map(p => p.clave));
const TODAS = CATALOGO_PERMISOS.map(p => p.clave);

/**
 * Permisos que exigen segundo factor (Fase 7.6): plata, sueldos, datos personales y quién puede qué.
 * A un miembro sin segundo factor verificado en esta sesión no se le aplican (el propietario ve un aviso).
 */
export function requiereSegundoFactor(clave: string): boolean {
  return clave.startsWith("finanzas.") || clave.startsWith("rrhh.sueldos.") || clave === "rrhh.datos_personales.ver"
    || clave === "equipo.permisos.editar" || clave === "equipo.roles.editar" || clave === "configuracion.datos.exportar";
}

/** Permisos efectivos de la persona en su organización activa. Se calcula una vez por request. */
export const getPermisos = cache(async (): Promise<Permisos | null> => {
  const session = await getSession();
  if (!session) return null;
  const p = await permisosDeMiembro(session.user.id, session.user.tenantId);
  if (!p || session.aal === "aal2") return p;
  const sensibles = Array.from(p.claves).filter(requiereSegundoFactor);
  if (p.esPropietario) return { ...p, bloqueadosPorSegundoFactor: sensibles }; // solo aviso: nunca dejar afuera al dueño
  for (const c of sensibles) p.claves.delete(c);
  return { ...p, bloqueadosPorSegundoFactor: sensibles };
});

export async function permisosDeMiembro(userId: string, organizacionId: string): Promise<Permisos | null> {
  const m = await prisma.miembro.findUnique({
    where: { organizacionId_userId: { organizacionId, userId } },
    select: {
      id: true, esPropietario: true, estado: true, alcanceGranjas: true, alcanceUnidades: true, limiteCompraGs: true,
      rol: { select: { codigo: true, permisos: { select: { permisoClave: true } } } },
      permisosAjuste: { select: { permisoClave: true, efecto: true } },
      granjas: { select: { granjaId: true } },
      unidades: { select: { unidadId: true } },
    },
  });
  if (!m || m.estado !== "ACTIVO") return null;

  let claves: Set<string>;
  if (m.esPropietario) {
    claves = new Set(TODAS);
  } else {
    claves = new Set(m.rol?.permisos.map(p => p.permisoClave) ?? []);
    for (const a of m.permisosAjuste) if (a.efecto === "PERMITIR") claves.add(a.permisoClave);
    for (const a of m.permisosAjuste) if (a.efecto === "DENEGAR") claves.delete(a.permisoClave);
    for (const c of Array.from(SOLO_PROPIETARIO)) claves.delete(c);
  }
  return {
    organizacionId, miembroId: m.id, esPropietario: m.esPropietario, claves,
    granjas: m.esPropietario || m.alcanceGranjas === "TODAS" ? "TODAS" : m.granjas.map(g => g.granjaId),
    unidades: m.esPropietario || m.alcanceUnidades === "TODAS" ? "TODAS" : m.unidades.map(u => u.unidadId),
    limiteCompraGs: m.limiteCompraGs, rol: m.rol?.codigo ?? null, bloqueadosPorSegundoFactor: [],
  };
}

export function puede(p: Permisos | null, clave: PermisoClave | string, alcance?: { granjaId?: string | null; unidadId?: string | null }): boolean {
  if (!p) return false;
  if (!p.esPropietario && !p.claves.has(clave)) return false;
  if (alcance?.granjaId && p.granjas !== "TODAS" && !p.granjas.includes(alcance.granjaId)) return false;
  if (alcance?.unidadId && p.unidades !== "TODAS" && !p.unidades.includes(alcance.unidadId)) return false;
  return true;
}

export class ErrorPermiso extends Error {
  constructor(public clave: string) { super(`Sin permiso: ${clave}`); }
}

/** Para acciones de servidor: devuelve sesión y permisos, o lanza ErrorPermiso. */
export async function requirePermiso(clave: PermisoClave | string, alcance?: { granjaId?: string | null; unidadId?: string | null }):
  Promise<{ session: AppSession; permisos: Permisos }> {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos || !puede(permisos, clave, alcance)) throw new ErrorPermiso(String(clave));
  return { session, permisos };
}

/**
 * Para route handlers: `const r = await permisoApi("gestacion.servicios.crear"); if (r instanceof NextResponse) return r;`
 * 401 sin sesión, 403 sin permiso.
 */
export async function permisoApi(clave: PermisoClave | string, alcance?: { granjaId?: string | null; unidadId?: string | null }):
  Promise<{ session: AppSession; permisos: Permisos } | NextResponse> {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!permisos || !puede(permisos, clave, alcance)) {
    return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: clave }, { status: 403 });
  }
  return { session, permisos };
}

/** Alguno de varios permisos (por ejemplo, una API que sirve a dos módulos). */
export async function algunPermisoApi(claves: (PermisoClave | string)[]): Promise<{ session: AppSession; permisos: Permisos } | NextResponse> {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!permisos || !claves.some(c => puede(permisos, c))) {
    return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: claves.join(" | ") }, { status: 403 });
  }
  return { session, permisos };
}

/** ¿Tiene al menos uno de estos permisos? (APIs de lectura que sirven a varias pantallas). */
export function puedeAlguno(p: Permisos | null, claves: (PermisoClave | string)[]): boolean {
  return claves.some(c => puede(p, c));
}
