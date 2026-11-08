"use server";
// Roles de la organización y transferencia de propiedad (Fase 7, parte 2).
// Reglas: nadie arma un rol con permisos que no tiene; los permisos "solo propietario" no van en
// ningún rol; el rol Administrador General no se edita; transferir exige segundo factor.
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/config";
import { CATALOGO_PERMISOS, CLAVES_PERMISOS, conVer } from "@/lib/permisos/catalogo";
import { ErrorPermiso, requirePermiso } from "@/lib/permisos/servidor";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

type R = { ok: true } | { ok: false; error: string };
const SOLO_PROPIETARIO = new Set<string>(CATALOGO_PERMISOS.filter(p => p.soloPropietario).map(p => p.clave));

async function ctx(actorId: string, organizacionId: string) {
  const h = await headers();
  return { actorId, organizacionId, ip: ipDe(h), userAgent: userAgentDe(h) };
}

function manejar(e: unknown): { ok: false; error: string } {
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  console.error("[roles]", e);
  return { ok: false, error: e instanceof Error && e.message.startsWith("•") ? e.message.slice(1) : "No se pudo completar. Probá de nuevo." };
}

const rolSchema = z.object({
  id: z.string().uuid().nullable(),
  nombre: z.string().trim().min(2, "Poné un nombre").max(60),
  descripcion: z.string().trim().max(200).default(""),
  permisos: z.array(z.string().max(80)).max(400),
}).strict();

