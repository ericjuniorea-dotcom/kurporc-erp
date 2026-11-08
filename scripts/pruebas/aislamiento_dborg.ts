/**
 * Prueba de la Fase 7 (parte 2): el cliente dbOrg no deja ver ni tocar datos de otra organización.
 *   DATABASE_URL=postgresql://...localhost... npm run prueba:dborg
 */
import { PrismaClient } from "@prisma/client";
import { crearOrganizacion } from "@/lib/organizaciones/crear";
import { dbOrg } from "@/lib/db/org";
import { quitarMontos } from "@/lib/permisos/montos";

const prisma = new PrismaClient();
function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
async function falla(p: Promise<unknown>) { try { await p; return false; } catch { return true; } }

async function main() {
  if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL ?? "")) throw new Error("Esta prueba solo corre contra una base local");
  const t = Date.now();
  const ua = await prisma.user.create({ data: { id: `pd-a-${t}`, email: `a.${t}@prueba.test`, name: "Dueño A" } });
  const ub = await prisma.user.create({ data: { id: `pd-b-${t}`, email: `b.${t}@prueba.test`, name: "Dueño B" } });
  const { id: A } = await crearOrganizacion(ua.id, { tipo: "EMPRESA", nombre: `Aislamiento A ${t}`, departamento: "Misiones", claveCreacion: crypto.randomUUID() });
  const { id: B } = await crearOrganizacion(ub.id, { tipo: "EMPRESA", nombre: `Aislamiento B ${t}`, departamento: "Misiones", claveCreacion: crypto.randomUUID() });
  const dbA = dbOrg(A, ua.id), dbB = dbOrg(B, ub.id);
  try {
    const cerda = await dbA.sow.create({ data: { identCode: `PRUEBA-${t}`, purchasePriceGs: 2500000 } as never });
    check(cerda.tenantId === A, "un alta sin tenantId queda en la organización del cliente");
    check((await dbA.sow.findMany({ where: { identCode: `PRUEBA-${t}` } })).length === 1, "la organización A ve su cerda");
    check((await dbB.sow.findMany({ where: { identCode: `PRUEBA-${t}` } })).length === 0, "la organización B NO la ve en un listado");
    check(await dbB.sow.findUnique({ where: { id: cerda.id } }) === null, "B NO la ve aunque conozca el id");
    check(await dbB.sow.count({ where: { id: cerda.id } }) === 0, "B NO la cuenta");
    check(await falla(dbB.sow.update({ where: { id: cerda.id }, data: { identCode: "HACKEADA" } })), "B NO la puede modificar");
    check((await dbB.sow.deleteMany({ where: { id: cerda.id } })).count === 0, "B NO la puede borrar en masa");
    check(await falla(dbB.sow.delete({ where: { id: cerda.id } })), "B NO la puede borrar por id");
    check(await falla(dbB.sow.create({ data: { tenantId: A, identCode: `INTRUSA-${t}` } as never })), "B NO puede dar de alta en A");
    check(await falla(dbA.sow.update({ where: { id: cerda.id }, data: { tenantId: B } as never })), "A NO puede mover su cerda a B");
    check((await prisma.sow.findUnique({ where: { id: cerda.id } }))?.identCode === `PRUEBA-${t}`, "la cerda sigue intacta");
    check((await dbA.granja.findMany()).every(g => g.organizacionId === A), "las tablas con organizacionId también se filtran");

    const sinMontos = quitarMontos({ lista: [{ identCode: "X", purchasePriceGs: 10, pesoKg: 200 }], valorTotalInventario: 5, stock: 3 });
    check(sinMontos.lista[0].purchasePriceGs === null && sinMontos.valorTotalInventario === null, "sin permiso de costos, los montos salen en null");
    check(sinMontos.lista[0].pesoKg === 200 && sinMontos.stock === 3, "lo que no es plata queda igual");
    console.log("\nOK — aislamiento por organización verificado");
  } finally {
    for (const org of [A, B]) {
      await prisma.sow.deleteMany({ where: { tenantId: org } });
      for (const tabla of ["feedType", "healthProtocolConfig"] as const) await (prisma[tabla] as any).deleteMany({ where: { tenantId: org } });
      await prisma.tenant.delete({ where: { id: org } });
    }
    await prisma.user.updateMany({ where: { id: { in: [ua.id, ub.id] } }, data: { tenantId: null } });
    await prisma.userRole.deleteMany({ where: { userId: { in: [ua.id, ub.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ua.id, ub.id] } } });
    await prisma.$disconnect();
  }
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); });
