// Iniciación (recría): análisis de un lote para la ficha y las tarjetas de Visión general. Solo servidor.
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC } from "@/lib/finanzas/calculos";

const DIA = 86_400_000;

/** Metas de Iniciación (Configuración → Iniciación → Metas); valores por defecto si no están cargadas. */
export async function metasRecria(org: string) {
  const [metas, pf] = await Promise.all([
    prisma.configMeta.findMany({ where: { tenantId: org, modulo: "RECRIA" }, select: { kpiKey: true, valor: true } }),
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org }, select: { preInicial2KgLechon: true, inicialKgLechon: true } }),
  ]);
  const m = (k: string, d: number) => { const x = metas.find(v => v.kpiKey === k); return x ? Number(x.valor) : d; };
  return {
    diasFase: m("dias_en_fase", 42),
    mortalidadPct: m("mortalidad_pct_max", 1.5),
    pesoSalidaKg: m("peso_umbral_f2_engorde", 25),
    gdpF1: m("gmd_fase1_gdia", 350) / 1000, gdpF2: m("gmd_fase2_gdia", 550) / 1000,
    // Consumo esperado por animal en la fase: pre-inicial 2 + inicial (Finanzas → Parámetros)
    consumoAnimalKg: m("consumo_animal_kg", Number(pf?.preInicial2KgLechon ?? 4) + Number(pf?.inicialKgLechon ?? 35)),
  };
}

type Lote = Awaited<ReturnType<typeof cargar>>;
async function cargar(org: string, id: string) {
  return prisma.nurseryBatch.findFirst({
    where: { id, tenantId: org },
    include: {
      pen: { select: { number: true, location: { select: { name: true } } } },
      weanings: { select: { weaningDate: true, pigletsWeaned: true, avgPigletWeightKg: true, totalLitterWeightKg: true, lactationDays: true, farrowing: { select: { startDatetime: true, sow: { select: { id: true, identCode: true } } } } } },
      weightRecords: { orderBy: { recordDate: "asc" } },
      feedRecords: { select: { recordDate: true, quantityKg: true, feedType: { select: { name: true } } }, orderBy: { recordDate: "asc" } },
      sales: { orderBy: { saleDate: "asc" } },
      phaseChanges: { orderBy: { changeDate: "asc" } },
      growingBatches: { select: { id: true, batchCode: true, entryDate: true, entryWeightKg: true, currentCount: true,
        deaths: { select: { count: true } }, sales: { select: { animalCount: true } }, otherExits: { select: { count: true } },
        outgoingTransfers: { select: { count: true } }, incomingTransfers: { select: { count: true } } } },
    },
  });
}

