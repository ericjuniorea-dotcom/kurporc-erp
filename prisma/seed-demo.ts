/**
 * Seed de datos demo para KurPorc ERP
 * Crea datos realistas para que todos los módulos muestren información
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  console.log("🐷  Cargando datos demo KurPorc...\n");

  // ── Obtener tenant demo ────────────────────────────────────────
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo-granja" } });
  if (!tenant) throw new Error("Tenant demo-granja no encontrado. Ejecutá npx prisma db seed primero.");
  const tid = tenant.id;

  // ── Obtener ubicación Maternidad y sus corrales ────────────────
  const matLocation = await prisma.farmLocation.findFirst({
    where: { tenantId: tid, name: "Sala Maternidad" },
    include: { pens: true },
  });
  if (!matLocation) throw new Error("Sala Maternidad no encontrada. Ejecutá el seed base primero.");
  const pens = matLocation.pens;

  // ── Obtener protocolo sanitario ────────────────────────────────
  const protocol = await prisma.healthProtocolConfig.findUnique({ where: { tenantId: tid } });
  if (!protocol) throw new Error("Protocolo sanitario no encontrado.");

  // ── 1. Crear tareas del protocolo (procedimientos fijos) ────────
  console.log("1. Protocolo sanitario - tareas de lechones...");
  const procedureDefs = [
    { taskType: "TAIL_DOCKING"  as const, taskName: "Descole",              dayOfLife: 1, sortOrder: 1 },
    { taskType: "TOOTH_CLIPPING" as const, taskName: "Limado de colmillos", dayOfLife: 1, sortOrder: 2 },
    { taskType: "CASTRATION"    as const, taskName: "Castración",           dayOfLife: 7, sortOrder: 3 },
    { taskType: "IRON_INJECTION" as const, taskName: "Hierro dextrano",     dayOfLife: 3, sortOrder: 4, doseMl: 1.0 },
  ];
  const protocolTasks: { id: string; dayOfLife: number }[] = [];
  for (const def of procedureDefs) {
    const existing = await prisma.healthProtocolTask.findFirst({
      where: { protocolId: protocol.id, taskType: def.taskType },
    });
    const pt = existing ?? await prisma.healthProtocolTask.create({
      data: {
        protocolId: protocol.id,
        taskType:   def.taskType,
        taskName:   def.taskName,
        dayOfLife:  def.dayOfLife,
        doseMl:     (def as any).doseMl ?? null,
        sortOrder:  def.sortOrder,
      },
    });
    protocolTasks.push({ id: pt.id, dayOfLife: pt.dayOfLife });
  }
  console.log(`   ✓ ${protocolTasks.length} tareas de protocolo listas\n`);

  // ── 2. Crear cerdas ────────────────────────────────────────────
  console.log("2. Creando cerdas...");
  const sowDefs = [
    // (identCode, breed, parityCount, entryDaysAgo)
    { code: "G-001", breed: "Landrace",    parity: 4, entry: 900 },
    { code: "G-002", breed: "Large White", parity: 3, entry: 750 },
    { code: "G-003", breed: "Landrace",    parity: 5, entry: 1100 },
    { code: "G-004", breed: "Híbrido F1",  parity: 2, entry: 600 },
    { code: "G-005", breed: "Large White", parity: 1, entry: 400 },
    { code: "G-006", breed: "Landrace",    parity: 3, entry: 700 },
    { code: "G-007", breed: "Híbrido F1",  parity: 4, entry: 850 },
    { code: "G-008", breed: "Large White", parity: 2, entry: 500 },
    { code: "G-009", breed: "Landrace",    parity: 6, entry: 1300 },
    { code: "G-010", breed: "Híbrido F1",  parity: 1, entry: 380 },
    { code: "G-011", breed: "Large White", parity: 3, entry: 720 },
    { code: "G-012", breed: "Landrace",    parity: 2, entry: 550 },
    { code: "G-013", breed: "Híbrido F1",  parity: 5, entry: 950 },
    { code: "G-014", breed: "Large White", parity: 4, entry: 800 },
    { code: "G-015", breed: "Landrace",    parity: 0, entry: 200 },
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sows: { id: string; code: string }[] = [];
  for (const def of sowDefs) {
    const existing = await prisma.sow.findUnique({ where: { tenantId_identCode: { tenantId: tid, identCode: def.code } } });
    const sow = existing ?? await prisma.sow.create({
      data: {
        tenantId:          tid,
        identCode:         def.code,
        breed:             def.breed,
        currentParityCount: def.parity,
        entryDate:         addDays(today, -def.entry),
      },
    });
    sows.push({ id: sow.id, code: def.code });
  }
  console.log(`   ✓ ${sows.length} cerdas creadas\n`);

  // ── 3. Lotes y eventos de servicio ────────────────────────────
  console.log("3. Batches de servicio y servicios...");
  // Semana ~110 días atrás (estas cerdas están a punto de parir o ya parieron)
  const w07Label = "2026-W07"; // ~Feb 10-16, parirían ~June 3-9 → estas ya parieron, activas en maternidad
  const w10Label = "2026-W10"; // ~March 3-9, parirían ~June 21-27 → DUE THIS WEEK
  const w14Label = "2026-W14"; // ~April 1-7, parirían ~July 24-30 → en gestación 82 días
  const w20Label = "2026-W20"; // ~May 12-18, parirían ~Sept 2-8 → en gestación 43 días

  const batchDates: Record<string, Date> = {
    [w07Label]: addDays(today, -130), // ~Feb 10
    [w10Label]: addDays(today, -107), // ~March 9
    [w14Label]: addDays(today, -84),  // ~April 1
    [w20Label]: addDays(today, -43),  // ~May 12
  };

  const batches: Record<string, string> = {};
  for (const label of [w07Label, w10Label, w14Label, w20Label]) {
    const existing = await prisma.serviceBatch.findFirst({ where: { tenantId: tid, weekLabel: label } });
    const b = existing ?? await prisma.serviceBatch.create({ data: { tenantId: tid, weekLabel: label } });
    batches[label] = b.id;
  }

  // Servicios por batch
  const serviceAssignments = [
    // W07 — ya parieron, activas en maternidad (G-001 a G-005)
    { sowIdx: 0, batch: w07Label, daysBack: 130 },
    { sowIdx: 1, batch: w07Label, daysBack: 129 },
    { sowIdx: 2, batch: w07Label, daysBack: 128 },
    { sowIdx: 3, batch: w07Label, daysBack: 130 },
    { sowIdx: 4, batch: w07Label, daysBack: 131 },
    // W10 — a punto de parir (G-006 a G-009)
    { sowIdx: 5, batch: w10Label, daysBack: 107 },
    { sowIdx: 6, batch: w10Label, daysBack: 108 },
    { sowIdx: 7, batch: w10Label, daysBack: 106 },
    { sowIdx: 8, batch: w10Label, daysBack: 107 },
    // W14 — en gestación 80+ días (G-010 a G-012)
    { sowIdx: 9,  batch: w14Label, daysBack: 82 },
    { sowIdx: 10, batch: w14Label, daysBack: 83 },
    { sowIdx: 11, batch: w14Label, daysBack: 81 },
    // W20 — recién servidas (G-013 a G-015)
    { sowIdx: 12, batch: w20Label, daysBack: 43 },
    { sowIdx: 13, batch: w20Label, daysBack: 44 },
    { sowIdx: 14, batch: w20Label, daysBack: 42 },
  ];

  const serviceEvents: Record<string, { id: string; sowIdx: number; serviceDate: Date }> = {};
  for (const sa of serviceAssignments) {
    const sow = sows[sa.sowIdx];
    const serviceDate = addDays(today, -sa.daysBack);
    const existing = await prisma.serviceEvent.findFirst({ where: { tenantId: tid, sowId: sow.id } });
    const se = existing ?? await prisma.serviceEvent.create({
      data: {
        tenantId:      tid,
        sowId:         sow.id,
        serviceBatchId: batches[sa.batch],
        serviceDate,
        serviceType:   "AI",
      },
    });
    serviceEvents[sow.id] = { id: se.id, sowIdx: sa.sowIdx, serviceDate };
  }
  console.log(`   ✓ ${Object.keys(serviceEvents).length} servicios creados\n`);

  // ── 4. Partos activos en Maternidad ───────────────────────────
  console.log("4. Partos activos en Maternidad...");
  // Las cerdas W07 (G-001 a G-005) parieron hace ~14-20 días
  const farrowingDefs = [
    { sowIdx: 0, daysAgo: 20, bornAlive: 13, bornDead: 1, totalWeightKg: 16.9, penIdx: 0 },
    { sowIdx: 1, daysAgo: 18, bornAlive: 11, bornDead: 0, totalWeightKg: 14.3, penIdx: 1 },
    { sowIdx: 2, daysAgo: 16, bornAlive: 14, bornDead: 2, totalWeightKg: 18.2, penIdx: 2 },
    { sowIdx: 3, daysAgo: 14, bornAlive: 12, bornDead: 1, totalWeightKg: 15.6, penIdx: 3 },
    { sowIdx: 4, daysAgo: 12, bornAlive: 10, bornDead: 0, totalWeightKg: 13.0, penIdx: 4 },
  ];

  const farrowingIds: string[] = [];
  for (const def of farrowingDefs) {
    const sow = sows[def.sowIdx];
    const svEvent = serviceEvents[sow.id];
    const startDatetime = addDays(today, -def.daysAgo);
    startDatetime.setHours(6 + def.daysAgo % 4, 30, 0, 0);

    const existing = await prisma.farrowingEvent.findFirst({ where: { tenantId: tid, sowId: sow.id } });
    if (existing) { farrowingIds.push(existing.id); continue; }

    const totalBorn = def.bornAlive + def.bornDead;
    const avgWeight = Math.round((def.totalWeightKg / def.bornAlive) * 1000) / 1000;
    const gestDays  = svEvent ? Math.floor((startDatetime.getTime() - svEvent.serviceDate.getTime()) / 86400000) : 115;

    const pen = pens[def.penIdx];

    const f = await prisma.farrowingEvent.create({
      data: {
        tenantId:            tid,
        sowId:               sow.id,
        serviceEventId:      svEvent?.id ?? undefined,
        startDatetime,
        bornAlive:           def.bornAlive,
        bornDead:            def.bornDead,
        mummified:           0,
        totalBorn,
        totalLitterWeightKg: def.totalWeightKg,
        avgPigletWeightKg:   avgWeight,
        gestationDays:       gestDays,
        penId:               pen?.id ?? undefined,
      },
    });
    farrowingIds.push(f.id);

    // Incrementar paridad
    await prisma.sow.update({ where: { id: sow.id }, data: { currentParityCount: { increment: 1 } } });

    // Crear algunas muertes para simular bajas
    if (def.sowIdx === 1) {
      await prisma.pigletDeath.create({
        data: {
          tenantId:     tid,
          farrowingId:  f.id,
          deathDatetime: addDays(today, -(def.daysAgo - 2)),
          quantity:     1,
          cause:        "CRUSHING",
        },
      });
    }
  }
  console.log(`   ✓ ${farrowingIds.length} partos activos creados\n`);

  // ── 5. Tareas sanitarias para los partos ──────────────────────
  console.log("5. Tareas sanitarias...");
  for (let i = 0; i < farrowingIds.length; i++) {
    const fid = farrowingIds[i];
    const daysAgo = farrowingDefs[i].daysAgo;
    const farrowingDate = addDays(today, -daysAgo);

    for (const pt of protocolTasks) {
      const dueDate = addDays(farrowingDate, pt.dayOfLife);
      const isCompleted = daysAgo - pt.dayOfLife > 2; // completada si ya pasó el día

      const existingTask = await prisma.healthTask.findFirst({ where: { tenantId: tid, farrowingId: fid, protocolTaskId: pt.id } });
      if (existingTask) continue;

      await prisma.healthTask.create({
        data: {
          tenantId:      tid,
          farrowingId:   fid,
          protocolTaskId: pt.id,
          dueDate,
          isCompleted,
          completedAt:   isCompleted ? addDays(dueDate, 0) : null,
        },
      });
    }
  }
  console.log("   ✓ Tareas sanitarias creadas\n");

  // ── 6. Lotes de Recría ────────────────────────────────────────
  console.log("6. Lotes de Recría...");

  // Crear ubicación Recría si no existe
  let recriaLocation = await prisma.farmLocation.findFirst({ where: { tenantId: tid, name: "Sala Recría" } });
  if (!recriaLocation) {
    recriaLocation = await prisma.farmLocation.create({
      data: { tenantId: tid, name: "Sala Recría", locationType: "NURSERY" },
    });
    for (let i = 1; i <= 6; i++) {
      await prisma.pen.create({
        data: { tenantId: tid, locationId: recriaLocation.id, number: `R${i}`, capacity: 30 },
      });
    }
  }

  const nurseryLotDefs = [
    { code: "R-2026-W04-001", phase: "PHASE_1" as const, count: 58, daysAgo: 30, avgKg: 8.4 },
    { code: "R-2026-W08-001", phase: "PHASE_2" as const, count: 43, daysAgo: 55, avgKg: 22.5 },
  ];
  const nurseryIds: string[] = [];
  for (const def of nurseryLotDefs) {
    const existing = await prisma.nurseryBatch.findFirst({ where: { tenantId: tid, batchCode: def.code } });
    const nb = existing ?? await prisma.nurseryBatch.create({
      data: {
        tenantId:       tid,
        batchCode:      def.code,
        phase:          def.phase,
        entryDate:      addDays(today, -def.daysAgo),
        currentCount:   def.count,
        avgWeightKg:    def.avgKg,
        currentWeightKg: def.avgKg * def.count,
      },
    });
    nurseryIds.push(nb.id);

    // Registros de peso
    const wDates = [def.daysAgo, Math.floor(def.daysAgo * 0.6), Math.floor(def.daysAgo * 0.3)];
    for (const d of wDates) {
      const factor = (def.daysAgo - d) / def.daysAgo;
      const avgWt  = Number((def.avgKg * (0.4 + 0.6 * (1 - factor))).toFixed(2));
      const existing = await prisma.weightRecord.findFirst({
        where: { tenantId: tid, nurseryBatchId: nb.id, recordDate: addDays(today, -d) },
      });
      if (!existing) {
        await prisma.weightRecord.create({
          data: {
            tenantId:       tid,
            nurseryBatchId: nb.id,
            recordDate:     addDays(today, -d),
            avgWeightKg:    avgWt,
            totalWeightKg:  Number((avgWt * def.count).toFixed(1)),
            animalCount:    def.count,
            dailyGainKg:    Number((0.38 + (d % 7) * 0.01).toFixed(3)),
          },
        });
      }
    }
  }
  console.log(`   ✓ ${nurseryIds.length} lotes de recría con registros de peso\n`);

  // ── 7. Materias Primas ────────────────────────────────────────
  console.log("7. Materias primas...");
  const rawMatDefs = [
    { name: "Maíz amarillo",         type: "ENERGY"   as const, minStock: 5000, lots: [{ code: "MAZ-2026-001", qty: 8000, remain: 5200, price: 1850, protein: 8.2 }] },
    { name: "Harina de soja 47%",    type: "PROTEIN"  as const, minStock: 3000, lots: [{ code: "SOJ-2026-001", qty: 4000, remain: 2800, price: 4200, protein: 47.5 }] },
    { name: "Núcleo vitamínico VHP",  type: "NUCLEUS"  as const, minStock: 500,  lots: [{ code: "NUC-2026-001", qty: 800,  remain: 620,  price: 12000, protein: null }] },
    { name: "Calcáreo calcítico",     type: "MINERAL"  as const, minStock: 200,  lots: [{ code: "CAL-2026-001", qty: 1000, remain: 880,  price: 350, protein: null }] },
  ];

  const rawMaterialIds: { id: string; name: string }[] = [];
  let mpSeq = 1;
  for (const def of rawMatDefs) {
    let rm = await prisma.productoInventario.findFirst({ where: { tenantId: tid, nombre: def.name, categoria: "MATERIA_PRIMA" } });
    if (!rm) {
      rm = await prisma.productoInventario.create({
        data: {
          tenantId: tid, nombre: def.name, categoria: "MATERIA_PRIMA", materialType: def.type,
          codigo: `MP-${String(mpSeq++).padStart(3, "0")}`, unidadMedida: "KG", stockMinimo: def.minStock,
          enfermedad: "", sectorDestino: "produccion",
        },
      });
    }
    rawMaterialIds.push({ id: rm.id, name: rm.nombre });

    for (const lot of def.lots) {
      const existingLot = await prisma.loteInventario.findFirst({ where: { tenantId: tid, vacunaId: rm.id, numeroLote: lot.code } });
      if (!existingLot) {
        await prisma.loteInventario.create({
          data: {
            tenantId:         tid,
            vacunaId:         rm.id,
            numeroLote:       lot.code,
            fechaIngreso:     addDays(today, -15),
            fechaVencimiento: addDays(today, 365 * 2),
            cantidadInicial:  lot.qty,
            cantidadActual:   lot.remain,
            nutricion: {
              create: { pricePerKg: lot.price, crudProteinPct: lot.protein ?? undefined },
            },
          },
        });
      }
    }
  }
  console.log(`   ✓ ${rawMaterialIds.length} materias primas con lotes\n`);

  // ── 8. Fórmulas de Balanceado ─────────────────────────────────
  console.log("8. Fórmulas de balanceado...");
  const feedTypeGes = await prisma.feedType.findFirst({ where: { tenantId: tid, phase: "GESTATION" } });
  const feedTypeLac = await prisma.feedType.findFirst({ where: { tenantId: tid, phase: "LACTATION" } });

  const maiz   = rawMaterialIds.find((r) => r.name.includes("Maíz"))!;
  const soja   = rawMaterialIds.find((r) => r.name.includes("soja"))!;
  const nucleo = rawMaterialIds.find((r) => r.name.includes("Núcleo"))!;
  const calcit = rawMaterialIds.find((r) => r.name.includes("Calcáreo"))!;

  const formulaDefs = [
    {
      name: "Fórmula Gestación v1",
      feedTypeId: feedTypeGes?.id,
      ingredients: [
        { rawMaterialId: maiz.id,   inclusionPct: 70.00 },
        { rawMaterialId: soja.id,   inclusionPct: 22.00 },
        { rawMaterialId: nucleo.id, inclusionPct: 4.00  },
        { rawMaterialId: calcit.id, inclusionPct: 4.00  },
      ],
      nutrition: { protein: 16.2, energy: 3100, lysine: 0.82, methionine: 0.28, calcium: 0.90, phosphorus: 0.45, moisture: 12.0, mycotoxin: 80 },
    },
    {
      name: "Fórmula Lactación v1",
      feedTypeId: feedTypeLac?.id,
      ingredients: [
        { rawMaterialId: maiz.id,   inclusionPct: 62.00 },
        { rawMaterialId: soja.id,   inclusionPct: 30.00 },
        { rawMaterialId: nucleo.id, inclusionPct: 4.50  },
        { rawMaterialId: calcit.id, inclusionPct: 3.50  },
      ],
      nutrition: { protein: 18.5, energy: 3250, lysine: 1.05, methionine: 0.35, calcium: 0.95, phosphorus: 0.50, moisture: 11.5, mycotoxin: 65 },
    },
  ];

  for (const def of formulaDefs) {
    if (!def.feedTypeId) continue;
    let formula = await prisma.formula.findFirst({ where: { tenantId: tid, name: def.name } });
    if (!formula) {
      formula = await prisma.formula.create({
        data: { tenantId: tid, feedTypeId: def.feedTypeId, name: def.name, isActive: true },
      });
    }

    const existingVer = await prisma.formulaVersion.findFirst({ where: { tenantId: tid, formulaId: formula.id } });
    if (!existingVer) {
      const version = await prisma.formulaVersion.create({
        data: {
          tenantId:           tid,
          formulaId:          formula.id,
          versionNumber:      1,
          status:             "ACTIVE",
          approvedAt:         addDays(today, -5),
          totalProteinPct:    def.nutrition.protein,
          totalEnergyKcal:    def.nutrition.energy,
          totalLysinePct:     def.nutrition.lysine,
          totalMethioninePct: def.nutrition.methionine,
          totalCalciumPct:    def.nutrition.calcium,
          totalPhosphorusPct: def.nutrition.phosphorus,
          totalMoisturePct:   def.nutrition.moisture,
          totalMycotoxinPpb:  def.nutrition.mycotoxin,
          ingredients: {
            create: def.ingredients.map((ing) => ({
              rawMaterialId: ing.rawMaterialId,
              inclusionPct:  ing.inclusionPct,
            })),
          },
        },
      });
      console.log(`   ✓ ${def.name} — v${version.versionNumber} activa`);
    }
  }

  // ── Resumen ───────────────────────────────────────────────────
  console.log("\n✅  Datos demo cargados exitosamente!");
  console.log("─────────────────────────────────────────");
  console.log("  Módulo Gestación:   15 cerdas, 4 batches de servicio");
  console.log("  Módulo Maternidad:  5 partos activos con tareas sanitarias");
  console.log("  Módulo Sanidad:     Tareas pendientes y completadas");
  console.log("  Módulo Recría:      2 lotes activos (Fase 1 y Fase 2)");
  console.log("  Módulo Balanceado:  4 materias primas, 2 fórmulas aprobadas");
  console.log("─────────────────────────────────────────");
  console.log("  Login: admin@kurporc.com / KurPorc2026!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
