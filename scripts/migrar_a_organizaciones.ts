/**
 * Fase 1 — Migra los datos actuales al modelo de organizaciones.
 * Idempotente: se puede correr las veces que haga falta sin duplicar nada.
 *
 *   npm run db:migrar-orgs
 *
 * 1. Carga el catálogo de permisos (Anexo A) y los roles plantilla globales (A.11).
 * 2. Por cada organización (tabla tenants):
 *    - crea una granja si no tiene ninguna y le asigna los sectores sin granja,
 *    - crea las unidades de negocio COMUN y GRANJA-<código> por granja,
 *    - copia los roles plantilla que todavía no tenga,
 *    - convierte cada usuario en miembro con el rol equivalente al legado.
 * 3. Super Administrador: correos de SUPERADMIN_EMAIL (separados por coma) y
 *    usuarios con el rol legado "Super Admin" (id 1) → admin_plataforma.
 *
 * No borra ni modifica datos productivos. Lo que ya existe (miembros, roles de
 * la organización) no se pisa: solo se agrega lo que falta.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { CATALOGO_PERMISOS } from "../src/lib/permisos/catalogo";
import { ROLES_PLANTILLA, ROL_LEGADO_A_PLANTILLA } from "../src/lib/permisos/roles-plantilla";

const prisma = new PrismaClient();
const log = (...a: unknown[]) => console.log("  ", ...a);

function codigoDesde(texto: string): string {
  return texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .replace(/^GRANJA-/, "").slice(0, 40) || "PRINCIPAL";
}

async function sincronizarCatalogo() {
  for (const p of CATALOGO_PERMISOS) {
    const data = {
      modulo: p.modulo, recurso: p.recurso, accion: p.accion, grupo: p.grupo,
      descripcion: p.descripcion, sensible: p.sensible, soloPropietario: p.soloPropietario, orden: p.orden,
    };
    await prisma.permiso.upsert({ where: { clave: p.clave }, create: { clave: p.clave, ...data }, update: data });
  }
  const sobrantes = await prisma.permiso.findMany({
    where: { clave: { notIn: CATALOGO_PERMISOS.map(p => p.clave) } }, select: { clave: true },
  });
  log(`Catálogo: ${CATALOGO_PERMISOS.length} permisos.` + (sobrantes.length ? ` En la base hay ${sobrantes.length} que ya no están en el código (no se borran): ${sobrantes.map(s => s.clave).join(", ")}` : ""));
}

async function sincronizarPlantillasGlobales() {
  for (const r of ROLES_PLANTILLA) {
    // unique([organizacionId, codigo]) no protege los null en Postgres → buscar a mano
    let rol = await prisma.rol.findFirst({ where: { organizacionId: null, codigo: r.codigo } });
    if (!rol) {
      rol = await prisma.rol.create({ data: { codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion, esSistema: true } });
    } else {
      await prisma.rol.update({ where: { id: rol.id }, data: { nombre: r.nombre, descripcion: r.descripcion, esSistema: true } });
    }
    // Las plantillas globales siempre reflejan exactamente el código
    await prisma.rolPermiso.deleteMany({ where: { rolId: rol.id, permisoClave: { notIn: r.permisos } } });
    await prisma.rolPermiso.createMany({ data: r.permisos.map(permisoClave => ({ rolId: rol!.id, permisoClave })), skipDuplicates: true });
  }
  log(`Roles plantilla globales: ${ROLES_PLANTILLA.length}.`);
}

async function migrarOrganizacion(tenant: { id: string; slug: string; farmName: string; creadoPor: string | null }) {
  console.log(`\n▸ ${tenant.farmName} (${tenant.slug})`);

  // ── Granja ──────────────────────────────────────────────────────
  let granjas = await prisma.granja.findMany({ where: { organizacionId: tenant.id } });
  if (granjas.length === 0) {
    const g = await prisma.granja.create({
      data: { organizacionId: tenant.id, codigo: codigoDesde(tenant.farmName), nombre: tenant.farmName },
    });
    granjas = [g];
    log(`Granja creada: ${g.nombre} (${g.codigo}).`);
  }
  if (granjas.length === 1) {
    const { count } = await prisma.farmLocation.updateMany({
      where: { tenantId: tenant.id, granjaId: null }, data: { granjaId: granjas[0].id },
    });
    if (count) log(`${count} sector(es) asignados a la granja ${granjas[0].codigo}.`);
  } else {
    const sinGranja = await prisma.farmLocation.count({ where: { tenantId: tenant.id, granjaId: null } });
    if (sinGranja) log(`ATENCIÓN: ${sinGranja} sector(es) sin granja y hay varias granjas: asignalos a mano.`);
  }

  // ── Unidades de negocio ────────────────────────────────────────
  const unidades: Prisma.UnidadNegocioCreateManyInput[] = [
    { organizacionId: tenant.id, codigo: "COMUN", nombre: "Común", tipo: "COMUN" },
    ...granjas.map(g => ({
      organizacionId: tenant.id, codigo: `GRANJA-${g.codigo}`, nombre: g.nombre, tipo: "GRANJA" as const, granjaId: g.id,
    })),
  ];
  const u = await prisma.unidadNegocio.createMany({ data: unidades, skipDuplicates: true });
  if (u.count) log(`${u.count} unidad(es) de negocio creadas.`);

  // ── Roles de la organización (copia de las plantillas) ─────────
  const rolesOrg = new Map<string, string>();
  for (const r of ROLES_PLANTILLA) {
    let rol = await prisma.rol.findFirst({ where: { organizacionId: tenant.id, codigo: r.codigo } });
    if (!rol) {
      rol = await prisma.rol.create({
        data: {
          organizacionId: tenant.id, codigo: r.codigo, nombre: r.nombre, descripcion: r.descripcion, esSistema: true,
          permisos: { createMany: { data: r.permisos.map(permisoClave => ({ permisoClave })) } },
        },
      });
      log(`Rol copiado: ${r.nombre}.`);
    }
    rolesOrg.set(r.codigo, rol.id);
  }
  const permisosPorCodigo = new Map(ROLES_PLANTILLA.map(r => [r.codigo, new Set(r.permisos)]));

  // ── Usuarios → miembros ────────────────────────────────────────
  const usuarios = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    include: { userRoles: { select: { roleId: true } } },
    orderBy: { createdAt: "asc" },
  });
  const legados = (u: (typeof usuarios)[number]) => new Set(u.userRoles.map(r => r.roleId));
  const yaHayPropietario = await prisma.miembro.count({ where: { organizacionId: tenant.id, esPropietario: true } }) > 0;
  const propietarioId = yaHayPropietario ? null
    : (usuarios.find(u => legados(u).has(2)) ?? usuarios.find(u => legados(u).has(1) || legados(u).has(3)) ?? usuarios[0])?.id ?? null;

  for (const usuario of usuarios) {
    const roles = legados(usuario);
    const plantillas = ROL_LEGADO_A_PLANTILLA.filter(([id]) => roles.has(id)).map(([, c]) => c);
    const principal = plantillas[0] ?? "SOLO_LECTURA";
    const esPropietario = usuario.id === propietarioId;

    const existente = await prisma.miembro.findUnique({
      where: { organizacionId_userId: { organizacionId: tenant.id, userId: usuario.id } },
    });
    if (existente) continue;

    const miembro = await prisma.miembro.create({
      data: {
        organizacionId: tenant.id, userId: usuario.id, rolId: rolesOrg.get(principal)!,
        esPropietario, estado: usuario.isActive ? "ACTIVO" : "SUSPENDIDO",
        limiteCompraGs: esPropietario ? null : BigInt(0),
      },
    });
    // Los roles legados eran acumulables: lo que aportan los secundarios se guarda como ajuste PERMITIR
    const base = permisosPorCodigo.get(principal)!;
    const extra = new Set<string>();
    for (const c of plantillas.slice(1)) for (const p of Array.from(permisosPorCodigo.get(c)!)) if (!base.has(p)) extra.add(p);
    if (extra.size) {
      await prisma.miembroPermiso.createMany({
        data: Array.from(extra).map(permisoClave => ({ miembroId: miembro.id, permisoClave, efecto: "PERMITIR" as const })),
        skipDuplicates: true,
      });
    }
    log(`Miembro: ${usuario.email} → ${principal}${esPropietario ? " (propietario)" : ""}${extra.size ? ` + ${extra.size} ajustes` : ""}.`);
  }

  // Perfiles migrados: ya usan el ERP, no pasan por el onboarding.
  // La aceptación del contrato la pide la Fase 4 en su próximo ingreso.
  await prisma.user.updateMany({
    where: { tenantId: tenant.id, tipoRegistro: "COMPRADOR" },
    data: { tipoRegistro: "EMPRESA", onboardingCompleto: true },
  });
  if (!tenant.creadoPor && propietarioId) {
    await prisma.tenant.update({ where: { id: tenant.id }, data: { creadoPor: propietarioId } });
  }
}

async function migrarSuperAdmins() {
  const correos = (process.env.SUPERADMIN_EMAIL ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  const candidatos = await prisma.user.findMany({
    where: { OR: [{ email: { in: correos } }, { userRoles: { some: { roleId: 1 } } }] },
    select: { id: true, email: true },
  });
  for (const c of candidatos) {
    await prisma.adminPlataforma.upsert({ where: { userId: c.id }, create: { userId: c.id, nivel: "TOTAL" }, update: {} });
  }
  const faltan = correos.filter(e => !candidatos.some(c => c.email.toLowerCase() === e));
  console.log(`\n▸ Super Administrador: ${candidatos.length} cuenta(s).` + (faltan.length ? ` No existen todavía: ${faltan.join(", ")}` : ""));
}

async function main() {
  console.log("Fase 1 — migración a organizaciones\n");
  await sincronizarCatalogo();
  await sincronizarPlantillasGlobales();
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, farmName: true, creadoPor: true } });
  for (const t of tenants) await migrarOrganizacion(t);
  await migrarSuperAdmins();
  console.log("\nListo.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