export async function guardarRol(datos: z.input<typeof rolSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("equipo.roles.editar");
    const d = rolSchema.parse(datos);
    const o = permisos.organizacionId;
    for (const c of d.permisos) if (!CLAVES_PERMISOS.has(c)) throw new Error(`•Permiso desconocido: ${c}`);
    const claves = Array.from(conVer(d.permisos)).filter(c => !SOLO_PROPIETARIO.has(c));
    if (!permisos.esPropietario) {
      const sobra = claves.filter(c => !permisos.claves.has(c));
      if (sobra.length) throw new Error(`•No podés armar un rol con permisos que vos no tenés (${sobra.slice(0, 3).join(", ")}${sobra.length > 3 ? "…" : ""}).`);
    }

    let rolId = d.id;
    let antes: string[] = [];
    if (rolId) {
      const rol = await prisma.rol.findFirst({ where: { id: rolId, organizacionId: o }, select: { codigo: true, permisos: { select: { permisoClave: true } } } });
      if (!rol) throw new Error("•Ese rol no existe en tu organización.");
      if (rol.codigo === "ADMIN_GENERAL") throw new Error("•El rol Administrador General no se edita.");
      antes = rol.permisos.map(p => p.permisoClave);
      // Quien no es propietario no puede sacarle a un rol permisos que él no tiene (no podría volver a ponerlos)
      if (!permisos.esPropietario && antes.some(c => !permisos.claves.has(c) && !claves.includes(c))) {
        throw new Error("•Ese rol tiene permisos que vos no tenés; solo el Administrador General puede cambiarlos.");
      }
    }
    const nombreUsado = await prisma.rol.findFirst({ where: { organizacionId: o, nombre: { equals: d.nombre, mode: "insensitive" }, NOT: rolId ? { id: rolId } : undefined } });
    if (nombreUsado) throw new Error("•Ya hay un rol con ese nombre.");

    await prisma.$transaction(async tx => {
      if (rolId) {
        await tx.rol.update({ where: { id: rolId }, data: { nombre: d.nombre, descripcion: d.descripcion || null } });
        await tx.rolPermiso.deleteMany({ where: { rolId } });
      } else {
        const r = await tx.rol.create({ data: { organizacionId: o, codigo: `PROPIO_${randomBytes(4).toString("hex").toUpperCase()}`, nombre: d.nombre, descripcion: d.descripcion || null } });
        rolId = r.id;
      }
      if (claves.length) await tx.rolPermiso.createMany({ data: claves.map(c => ({ rolId: rolId!, permisoClave: c })) });
    });
    await registrarAuditoria("PERMISOS_CAMBIADOS", "rol", rolId, {
      tipo: d.id ? "rol_editado" : "rol_creado", nombre: d.nombre,
      agregados: claves.filter(c => !antes.includes(c)), quitados: antes.filter(c => !claves.includes(c)),
    }, await ctx(session.user.id, o));
    revalidatePath("/equipo");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function eliminarRol(id: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("equipo.roles.editar");
    const o = permisos.organizacionId;
    const rol = await prisma.rol.findFirst({ where: { id, organizacionId: o }, select: { codigo: true, nombre: true, _count: { select: { miembros: true } } } });
    if (!rol) throw new Error("•Ese rol no existe en tu organización.");
    if (rol.codigo === "ADMIN_GENERAL") throw new Error("•El rol Administrador General no se elimina.");
    if (rol._count.miembros > 0) throw new Error(`•Hay ${rol._count.miembros} persona(s) con este rol. Cambiales el rol primero.`);
    const invitaciones = await prisma.invitacion.count({ where: { organizacionId: o, rolId: id, estado: "PENDIENTE" } });
    if (invitaciones > 0) throw new Error("•Hay invitaciones pendientes con este rol. Revocalas primero.");
    await prisma.rol.delete({ where: { id } });
    await registrarAuditoria("PERMISOS_CAMBIADOS", "rol", id, { tipo: "rol_eliminado", nombre: rol.nombre }, await ctx(session.user.id, o));
    revalidatePath("/equipo");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

/** El propietario le pasa la organización a otro miembro. Él queda como Administrador General (no propietario). */
export async function transferirPropiedad(miembroId: string, confirmacion: string): Promise<R> {
  try {
    const { permisos } = await requirePermiso("equipo.propiedad.transferir");
    const session = await getSession();
    if (!session) throw new ErrorPermiso("equipo.propiedad.transferir");
    if (!permisos.esPropietario) throw new ErrorPermiso("equipo.propiedad.transferir");
    if (session.aal !== "aal2") throw new Error("•Para transferir la organización necesitás tener activado el segundo factor y haberlo verificado en esta sesión (Cuenta → Seguridad).");
    const o = permisos.organizacionId;
    const org = await prisma.tenant.findUnique({ where: { id: o }, select: { farmName: true } });
    if (!org || confirmacion.trim().toLowerCase() !== org.farmName.trim().toLowerCase()) throw new Error("•Escribí el nombre exacto de la organización para confirmar.");

    const destino = await prisma.miembro.findFirst({
      where: { id: miembroId, organizacionId: o },
      select: { id: true, userId: true, estado: true, esPropietario: true, perfil: { select: { tipoAcceso: true, name: true } } },
    });
    if (!destino || destino.esPropietario) throw new Error("•Elegí a otra persona de tu equipo.");
    if (destino.estado !== "ACTIVO") throw new Error("•Esa persona está suspendida.");
    if (destino.perfil.tipoAcceso === "GESTIONADA") throw new Error("•Una cuenta de operario no puede ser propietaria: tiene que entrar con su propio correo.");

    const rolAdmin = await prisma.rol.findFirst({ where: { organizacionId: o, codigo: "ADMIN_GENERAL" }, select: { id: true } });
    await prisma.$transaction([
      prisma.miembro.update({ where: { id: permisos.miembroId }, data: { esPropietario: false, rolId: rolAdmin?.id ?? null, alcanceGranjas: "TODAS", alcanceUnidades: "TODAS", limiteCompraGs: 0 } }),
      prisma.miembro.update({ where: { id: destino.id }, data: { esPropietario: true, rolId: rolAdmin?.id ?? undefined, alcanceGranjas: "TODAS", alcanceUnidades: "TODAS", limiteCompraGs: null } }),
      prisma.miembroPermiso.deleteMany({ where: { miembroId: destino.id } }),
    ]);
    await registrarAuditoria("PROPIEDAD_TRANSFERIDA", "miembro", destino.id, { de: session.user.id, a: destino.userId, nombre: destino.perfil.name }, await ctx(session.user.id, o));
    await prisma.notificacion.create({
      data: { userId: destino.userId, organizacionId: o, tipo: "PROPIEDAD_TRANSFERIDA", titulo: `Ahora sos propietario de ${org.farmName}`, cuerpo: `${session.user.name} te transfirió la organización.`, enlace: "/equipo" },
    }).catch(e => console.error("[roles] notificación", e));
    revalidatePath("/equipo");
    return { ok: true };
  } catch (e) { return manejar(e); }
}
