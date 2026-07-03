import { prisma } from "@/lib/db/prisma";

// ── Responsables ─────────────────────────────────────────────────────────────
export const RESPONSABLES = {
  veterinario: { nombre: "Dr. Erwin Segovia",             key: "erwin-segovia"   },
  gestacion:   { nombre: "Bartolomé Vera",                key: "bartolome-vera"  },
  maternidad:  { nombre: "Graciela Duarte",               key: "graciela-duarte" },
  produccion:  { nombre: "Dr. Alex Joaquín Almada Casco", key: "alex-almada"     },
  admin:       { nombre: "Ing. Eric Acosta",              key: "eric-acosta"     },
} as const;

const TIPOS_SANITARIOS = new Set([
  "vacuna-lechones", "vacuna-gestacion", "hierro-fe", "descolmillado",
  "castracion", "corte-cola", "tratamiento-curativo", "diagnostico-prenez",
  "repeticion-celo", "vacuna-mycoplasma", "vacuna-influenza", "vacuna-ecoli",
  "vacuna-circovirus",
]);

function getResponsable(tipo: string, sector: string) {
  if (TIPOS_SANITARIOS.has(tipo)) return RESPONSABLES.veterinario;
  if (sector === "gestacion")     return RESPONSABLES.gestacion;
  if (sector === "maternidad")    return RESPONSABLES.maternidad;
  return RESPONSABLES.produccion;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function calcPriority(dueDate: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(dueDate); due.setHours(0, 0, 0, 0);
  const diff  = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0)   return "urgente";
  if (diff === 0) return "hoy";
  return "programada";
}

interface TaskData {
  tenantId:         string;
  tipo:             string;
  sector:           string;
  alcance:          string;
  titulo:           string;
  descripcion:      string;
  instrucciones?:   string;
  fechaVencimiento: Date;
  animalId?:        string;
  farrowingId?:     string;
  nurseryBatchId?:  string;
  growingBatchId?:  string;
  targetLabel?:     string;
  disparador:       string;
  generadaPor?:     string;
}

async function upsertTask(data: TaskData) {
  const exists = await prisma.task.findFirst({
    where:  { tenantId: data.tenantId, disparador: data.disparador, tipo: data.tipo },
    select: { id: true },
  });
  if (exists) return;

  const resp = getResponsable(data.tipo, data.sector);
  await prisma.task.create({
    data: {
      ...data,
      prioridad:         calcPriority(data.fechaVencimiento),
      responsableNombre: resp.nombre,
      responsableKey:    resp.key,
      generadaPor:       data.generadaPor ?? "sistema",
    },
  });
}

