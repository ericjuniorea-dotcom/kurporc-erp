// Fase 12 · Quién opera la tienda. Los permisos se calculan sobre la organización VENDEDOR
// (aunque la persona tenga otra organización activa en el ERP).
import "server-only";
import prisma from "@/lib/db/prisma";
import { getSession, getUsuario } from "@/lib/auth/config";
import { permisosDeMiembro, puede, type Permisos } from "@/lib/permisos/servidor";

export type ContextoTienda = {
  usuarioId: string;
  org: { id: string; farmName: string; slug: string; verificacion: string; ruc: string | null; departamento: string | null; whatsapp: string | null; logoUrl: string | null };
  permisos: Permisos;
  puede: (clave: string) => boolean;
};

/** Tienda de la persona, o null si no tiene ninguna. */
export async function contextoTienda(): Promise<ContextoTienda | null> {
  const usuario = await getUsuario();
  if (!usuario) return null;
  const session = await getSession();
  if (session?.modoPlataforma) return null;
  const m = session?.membresias.find(x => x.tipo === "VENDEDOR");
  if (!m) return null;
  const [org, permisos] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: m.organizacionId }, select: { id: true, farmName: true, slug: true, verificacion: true, ruc: true, departamento: true, whatsapp: true, logoUrl: true } }),
    permisosDeMiembro(usuario.id, m.organizacionId),
  ]);
  if (!org || !permisos) return null;
  // La fila de tienda existe siempre (las nuevas tiendas la crean acá la primera vez)
  await prisma.tienda.upsert({ where: { organizacionId: org.id }, create: { organizacionId: org.id, zonasEntrega: org.departamento ? [org.departamento] : [] }, update: {} });
  return { usuarioId: usuario.id, org, permisos, puede: (c: string) => puede(permisos, c) };
}

/** Para acciones: tienda + permiso, o error legible. */
export async function exigirTienda(clave: string): Promise<ContextoTienda> {
  const c = await contextoTienda();
  if (!c) throw new Error("•No tenés una tienda en KurPorc.");
  if (!c.puede(clave)) throw new Error("•No tenés permiso para hacer esto en la tienda.");
  return c;
}
