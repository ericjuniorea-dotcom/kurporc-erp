/**
 * Auditoría de consistencia de una granja (solo lectura).
 *   AUDITAR=<id de organización> npm run auditoria:granja
 * Sale con código 1 si hay errores.
 */
import { PrismaClient } from "@prisma/client";
import { auditarGranja } from "../src/lib/auditoria/granja";

const prisma = new PrismaClient();

async function main() {
  const org = process.env.AUDITAR;
  if (!org) throw new Error("Falta AUDITAR=<id de organización>");
  const t = await prisma.tenant.findUnique({ where: { id: org }, select: { farmName: true } });
  if (!t) throw new Error("No existe la organización");
  const h = await auditarGranja(prisma, org);
  const errores = h.filter(x => x.severidad === "ERROR"), avisos = h.filter(x => x.severidad === "AVISO");
  console.log(`Auditoría de «${t.farmName}»: ${errores.length} errores · ${avisos.length} avisos`);
  const porRegla = new Map<string, typeof h>();
  for (const x of h) porRegla.set(`${x.severidad} · ${x.regla}`, [...(porRegla.get(`${x.severidad} · ${x.regla}`) ?? []), x]);
  for (const [regla, xs] of Array.from(porRegla).sort()) {
    console.log(`\n${regla} (${xs.length})`);
    for (const x of xs.slice(0, 12)) console.log(`  - ${x.detalle}`);
    if (xs.length > 12) console.log(`  … y ${xs.length - 12} más`);
  }
  if (errores.length) process.exitCode = 1;
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