// ── PARTO → tareas de maternidad ─────────────────────────────────────────────
export async function generarTareasParto(
  tenantId:    string,
  farrowingId: string,
  partoDate:   Date,
  sowLabel:    string,
) {
  const base = { tenantId, farrowingId, targetLabel: sowLabel };

  await Promise.all([
    upsertTask({ ...base,
      tipo: "descolmillado", sector: "maternidad", alcance: "camada",
      titulo:      `Descolmillado — ${sowLabel}`,
      descripcion: `Descolmillado a lechones recién nacidos (día 0 post-parto)`,
      instrucciones: "Usar alicate estéril. Cortar a nivel de encía sin lastimar encías.",
      fechaVencimiento: partoDate,
      disparador: `parto-${farrowingId}-descolmillado`,
    }),

    upsertTask({ ...base,
      tipo: "vacuna-ecoli", sector: "maternidad", alcance: "camada",
      titulo:      `Vacuna E. coli — ${sowLabel}`,
      descripcion: `Vacuna contra E. coli a lechones (día 1 post-parto)`,
      instrucciones: "Dosis según peso. Anotar lote y vencimiento del biológico.",
      fechaVencimiento: addDays(partoDate, 1),
      disparador: `parto-${farrowingId}-vacuna-ecoli`,
    }),

    upsertTask({ ...base,
      tipo: "hierro-fe", sector: "maternidad", alcance: "camada",
      titulo:      `Hierro Fe — ${sowLabel}`,
      descripcion: `Inyección de hierro dextrán a lechones (día 3 post-parto)`,
      instrucciones: "2 ml IM en cuello. Verificar ausencia de anemia.",
      fechaVencimiento: addDays(partoDate, 3),
      disparador: `parto-${farrowingId}-hierro-fe`,
    }),

    upsertTask({ ...base,
      tipo: "castracion", sector: "maternidad", alcance: "camada",
      titulo:      `Castración machos — ${sowLabel}`,
      descripcion: `Castración de lechones machos (días 3-7 post-parto)`,
      instrucciones: "Aplicar antiséptico. Verificar hemostasia completa antes de soltar.",
      fechaVencimiento: addDays(partoDate, 4),
      disparador: `parto-${farrowingId}-castracion`,
    }),

    upsertTask({ ...base,
      tipo: "vacuna-circovirus", sector: "maternidad", alcance: "camada",
      titulo:      `Vacuna Circovirus — ${sowLabel}`,
      descripcion: `Vacuna Circovirus porcino a lechones (día 7 post-parto)`,
      instrucciones: "Dosis SC/IM. Anotar lote de biológico.",
      fechaVencimiento: addDays(partoDate, 7),
      disparador: `parto-${farrowingId}-vacuna-circovirus`,
    }),

    upsertTask({ ...base,
      tipo: "destete", sector: "maternidad", alcance: "camada",
      titulo:      `Destete — ${sowLabel}`,
      descripcion: `Destete de camada (día 21 post-parto)`,
      instrucciones: "Pesar camada antes de separar. Registrar total destetados y kg promedio.",
      fechaVencimiento: addDays(partoDate, 21),
      disparador: `parto-${farrowingId}-destete`,
    }),
  ]);
}

// ── SERVICIO → tareas de gestación ───────────────────────────────────────────
export async function generarTareasServicio(
  tenantId:       string,
  serviceEventId: string,
  serviceDate:    Date,
  sowLabel:       string,
  animalId?:      string,
) {
  const base = { tenantId, animalId, targetLabel: sowLabel };

  await Promise.all([
    upsertTask({ ...base,
      tipo: "diagnostico-prenez", sector: "gestacion", alcance: "animal",
      titulo:      `Diagnóstico de preñez — ${sowLabel}`,
      descripcion: `Confirmar preñez por ecografía (28 días post-servicio)`,
      instrucciones: "Ecografía transabdominal. Registrar: Positivo/Negativo/Dudoso.",
      fechaVencimiento: addDays(serviceDate, 28),
      disparador: `servicio-${serviceEventId}-diagnostico`,
    }),

    upsertTask({ ...base,
      tipo: "vacuna-gestacion", sector: "gestacion", alcance: "animal",
      titulo:      `Vacuna gestación — ${sowLabel}`,
      descripcion: `Vacuna Parvovirus + Erisipela (día 42 post-servicio)`,
      instrucciones: "2 ml IM. Verificar protocolo de vacunación del plantel.",
      fechaVencimiento: addDays(serviceDate, 42),
      disparador: `servicio-${serviceEventId}-vacuna-gestacion`,
    }),

    upsertTask({ ...base,
      tipo: "parto-esperado", sector: "gestacion", alcance: "animal",
      titulo:      `Traslado a maternidad — ${sowLabel}`,
      descripcion: `Trasladar cerda a maternidad (parto esperado: día 114)`,
      instrucciones: "Limpiar y desinfectar jaula de parto. Verificar condición corporal.",
      fechaVencimiento: addDays(serviceDate, 110),
      disparador: `servicio-${serviceEventId}-parto`,
    }),
  ]);
}

