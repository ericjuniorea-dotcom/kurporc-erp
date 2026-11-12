/**
 * Cerdas dadas de baja: nunca pueden quedar en Maternidad ni en la agenda.
 *   npm run prueba:bajas   (con DATABASE_URL de una base de prueba; NODE_OPTIONS=--conditions=react-server)
 */
import prisma from "@/lib/db/prisma";
import { darDeBajaCerda, ErrorBaja } from "@/lib/plantel/baja";
import { idsCamadasAbiertas } from "@/lib/maternidad/camadas";
import { auditarGranja } from "@/lib/auditoria/granja";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
async function falla(p: Promise<unknown>) { try { await p; return null; } catch (e) { return e instanceof Error ? e.message : String(e); } }
const D = (s: string) => new Date(`${s}T12:00:00Z`);

async function main() {
  const usuario = await prisma.user.findFirstOrThrow({ select: { id: true } });
  const sufijo = Date.now().toString(36);
  const org = await prisma.tenant.create({ data: { slug: `prueba-bajas-${sufijo}`, farmName: `Granja bajas ${sufijo}`, tipo: "INDIVIDUAL" } });
  try {
    const conActor = <T,>(fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>) => prisma.$transaction(async tx => { await tx.$executeRaw`select set_config('app.actor_id', ${usuario.id}, true)`; return fn(tx); });
    const sow = (codigo: string) => prisma.sow.create({ data: { tenantId: org.id, identCode: codigo, entryDate: D("2026-01-14"), plantelState: "LACTATING" } });
    const [c74, c79] = await Promise.all([sow("74"), sow("79")]);
    const lote = await prisma.serviceBatch.create({ data: { tenantId: org.id, weekLabel: "2026-W19" } });
    const sv = async (sowId: string) => prisma.serviceEvent.create({ data: { tenantId: org.id, sowId, serviceBatchId: lote.id, serviceDate: D("2026-05-09"), serviceType: "AI" } });
    const [s74, s79] = await Promise.all([sv(c74.id), sv(c79.id)]);
    const parto = (sowId: string, serviceEventId: string, vivos: number) => prisma.farrowingEvent.create({ data: { tenantId: org.id, sowId, serviceEventId, startDatetime: D("2026-09-07"), bornAlive: vivos, totalBorn: vivos, totalLitterWeightKg: 0 } });
    const [p74, p79] = await Promise.all([parto(c74.id, s74.id, 15), parto(c79.id, s79.id, 4)]);
    const vac = await prisma.productoInventario.create({ data: { tenantId: org.id, nombre: `Vacuna ${sufijo}`, enfermedad: "—", sectorDestino: "cerda" } });
    await prisma.eventoVacunacion.create({ data: { tenantId: org.id, vacunaId: vac.id, sector: "maternidad", fecha: D("2026-09-20"), animalId: c74.id, estado: "pendiente" } });
    await prisma.task.create({ data: { tenantId: org.id, tipo: "vacuna", sector: "maternidad", alcance: "animal", titulo: "Vacunar 74", descripcion: "—", prioridad: "hoy", fechaVencimiento: D("2026-09-20"), animalId: c74.id } });

    check((await idsCamadasAbiertas(org.id)).length === 2, "las dos camadas con lechones están en Maternidad");

    // La 74 muere con 15 lechones a cargo: la baja se rechaza
    const e1 = await darDeBajaCerda({ tenantId: org.id, sowId: c74.id, userId: usuario.id, tipo: "MUERTE", fecha: D("2026-09-14"), motivo: "Infección" }).catch(e => e);
    check(e1 instanceof ErrorBaja && e1.codigo === "LECHONES_A_CARGO" && /15 lechones/.test(e1.message), "con 15 lechones a cargo, la baja se rechaza y explica qué hacer");

    // Se donan los 15 lechones a la 79 (conservan la trazabilidad: la adopción sale de la camada de la 74)
    await conActor(tx => tx.pigletMovement.create({ data: { tenantId: org.id, originId: p74.id, destinationId: p79.id, movementDate: D("2026-09-14"), quantity: 15 } }));
    const r = await darDeBajaCerda({ tenantId: org.id, sowId: c74.id, userId: usuario.id, tipo: "MUERTE", fecha: D("2026-09-14"), motivo: "Infección" });
    check(r.vacunasOmitidas === 1 && r.tareasCerradas === 1, "la baja omite su vacuna pendiente y cierra su tarea");
    const c = await prisma.sow.findUniqueOrThrow({ where: { id: c74.id } });
    check(!c.isActive && c.plantelState === "DEAD", "la 74 queda inactiva y muerta");
    check(!!(await prisma.sowDiscard.findFirst({ where: { sowId: c74.id } })), "con su registro de baja");
    const abiertas = await idsCamadasAbiertas(org.id);
    check(abiertas.length === 1 && abiertas[0] === p79.id, "Maternidad: solo la camada de la 79 (con 4 + 15 = 19 lechones)");
    check(!!(await prisma.pigletMovement.findFirst({ where: { originId: p74.id } })), "los lechones de la 74 siguen trazables en la adopción");

    // La base rechaza eventos después de la baja
    const e2 = await falla(conActor(tx => tx.serviceEvent.create({ data: { tenantId: org.id, sowId: c74.id, serviceBatchId: lote.id, serviceDate: D("2026-10-01"), serviceType: "AI" } })));
    check(e2 && /dada de baja/.test(e2), "la base rechaza un servicio posterior a la baja");
    const e3 = await falla(conActor(tx => tx.pigletMovement.create({ data: { tenantId: org.id, originId: p79.id, destinationId: p74.id, movementDate: D("2026-09-20"), quantity: 1 } })));
    check(e3 && /dada de baja/.test(e3), "la base rechaza darle lechones a una cerda de baja");
    const e4 = await falla(conActor(tx => tx.weaningEvent.create({ data: { tenantId: org.id, farrowingId: p74.id, weaningDate: D("2026-09-28"), lactationDays: 21, pigletsAvailable: 0, pigletsWeaned: 0, totalLitterWeightKg: 0, avgPigletWeightKg: 0 } })));
    check(e4 && /dada de baja/.test(e4), "la base rechaza un destete posterior a la baja");
    check(!(await falla(conActor(tx => tx.pregnancyCheck.create({ data: { tenantId: org.id, sowId: c74.id, serviceEventId: s74.id, checkDate: D("2026-06-03"), method: "ULTRASOUND", result: "PREGNANT" } })))),
      "un diagnóstico de antes de la baja sí se puede cargar (historia)");
    check(await darDeBajaCerda({ tenantId: org.id, sowId: c74.id, userId: usuario.id, tipo: "MUERTE", fecha: D("2026-09-15"), motivo: "x" }).catch(e => e instanceof ErrorBaja && e.codigo === "YA_DE_BAJA"), "no se da de baja dos veces");

    await prisma.sow.update({ where: { id: c79.id }, data: { plantelState: "LACTATING" } });
    const h = (await auditarGranja(prisma, org.id)).filter(x => x.severidad === "ERROR");
    check(h.length === 0, `auditoría sin errores${h.length ? `: ${h.map(x => x.detalle).join(" | ")}` : ""}`);
  } finally {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`select set_config('app.actor_id', ${usuario.id}, true)`;
      const w = { tenantId: org.id };
      await tx.task.deleteMany({ where: w }); await tx.eventoVacunacion.deleteMany({ where: w }); await tx.productoInventario.deleteMany({ where: w });
      await tx.animalEvent.deleteMany({ where: w }); await tx.pigletMovement.deleteMany({ where: w }); await tx.weaningEvent.deleteMany({ where: w });
      await tx.pregnancyCheck.deleteMany({ where: w }); await tx.farrowingEvent.deleteMany({ where: w }); await tx.serviceEvent.deleteMany({ where: w });
      await tx.serviceBatch.deleteMany({ where: w }); await tx.sowDiscard.deleteMany({ where: w }); await tx.sow.deleteMany({ where: w }); await tx.tenant.delete({ where: { id: org.id } });
    });
  }
  console.log("Todo bien.");
}

main().then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
