// Auditoría de consistencia de una granja: las reglas que nunca pueden romperse.
// La usa el importador (antes de confirmar) y se puede correr sobre cualquier organización:
//   AUDITAR=<id de organización> npm run auditoria:granja
// Recibe el cliente de Prisma (o una transacción) para poder auditar una importación en seco.
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;
export type Hallazgo = { severidad: "ERROR" | "AVISO"; regla: string; detalle: string };

const DIA = 86_400_000;
const f = (d: Date) => d.toISOString().slice(0, 10);

/** Lechones con la madre en una camada: vivos + recibidos − donados − muertos (sin destete). */
export function stockCamada(c: { bornAlive: number; deaths: { quantity: number }[]; movementsAsOrigin: { quantity: number }[]; movementsAsDestination: { quantity: number }[] }) {
  return c.bornAlive + c.movementsAsDestination.reduce((s, m) => s + m.quantity, 0) - c.movementsAsOrigin.reduce((s, m) => s + m.quantity, 0) - c.deaths.reduce((s, d) => s + d.quantity, 0);
}

export async function auditarGranja(db: Db, org: string, hoy = new Date()): Promise<Hallazgo[]> {
  const h: Hallazgo[] = [];
  const err = (regla: string, detalle: string) => h.push({ severidad: "ERROR", regla, detalle });
  const aviso = (regla: string, detalle: string) => h.push({ severidad: "AVISO", regla, detalle });

  const [sows, bajas, servicios, partos, chequeos, lotes, eventosVac, tareas] = await Promise.all([
    db.sow.findMany({ where: { tenantId: org }, select: { id: true, identCode: true, isActive: true, plantelState: true } }),
    db.sowDiscard.findMany({ where: { tenantId: org }, select: { sowId: true, discardDate: true } }),
    db.serviceEvent.findMany({ where: { tenantId: org }, select: { id: true, sowId: true, serviceDate: true } }),
    db.farrowingEvent.findMany({
      where: { tenantId: org },
      select: { id: true, codigo: true, sowId: true, serviceEventId: true, startDatetime: true, bornAlive: true, notes: true,
        deaths: { select: { quantity: true, deathDatetime: true } },
        movementsAsOrigin: { select: { quantity: true, movementDate: true } }, movementsAsDestination: { select: { quantity: true, movementDate: true } },
        weaning: { select: { weaningDate: true, pigletsWeaned: true, pigletsAvailable: true } } },
    }),
    db.pregnancyCheck.findMany({ where: { tenantId: org }, select: { sowId: true, checkDate: true } }),
    db.nurseryBatch.findMany({ where: { tenantId: org }, select: { id: true, batchCode: true, currentCount: true, isActive: true, weanings: { select: { pigletsWeaned: true } }, sales: { select: { animalCount: true } }, growingBatches: { select: { id: true } } } }),
    db.eventoVacunacion.findMany({ where: { tenantId: org, estado: { in: ["pendiente", "retrasado"] } }, select: { animalId: true, farrowingId: true, nurseryBatchId: true, fecha: true } }),
    db.task.findMany({ where: { tenantId: org, fechaCompletada: null }, select: { animalId: true, farrowingId: true, titulo: true } }),
  ]);
  const codigo = new Map(sows.map(s => [s.id, s.identCode]));
  const baja = new Map(bajas.map(b => [b.sowId, b.discardDate]));
  const nombre = (id: string) => `cerda ${codigo.get(id) ?? id}`;
  const etiquetaParto = (p: { codigo: string | null; notes: string | null; sowId: string; startDatetime: Date }) => `${p.codigo ?? p.notes?.match(/P-\d{4}/)?.[0] ?? "parto"} (${nombre(p.sowId)}, ${f(p.startDatetime)})`;

  // ── Cerdas dadas de baja: fuera de todo ──
  for (const s of sows) {
    const fb = baja.get(s.id);
    if (!s.isActive && !fb) err("Baja sin registro", `${nombre(s.id)} está inactiva pero no tiene registro de baja (fecha y motivo).`);
    if (s.isActive && fb) err("Baja activa", `${nombre(s.id)} tiene baja el ${f(fb)} pero sigue activa en el plantel.`);
    if (!s.isActive && s.plantelState !== "DEAD" && s.plantelState !== "CULLED") err("Estado de una baja", `${nombre(s.id)} está dada de baja pero su estado es ${s.plantelState ?? "—"} (tiene que ser muerta o descartada).`);
    if (s.isActive && (s.plantelState === "DEAD" || s.plantelState === "CULLED")) err("Estado de una activa", `${nombre(s.id)} figura ${s.plantelState === "DEAD" ? "muerta" : "descartada"} pero sigue activa.`);
    if (!fb) continue;
    const despues = (d: Date) => d.getTime() > fb.getTime() + DIA / 2;
    for (const x of servicios.filter(x => x.sowId === s.id && despues(x.serviceDate))) err("Evento después de la baja", `${nombre(s.id)}: servicio el ${f(x.serviceDate)}, después de su baja (${f(fb)}).`);
    for (const x of partos.filter(x => x.sowId === s.id && despues(x.startDatetime))) err("Evento después de la baja", `${nombre(s.id)}: parto el ${f(x.startDatetime)}, después de su baja (${f(fb)}).`);
    for (const x of chequeos.filter(x => x.sowId === s.id && despues(x.checkDate))) err("Evento después de la baja", `${nombre(s.id)}: diagnóstico el ${f(x.checkDate)}, después de su baja.`);
    const pend = eventosVac.filter(e => e.animalId === s.id).length;
    if (pend) err("Vacunas de una baja", `${nombre(s.id)}: ${pend} vacuna${pend > 1 ? "s" : ""} pendiente${pend > 1 ? "s" : ""} en la agenda, pero la cerda está dada de baja.`);
    const t = tareas.filter(x => x.animalId === s.id).length;
    if (t) err("Tareas de una baja", `${nombre(s.id)}: ${t} tarea${t > 1 ? "s" : ""} abierta${t > 1 ? "s" : ""}, pero la cerda está dada de baja.`);
  }

  // ── Maternidad: camada abierta = sin destete, cerda activa y con lechones ──
  for (const p of partos) {
    const stock = stockCamada(p);
    const activa = sows.find(s => s.id === p.sowId)?.isActive ?? false;
    if (stock < 0) err("Camada con stock negativo", `${etiquetaParto(p)}: quedan ${stock} lechones (murieron o se donaron más de los que había).`);
    if (!p.weaning && !activa && stock > 0) err("Lechones con una cerda de baja", `${etiquetaParto(p)}: la cerda está dada de baja y quedan ${stock} lechones a su cargo sin donar ni destetar.`);
    if (!p.weaning && stock === 0) aviso("Camada cerrada sin destete", `${etiquetaParto(p)}: no le quedan lechones (${p.bornAlive === 0 ? "nacieron todos muertos" : "murieron o se donaron"}); no cuenta en Maternidad.`);
    if (p.weaning && p.weaning.pigletsWeaned > stock) aviso("Destete mayor que lo que tenía", `${etiquetaParto(p)}: destetó ${p.weaning.pigletsWeaned} con ${stock} a cargo (faltan adopciones o hay un error de carga).`);
    if (p.weaning && p.weaning.pigletsWeaned < stock) aviso("Camada que no cierra", `${etiquetaParto(p)}: tenía ${stock} lechones a cargo y se destetaron ${p.weaning.pigletsWeaned} (${stock - p.weaning.pigletsWeaned} sin registrar: faltan muertes o adopciones).`);
    for (const m of p.movementsAsDestination) if (p.weaning && m.movementDate > p.weaning.weaningDate) err("Adopción a una camada destetada", `${etiquetaParto(p)}: recibió ${m.quantity} lechones el ${f(m.movementDate)}, después de su destete.`);
    const fb = baja.get(p.sowId);
    for (const m of p.movementsAsDestination) if (fb && m.movementDate.getTime() > fb.getTime()) err("Adopción a una cerda de baja", `${etiquetaParto(p)}: recibió lechones el ${f(m.movementDate)}, después de la baja de la madre.`);
    // Gestación
    const sv = p.serviceEventId ? servicios.find(x => x.id === p.serviceEventId) : null;
    if (!sv) aviso("Parto sin servicio", `${etiquetaParto(p)} no está enlazado a un servicio.`);
    else {
      const g = Math.round((p.startDatetime.getTime() - sv.serviceDate.getTime()) / DIA);
      if (g < 105 || g > 125) aviso("Gestación fuera de rango", `${etiquetaParto(p)}: ${g} días de gestación (normal 110 a 120).`);
    }
  }
  // Estado de la cerda contra sus camadas
  for (const s of sows.filter(x => x.isActive)) {
    const abiertas = partos.filter(p => p.sowId === s.id && !p.weaning && stockCamada(p) > 0);
    if (s.plantelState === "LACTATING" && !abiertas.length) err("Lactancia sin lechones", `${nombre(s.id)} figura en lactancia pero no tiene una camada abierta con lechones.`);
    if (abiertas.length && s.plantelState !== "LACTATING" && s.plantelState !== "FARROWING") err("Camada abierta sin lactancia", `${nombre(s.id)} tiene ${abiertas.length} camada abierta con lechones pero su estado es ${s.plantelState ?? "—"}.`);
    if (abiertas.length > 1) err("Dos camadas abiertas", `${nombre(s.id)} tiene ${abiertas.length} camadas sin destetar a la vez.`);
    // Servida mientras tenía una camada con lechones
    for (const p of partos.filter(x => x.sowId === s.id)) {
      const fin = p.weaning?.weaningDate ?? (stockCamada(p) > 0 ? hoy : p.startDatetime);
      for (const sv of servicios.filter(x => x.sowId === s.id && x.serviceDate > p.startDatetime && x.serviceDate < fin)) err("Servida en lactancia", `${nombre(s.id)}: servicio el ${f(sv.serviceDate)} con la camada del ${f(p.startDatetime)} sin destetar.`);
    }
  }

  // ── Lotes de recría ──
  const muertesRecria = await db.animalEvent.findMany({ where: { tenantId: org, eventType: "DEATH", moduleSource: "RECRIA" }, select: { metadata: true } });
  for (const l of lotes) {
    const destetados = l.weanings.reduce((s, w) => s + w.pigletsWeaned, 0);
    const vendidos = l.sales.reduce((s, v) => s + v.animalCount, 0);
    const muertos = muertesRecria.filter(e => (e.metadata as { batchId?: string } | null)?.batchId === l.id).reduce((s, e) => s + Number((e.metadata as { quantity?: number }).quantity ?? 1), 0);
    if (destetados && !l.growingBatches.length && l.currentCount !== destetados - muertos - vendidos) err("Lote que no cierra", `Lote ${l.batchCode}: saldo ${l.currentCount}, pero ${destetados} destetados − ${muertos} muertos − ${vendidos} vendidos = ${destetados - muertos - vendidos}.`);
    if (l.currentCount < 0) err("Lote con saldo negativo", `Lote ${l.batchCode}: saldo ${l.currentCount}.`);
    if (l.isActive && l.currentCount === 0) aviso("Lote vacío abierto", `Lote ${l.batchCode} está abierto sin animales.`);
    if (!l.isActive && l.currentCount > 0) err("Lote cerrado con animales", `Lote ${l.batchCode} está cerrado con ${l.currentCount} animales.`);
    const pend = eventosVac.filter(e => e.nurseryBatchId === l.id).length;
    if (!l.currentCount && pend) err("Vacunas de un lote vacío", `Lote ${l.batchCode}: ${pend} vacunas pendientes sin animales.`);
  }
  // Vacunas pendientes de camadas sin lechones
  for (const p of partos) {
    const pend = eventosVac.filter(e => e.farrowingId === p.id && !e.animalId).length;
    if (pend && (p.weaning || stockCamada(p) <= 0)) err("Vacunas de una camada cerrada", `${etiquetaParto(p)}: ${pend} vacunas de lechones pendientes en la camada, pero no tiene lechones a cargo.`);
  }
  return h;
}