// ── LOTE INICIACIÓN → tareas de recría ───────────────────────────────────────
export async function generarTareasNurseryBatch(
  tenantId:       string,
  nurseryBatchId: string,
  batchCode:      string,
  entryDate:      Date,
) {
  const base = { tenantId, nurseryBatchId, targetLabel: `Lote ${batchCode}` };

  await Promise.all([
    upsertTask({ ...base,
      tipo: "pesaje", sector: "iniciacion", alcance: "lote",
      titulo:      `Pesaje semana 1 — Lote ${batchCode}`,
      descripcion: `Primer pesaje del lote de iniciación (día 7 post-ingreso)`,
      instrucciones: "Peso promedio y número de animales. Calcular GDP.",
      fechaVencimiento: addDays(entryDate, 7),
      disparador: `nursery-${nurseryBatchId}-pesaje-7`,
    }),

    upsertTask({ ...base,
      tipo: "vacuna-mycoplasma", sector: "iniciacion", alcance: "lote",
      titulo:      `Vacuna Mycoplasma — Lote ${batchCode}`,
      descripcion: `Vacuna Mycoplasma hyopneumoniae (día 21 post-destete)`,
      instrucciones: "2 ml IM. Registrar lote del biológico.",
      fechaVencimiento: addDays(entryDate, 21),
      disparador: `nursery-${nurseryBatchId}-vacuna-mycoplasma`,
    }),

    upsertTask({ ...base,
      tipo: "pesaje", sector: "iniciacion", alcance: "lote",
      titulo:      `Pesaje semana 3 — Lote ${batchCode}`,
      descripcion: `Pesaje del lote (día 21 post-ingreso)`,
      instrucciones: "Pesar antes de vacunar. Calcular GDP.",
      fechaVencimiento: addDays(entryDate, 21),
      disparador: `nursery-${nurseryBatchId}-pesaje-21`,
    }),

    upsertTask({ ...base,
      tipo: "vacuna-influenza", sector: "iniciacion", alcance: "lote",
      titulo:      `Vacuna Influenza — Lote ${batchCode}`,
      descripcion: `Vacuna Influenza porcina (día 28 post-destete)`,
      instrucciones: "Dosis según peso. Segunda dosis si protocolo lo indica.",
      fechaVencimiento: addDays(entryDate, 28),
      disparador: `nursery-${nurseryBatchId}-vacuna-influenza`,
    }),
  ]);
}

