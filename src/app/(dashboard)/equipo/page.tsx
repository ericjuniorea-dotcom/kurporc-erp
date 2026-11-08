import { redirect } from "next/navigation";
import { EncabezadoEquipo } from "./encabezado";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { getSession } from "@/lib/auth/config";
import { CATALOGO_PERMISOS } from "@/lib/permisos/catalogo";
import { PanelEquipo } from "./panel-equipo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipo · KurPorc" };

export default async function EquipoPage() {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "equipo.miembros.ver")) redirect("/dashboard");
  const o = session.user.tenantId;

  const [org, miembros, invitaciones, solicitudes, roles, granjas, unidades] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: o }, select: { tipo: true, codigoUnion: true, farmName: true } }),
    prisma.miembro.findMany({
      where: { organizacionId: o },
      orderBy: [{ esPropietario: "desc" }, { createdAt: "asc" }],
      select: {
        id: true, cargo: true, estado: true, esPropietario: true, alcanceGranjas: true, alcanceUnidades: true, limiteCompraGs: true, rolId: true,
        perfil: { select: { id: true, name: true, email: true, avatarUrl: true, ultimoAcceso: true, tipoAcceso: true } },
        rol: { select: { nombre: true } },
        granjas: { select: { granjaId: true } }, unidades: { select: { unidadId: true } },
        permisosAjuste: { select: { permisoClave: true, efecto: true } },
      },
    }),
    prisma.invitacion.findMany({ where: { organizacionId: o, estado: "PENDIENTE" }, orderBy: { createdAt: "desc" },
      select: { id: true, email: true, cargo: true, expiraEn: true, rolId: true } }),
    prisma.solicitudUnion.findMany({ where: { organizacionId: o, estado: "PENDIENTE" }, orderBy: { createdAt: "asc" } }),
    prisma.rol.findMany({ where: { organizacionId: o }, orderBy: { createdAt: "asc" },
      select: { id: true, codigo: true, nombre: true, descripcion: true, permisos: { select: { permisoClave: true } }, _count: { select: { miembros: true } } } }),
    prisma.granja.findMany({ where: { organizacionId: o, activa: true }, select: { id: true, nombre: true } }),
    prisma.unidadNegocio.findMany({ where: { organizacionId: o, activa: true }, select: { id: true, nombre: true, codigo: true } }),
  ]);
  const veActividad = puede(permisos, "equipo.auditoria.ver");
  const eventos = veActividad
    ? await prisma.auditoria.findMany({ where: { organizacionId: o }, orderBy: { createdAt: "desc" }, take: 300,
        select: { id: true, createdAt: true, actorId: true, accion: true, entidad: true, detalle: true, ip: true } })
    : [];
  const actorIds = Array.from(new Set(eventos.map(e => e.actorId).filter((x): x is string => !!x)));
  const actores = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
  const nombreActor = new Map(actores.map(a => [a.id, a.name]));
  const perfilesSolicitud = solicitudes.length
    ? await prisma.user.findMany({ where: { id: { in: solicitudes.map(s => s.userId) } }, select: { id: true, name: true, email: true } })
    : [];
  const esTienda = org?.tipo === "VENDEDOR";
  const gruposVisibles = esTienda ? ["Tienda", "Equipo", "Configuración"] : ["Producción", "Finanzas", "Comercial", "Compras", "RRHH", "Equipo", "Configuración"];

  return (
    <>
      <EncabezadoEquipo />
      <div style={{ padding: "16px 20px" }}>
        <PanelEquipo
          yo={session.user.id}
          codigoEmpresa={org?.codigoUnion ?? ""}
          puedo={{
            invitar: puede(permisos, "equipo.miembros.invitar"),
            gestionada: puede(permisos, "equipo.miembros.crear_gestionada"),
            editar: puede(permisos, "equipo.permisos.editar"),
            suspender: puede(permisos, "equipo.miembros.suspender"),
            quitar: puede(permisos, "equipo.miembros.quitar"),
            solicitudes: puede(permisos, "equipo.solicitudes.aprobar"),
            sinLimite: permisos.esPropietario,
          }}
          misPermisos={permisos.esPropietario ? null : Array.from(permisos.claves)}
          catalogo={CATALOGO_PERMISOS.filter(p => gruposVisibles.includes(p.grupo)).map(p => ({
            clave: p.clave, grupo: p.grupo, modulo: p.modulo, recurso: p.recurso, accion: p.accion,
            descripcion: p.descripcion.split(" — ")[0], sensible: p.sensible, soloPropietario: p.soloPropietario,
          }))}
          roles={roles.map(r => ({ id: r.id, codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion ?? "", permisos: r.permisos.map(p => p.permisoClave) }))}
          granjas={granjas}
          unidades={unidades}
          miembros={miembros.map(m => ({
            id: m.id, nombre: m.perfil.name, email: m.perfil.tipoAcceso === "GESTIONADA" ? m.perfil.email.split(".")[0] + " (usuario)" : m.perfil.email,
            avatarUrl: m.perfil.avatarUrl, userId: m.perfil.id, cargo: m.cargo ?? "", estado: m.estado, esPropietario: m.esPropietario,
            gestionada: m.perfil.tipoAcceso === "GESTIONADA", rolId: m.rolId, rol: m.rol?.nombre ?? (m.esPropietario ? "Administrador General" : "—"),
            granjas: m.alcanceGranjas === "TODAS" ? [] : m.granjas.map(g => g.granjaId),
            unidades: m.alcanceUnidades === "TODAS" ? [] : m.unidades.map(u => u.unidadId),
            limiteCompraGs: m.limiteCompraGs === null ? null : m.limiteCompraGs.toString(),
            ajustes: m.permisosAjuste.map(a => ({ clave: a.permisoClave, efecto: a.efecto })),
            ultimoAcceso: m.perfil.ultimoAcceso?.toISOString() ?? null,
          }))}
          invitaciones={invitaciones.map(i => ({ ...i, expiraEn: i.expiraEn.toISOString(), rol: roles.find(r => r.id === i.rolId)?.nombre ?? "—" }))}
          rolesDetalle={roles.map(r => ({ id: r.id, codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion ?? "", permisos: r.permisos.map(p => p.permisoClave), miembros: r._count.miembros }))}
          puedeEditarRoles={puede(permisos, "equipo.roles.editar")}
          actividad={veActividad ? eventos.map(e => ({
            id: e.id, fecha: e.createdAt.toISOString(), actor: e.actorId ? (nombreActor.get(e.actorId) ?? "Persona eliminada") : "Sistema",
            accion: e.accion, entidad: e.entidad, ip: e.ip,
            detalle: e.detalle && typeof e.detalle === "object" && !Array.isArray(e.detalle) ? e.detalle as Record<string, unknown> : {},
          })) : null}
          transferir={permisos.esPropietario ? {
            nombreOrg: org?.farmName ?? "",
            tieneSegundoFactor: session.aal === "aal2",
            candidatos: miembros.filter(m => !m.esPropietario && m.estado === "ACTIVO" && m.perfil.tipoAcceso !== "GESTIONADA").map(m => ({ id: m.id, nombre: m.perfil.name })),
          } : null}
          solicitudes={solicitudes.map(s => {
            const p = perfilesSolicitud.find(x => x.id === s.userId);
            return { id: s.id, nombre: p?.name ?? "—", email: p?.email ?? "", mensaje: s.mensaje ?? "", fecha: s.createdAt.toISOString() };
          })}
        />
      </div>
    </>
  );
}