export function indicadores(l: NonNullable<Lote>, muertes: { fecha: Date; cantidad: number; causa: string }[], metas: Awaited<ReturnType<typeof metasRecria>>, hoy = hoyUTC()) {
  // Entradas: destetes que formaron el lote (si no hay, se reconstruye desde el saldo)
  const destetados = l.weanings.reduce((s, w) => s + w.pigletsWeaned, 0);
  const transferencias = l.growingBatches.map(g => {
    const salidas = g.deaths.reduce((s, x) => s + x.count, 0) + g.sales.reduce((s, x) => s + x.animalCount, 0) + g.otherExits.reduce((s, x) => s + x.count, 0) + g.outgoingTransfers.reduce((s, x) => s + x.count, 0);
    const cantidad = g.currentCount + salidas - g.incomingTransfers.reduce((s, x) => s + x.count, 0);
    return { fecha: g.entryDate, cantidad, kg: Number(g.entryWeightKg), destino: g.batchCode, id: g.id };
  });
  const vendidos = l.sales.reduce((s, v) => s + v.animalCount, 0);
  const transferidos = transferencias.reduce((s, t) => s + t.cantidad, 0);
  const muertos = muertes.reduce((s, m) => s + m.cantidad, 0);
  const entrada = destetados || l.currentCount + muertos + vendidos + transferidos;
  // Peso de entrada: solo los destetes con peso cargado (un 0 es "sin dato", no 0 kg)
  const conPeso = l.weanings.filter(w => Number(w.totalLitterWeightKg) > 0 && w.pigletsWeaned > 0);
  const nConPeso = conPeso.reduce((s, w) => s + w.pigletsWeaned, 0);
  const pesoEntrada = nConPeso ? conPeso.reduce((s, w) => s + Number(w.totalLitterWeightKg), 0) / nConPeso : null;
  // Fecha media de nacimiento y edad media de entrada (ponderadas por lechones destetados)
  const nacMs = destetados ? l.weanings.reduce((s, w) => s + w.farrowing.startDatetime.getTime() * w.pigletsWeaned, 0) / destetados : null;
  const nacimientoMedio = nacMs === null ? null : new Date(nacMs);
  const edadEntrada = nacimientoMedio ? (l.entryDate.getTime() - nacimientoMedio.getTime()) / DIA : null;
  // Salidas: ventas y pases a engorde
  const salida = vendidos + transferidos;
  const kgSalida = l.sales.reduce((s, v) => s + Number(v.totalWeightKg), 0) + transferencias.reduce((s, t) => s + t.kg, 0);
  const pesoSalida = salida ? kgSalida / salida : null;
  const fechaSalidaMs = salida ? (l.sales.reduce((s, v) => s + v.saleDate.getTime() * v.animalCount, 0) + transferencias.reduce((s, t) => s + t.fecha.getTime() * t.cantidad, 0)) / salida : null;
  const edadSalida = nacimientoMedio && fechaSalidaMs ? (fechaSalidaMs - nacimientoMedio.getTime()) / DIA : null;
  // Pesajes: peso actual y ganancia diaria
  const ultimo = l.weightRecords[l.weightRecords.length - 1] ?? null;
  const pesoActual = ultimo ? Number(ultimo.avgWeightKg) : pesoEntrada;
  const fechaPeso = ultimo ? ultimo.recordDate : l.entryDate;
  const gdp = ultimo && pesoEntrada !== null && ultimo.recordDate > l.entryDate
    ? (Number(ultimo.avgWeightKg) - pesoEntrada) / ((ultimo.recordDate.getTime() - l.entryDate.getTime()) / DIA)
    : ultimo?.dailyGainKg ? Number(ultimo.dailyGainKg) : null;
  const diasFase = Math.max(0, Math.floor((hoy.getTime() - l.entryDate.getTime()) / DIA));
  const gdpUso = gdp ?? (l.phase === "PHASE_2" ? metas.gdpF2 : metas.gdpF1);
  const pesoHoy = pesoActual === null ? null : pesoActual + gdpUso * Math.max(0, (hoy.getTime() - fechaPeso.getTime()) / DIA);
  // Previsión de cierre: cuando el peso proyectado llega a la meta de salida (o por días, si no hay peso)
  const diasParaMeta = pesoHoy !== null && gdpUso > 0 ? Math.max(0, Math.ceil((metas.pesoSalidaKg - pesoHoy) / gdpUso)) : Math.max(0, metas.diasFase - diasFase);
  const cierrePrevisto = new Date(hoy.getTime() + diasParaMeta * DIA);
  const consumoKg = l.feedRecords.reduce((s, f) => s + Number(f.quantityKg), 0);
  const animalesProm = (entrada + l.currentCount) / 2 || 1;
  return {
    entrada, pesoEntrada, edadEntrada, nacimientoMedio, consumoKg, consumoAnimal: consumoKg ? consumoKg / animalesProm : null,
    muertos, mortalidad: entrada ? muertos / entrada : null, diasFase, salida, vendidos, transferidos, pesoSalida, edadSalida,
    pesoActual, fechaPeso, gdp, pesoHoy, diasParaMeta, cierrePrevisto, transferencias,
    cierrePor: (pesoHoy !== null && gdpUso > 0 ? "PESO" : "DIAS") as "PESO" | "DIAS",
  };
}

export async function analizarLoteRecria(org: string, id: string) {
  const l = await cargar(org, id);
  if (!l) return null;
  const [eventos, metas, vacunas] = await Promise.all([
    prisma.animalEvent.findMany({ where: { tenantId: org, eventType: "DEATH", moduleSource: "RECRIA", metadata: { path: ["batchId"], equals: id } }, orderBy: { eventDate: "asc" }, select: { eventDate: true, description: true, metadata: true } }),
    metasRecria(org),
    prisma.eventoVacunacion.findMany({ where: { tenantId: org, nurseryBatchId: id }, orderBy: { fecha: "asc" }, select: { id: true, fecha: true, estado: true, dosisNecesarias: true, vacuna: { select: { nombre: true } } } }),
  ]);
  const muertes = eventos.map(e => {
    const m = (e.metadata ?? {}) as { quantity?: number; cause?: string };
    return { fecha: e.eventDate, cantidad: Number(m.quantity ?? 1), causa: m.cause ?? e.description ?? "—" };
  });
  return { lote: l, metas, muertes, vacunas, ind: indicadores(l, muertes, metas) };
}

/** Tarjetas de Visión general: todos los lotes abiertos con sus días de alojamiento. */
export async function resumenLotesRecria(org: string) {
  const [lotes, metas] = await Promise.all([
    prisma.nurseryBatch.findMany({
      where: { tenantId: org, isActive: true }, orderBy: { entryDate: "asc" },
      select: { id: true, batchCode: true, phase: true, entryDate: true, currentCount: true, avgWeightKg: true,
        pen: { select: { number: true, location: { select: { name: true } } } },
        weightRecords: { orderBy: { recordDate: "desc" }, take: 1, select: { avgWeightKg: true, recordDate: true } } },
    }),
    metasRecria(org),
  ]);
  const hoy = hoyUTC();
  return {
    metas,
    lotes: lotes.map(l => ({
      id: l.id, codigo: l.batchCode, fase: l.phase, animales: l.currentCount,
      ubicacion: l.pen ? `${l.pen.location.name} · corral ${l.pen.number}` : null,
      dias: Math.max(0, Math.floor((hoy.getTime() - l.entryDate.getTime()) / DIA)),
      peso: l.weightRecords[0] ? Number(l.weightRecords[0].avgWeightKg) : l.avgWeightKg === null ? null : Number(l.avgWeightKg),
      fechaPeso: l.weightRecords[0]?.recordDate.toISOString().slice(0, 10) ?? null,
    })),
  };
}