// ── TAREAS DIARIAS (generadas on-demand por la API) ──────────────────────────
export async function generarTareasDiarias(tenantId: string) {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  const yaExisten = await prisma.task.count({
    where: {
      tenantId,
      generadaPor: "diaria",
      fechaVencimiento: { gte: today, lt: addDays(today, 1) },
    },
  });
  if (yaExisten > 0) return;

  const [gestCount, matCount, nurseryCount, engordCount] = await Promise.all([
    prisma.sow.count({ where: { tenantId, plantelState: { in: ["PREGNANT", "MATED"] } } }),
    prisma.farrowingEvent.count({ where: { tenantId, weaning: null } }),
    prisma.nurseryBatch.count({ where: { tenantId, isActive: true } }),
    prisma.growingBatch.count({ where: { tenantId, isActive: true } }),
  ]);

  const tareas: TaskData[] = [];

  if (gestCount > 0) {
    tareas.push({
      tenantId, tipo: "alimentacion", sector: "gestacion", alcance: "sala",
      titulo:      `Alimentación gestación — ${todayStr}`,
      descripcion: `Distribuir ración diaria a ${gestCount} cerdas en gestación`,
      instrucciones: "BCS objetivo 3.0-3.5. Ajustar ración según semana de gestación.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-alimentacion-gestacion`,
    });
    tareas.push({
      tenantId, tipo: "limpieza-bebederos", sector: "gestacion", alcance: "sala",
      titulo:      `Bebederos gestación — ${todayStr}`,
      descripcion: `Limpiar y verificar bebederos de ${gestCount} cerdas en gestación`,
      instrucciones: "Caudal mínimo 2 L/min. Limpiar algas y suciedad.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-bebederos-gestacion`,
    });
    tareas.push({
      tenantId, tipo: "control-temperatura", sector: "gestacion", alcance: "sala",
      titulo:      `Temperatura gestación — ${todayStr}`,
      descripcion: `Controlar temperatura sala de gestación (óptimo 15-22°C)`,
      instrucciones: "Si T>27°C: activar aspersores/ventiladores. Registrar AM y PM.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-temperatura-gestacion`,
    });
  }

  if (matCount > 0) {
    tareas.push({
      tenantId, tipo: "alimentacion", sector: "maternidad", alcance: "sala",
      titulo:      `Alimentación maternidad — ${todayStr}`,
      descripcion: `Distribuir ración a ${matCount} cerdas lactantes`,
      instrucciones: "6-7 kg/día según tamaño de camada. Ajustar si hay hipogalaxia.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-alimentacion-maternidad`,
    });
    tareas.push({
      tenantId, tipo: "control-temperatura", sector: "maternidad", alcance: "sala",
      titulo:      `Temperatura maternidad — ${todayStr}`,
      descripcion: `Verificar temperatura sala maternidad (lechones: 30-33°C)`,
      instrucciones: "Lámparas de calor OK. Lechones no deben agruparse ni jadear.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-temperatura-maternidad`,
    });
    tareas.push({
      tenantId, tipo: "limpieza-bebederos", sector: "maternidad", alcance: "sala",
      titulo:      `Bebederos maternidad — ${todayStr}`,
      descripcion: `Limpiar bebederos de sala de maternidad`,
      instrucciones: "Agua fresca continua. Verificar bebederos de lechones.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-bebederos-maternidad`,
    });
  }

  if (nurseryCount > 0) {
    tareas.push({
      tenantId, tipo: "alimentacion", sector: "iniciacion", alcance: "sala",
      titulo:      `Alimentación iniciación — ${todayStr}`,
      descripcion: `Ración a ${nurseryCount} lotes de iniciación`,
      instrucciones: "Ad libitum. Revisar que comederos estén llenos. Anotar consumo.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-alimentacion-iniciacion`,
    });
    tareas.push({
      tenantId, tipo: "control-temperatura", sector: "iniciacion", alcance: "sala",
      titulo:      `Temperatura iniciación — ${todayStr}`,
      descripcion: `Controlar temperatura sala iniciación (óptimo 24-28°C)`,
      instrucciones: "Ajustar ventilación. Animales no deben tiritar ni jadear.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-temperatura-iniciacion`,
    });
  }

  if (engordCount > 0) {
    tareas.push({
      tenantId, tipo: "alimentacion", sector: "engorde", alcance: "sala",
      titulo:      `Alimentación engorde — ${todayStr}`,
      descripcion: `Ración a ${engordCount} lotes de engorde`,
      instrucciones: "Verificar silos y comederos. Registrar consumo.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-alimentacion-engorde`,
    });
    tareas.push({
      tenantId, tipo: "limpieza-bebederos", sector: "engorde", alcance: "sala",
      titulo:      `Bebederos engorde — ${todayStr}`,
      descripcion: `Verificar bebederos de ${engordCount} lotes de engorde`,
      instrucciones: "1 bebedero funcional por cada 10 animales mínimo.",
      fechaVencimiento: today, generadaPor: "diaria",
      disparador: `diaria-${todayStr}-bebederos-engorde`,
    });
  }

  if (tareas.length === 0) return;

  const disparadores = tareas.map(t => t.disparador);
  const existentes   = await prisma.task.findMany({
    where: { tenantId, disparador: { in: disparadores } },
    select: { disparador: true },
  });
  const yaSet  = new Set(existentes.map(e => e.disparador));
  const nuevas = tareas.filter(t => !yaSet.has(t.disparador!));

  if (nuevas.length > 0) {
    const data = nuevas.map(t => {
      const resp = getResponsable(t.tipo, t.sector);
      return {
        ...t,
        prioridad:         calcPriority(t.fechaVencimiento),
        responsableNombre: resp.nombre,
        responsableKey:    resp.key,
        instrucciones:     t.instrucciones ?? null,
      };
    });
    await prisma.task.createMany({ data });
  }
}
