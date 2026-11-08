/**
 * Prueba de la Fase 6: alta de organizaciones (solo contra una base de prueba).
 *   DATABASE_URL=postgresql://...localhost... npm run prueba:alta
 */
import { PrismaClient } from "@prisma/client";
import { crearOrganizacion } from "@/lib/organizaciones/crear";
import { normalizarRuc } from "@/lib/validaciones/ruc";

const prisma = new PrismaClient();
function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Esta prueba solo corre contra una base local");

  check(normalizarRuc("4799016-3") === "4799016-3", "RUC válido con dígito verificador");
  check(normalizarRuc("4.799.016-3") === "4799016-3", "RUC con puntos se normaliza");
  check(normalizarRuc("4799016-4") === null, "RUC con dígito verificador incorrecto se rechaza");
  check(normalizarRuc("123-4") === null, "RUC demasiado corto se rechaza");

  const u = await prisma.user.create({ data: { id: `prueba-${Date.now()}`, email: `alta.${Date.now()}@prueba.test`, name: "Persona de prueba" } });
  try {
    const clave = crypto.randomUUID();
    const a = await crearOrganizacion(u.id, { tipo: "INDIVIDUAL", nombre: "Granja de Prueba Ñandutí", departamento: "Misiones", madresAprox: 40, sistemaProductivo: "CICLO_COMPLETO", claveCreacion: clave });
    check(a.creada, "granja individual creada");
    const b = await crearOrganizacion(u.id, { tipo: "INDIVIDUAL", nombre: "Granja de Prueba Ñandutí", departamento: "Misiones", claveCreacion: clave });
    check(!b.creada && b.id === a.id, "reenviar el mismo formulario no duplica la organización");

    const org = await prisma.tenant.findUnique({ where: { id: a.id }, include: { granjas: true, unidades: true, roles: true, miembros: true } });
    check(org?.tipo === "INDIVIDUAL" && org.slug === "granja-de-prueba-nanduti", `slug sin tildes: ${org?.slug}`);
    check(org?.granjas.length === 1, "una granja");
    check(org?.unidades.map(x => x.codigo).sort().join(",") === "COMUN,GRANJA-GRANJA-DE-PRUEBA-NANDUTI".replace("GRANJA-GRANJA-", "GRANJA-"), `unidades: ${org?.unidades.map(x => x.codigo).join(", ")}`);
    check(org?.roles.length === 13, `13 roles de ERP copiados (${org?.roles.length})`);
    check(org?.miembros.length === 1 && org.miembros[0].esPropietario, "la persona es propietaria");
    check(await prisma.feedType.count({ where: { tenantId: a.id } }) === 6, "6 etapas de alimentación");
    check(await prisma.healthProtocolConfig.count({ where: { tenantId: a.id } }) === 1, "protocolo sanitario por defecto");
    check(await prisma.userRole.count({ where: { userId: u.id, roleId: 2 } }) === 1, "rol legado de Admin de granja para el menú");
    const perfil = await prisma.user.findUnique({ where: { id: u.id } });
    check(perfil?.onboardingCompleto && perfil.tenantId === a.id, "onboarding completo y organización principal");
    check(await prisma.historialCambio.count({ where: { tabla: "tenants", registroId: a.id, actorId: u.id } }) >= 1, "el alta quedó en el historial con el actor");

    const c = await crearOrganizacion(u.id, { tipo: "EMPRESA", nombre: "Agro Prueba SA", razonSocial: "Agro Prueba S.A.", ruc: "4799016-3", departamento: "Itapúa", nombreGranja: "Sitio 2", claveCreacion: crypto.randomUUID() });
    const emp = await prisma.tenant.findUnique({ where: { id: c.id }, include: { granjas: true } });
    check(emp?.tipo === "EMPRESA" && emp.granjas[0]?.nombre === "Sitio 2", "empresa con su primera granja");

    const d = await crearOrganizacion(u.id, { tipo: "VENDEDOR", nombre: "Insumos Prueba", razonSocial: "Insumos Prueba SRL", ruc: "4799016-3", departamento: "Central", categoriasVenta: ["Sanidad"], zonasEntrega: ["Central", "Misiones"], claveCreacion: crypto.randomUUID() });
    const tienda = await prisma.tenant.findUnique({ where: { id: d.id }, include: { granjas: true, roles: true } });
    check(tienda?.tipo === "VENDEDOR" && tienda.verificacion === "PENDIENTE", "tienda en verificación pendiente");
    check(tienda?.granjas.length === 0 && tienda.roles.length === 2, "tienda sin granja y con roles de tienda");
    console.log("\nOK — alta de organizaciones verificada");
  } finally {
    // limpieza (base de prueba)
    const orgs = await prisma.tenant.findMany({ where: { creadoPor: u.id }, select: { id: true } });
    for (const o of orgs) {
      await prisma.feedType.deleteMany({ where: { tenantId: o.id } });
      await prisma.healthProtocolConfig.deleteMany({ where: { tenantId: o.id } });
    }
    await prisma.user.update({ where: { id: u.id }, data: { tenantId: null } });
    await prisma.tenant.deleteMany({ where: { creadoPor: u.id } });
    await prisma.userRole.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
    await prisma.$disconnect();
  }
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); });
