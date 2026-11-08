/**
 * Prueba de la Fase 7: permisos efectivos (solo contra una base de prueba).
 *   DATABASE_URL=postgresql://...localhost... npm run prueba:permisos
 */
import { PrismaClient } from "@prisma/client";
import { crearOrganizacion } from "@/lib/organizaciones/crear";
import { permisosDeMiembro, puede } from "@/lib/permisos/servidor";

const prisma = new PrismaClient();
function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Esta prueba solo corre contra una base local");
  const t = Date.now();
  const dueno = await prisma.user.create({ data: { id: `pp-dueno-${t}`, email: `dueno.${t}@prueba.test`, name: "Dueño" } });
  const op = await prisma.user.create({ data: { id: `pp-op-${t}`, email: `op.${t}@prueba.test`, name: "Operario" } });
  const { id: org } = await crearOrganizacion(dueno.id, { tipo: "EMPRESA", nombre: `Permisos ${t}`, departamento: "Misiones", claveCreacion: crypto.randomUUID() });
  try {
    const pd = await permisosDeMiembro(dueno.id, org);
    check(pd?.esPropietario && puede(pd, "equipo.propiedad.transferir"), "el propietario tiene todo, incluso lo que es solo de propietario");
    check(puede(pd, "finanzas.tablero.ver") && puede(pd, "equipo.propiedad.transferir"), "propietario → incluso permisos solo-propietario");

    const rolOp = await prisma.rol.findFirst({ where: { organizacionId: org, codigo: "OPERARIO" } });
    const m = await prisma.miembro.create({ data: { organizacionId: org, userId: op.id, rolId: rolOp!.id } });
    let po = await permisosDeMiembro(op.id, org);
    check(puede(po, "gestacion.servicios.crear"), "operario puede registrar servicios");
    check(!puede(po, "gestacion.servicios.editar"), "operario NO puede corregir servicios");
    check(!puede(po, "finanzas.tablero.ver"), "operario NO ve finanzas");
    check(!puede(po, "sanidad.carencias.liberar"), "operario NO libera carencias");
    check(puede(po, "gestacion.servicios.ver"), "operario con permisos de gestación → ve Gestación");

    await prisma.miembroPermiso.createMany({ data: [
      { miembroId: m.id, permisoClave: "gestacion.servicios.crear", efecto: "DENEGAR" },
      { miembroId: m.id, permisoClave: "stock.items.ver", efecto: "PERMITIR" },
      { miembroId: m.id, permisoClave: "equipo.propiedad.transferir", efecto: "PERMITIR" },
    ] });
    po = await permisosDeMiembro(op.id, org);
    check(!puede(po, "gestacion.servicios.crear"), "un ajuste DENEGAR le gana al rol");
    check(puede(po, "stock.items.ver"), "un ajuste PERMITIR suma un permiso");
    check(!puede(po, "equipo.propiedad.transferir"), "un permiso solo de propietario nunca se delega, aunque haya ajuste");

    const granja = await prisma.granja.findFirst({ where: { organizacionId: org } });
    const otra = await prisma.granja.create({ data: { organizacionId: org, codigo: "OTRA", nombre: "Otra" } });
    await prisma.miembro.update({ where: { id: m.id }, data: { alcanceGranjas: "SELECCION" } });
    await prisma.miembroGranja.create({ data: { miembroId: m.id, granjaId: granja!.id } });
    po = await permisosDeMiembro(op.id, org);
    check(puede(po, "stock.items.ver", { granjaId: granja!.id }), "con alcance limitado ve su granja");
    check(!puede(po, "stock.items.ver", { granjaId: otra.id }), "con alcance limitado NO ve otra granja");

    await prisma.miembro.update({ where: { id: m.id }, data: { estado: "SUSPENDIDO" } });
    check(await permisosDeMiembro(op.id, org) === null, "suspendido = sin ningún permiso");
    check(await permisosDeMiembro(op.id, "org-inexistente") === null, "en una organización ajena no tiene permisos");
    console.log("\nOK — permisos de la Fase 7 verificados");
  } finally {
    for (const tabla of ["feedType", "healthProtocolConfig"] as const) await (prisma[tabla] as any).deleteMany({ where: { tenantId: org } });
    await prisma.user.updateMany({ where: { id: { in: [dueno.id, op.id] } }, data: { tenantId: null } });
    await prisma.tenant.delete({ where: { id: org } });
    await prisma.userRole.deleteMany({ where: { userId: { in: [dueno.id, op.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [dueno.id, op.id] } } });
    await prisma.$disconnect();
  }
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); });
