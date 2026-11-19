// Transferencias de animales (solo servidor): órdenes automáticas, listado por módulo y avisos.
import "server-only";
import prisma from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";
import { idsCamadasAbiertas } from "@/lib/maternidad/camadas";
import { ESTADOS, MODULOS_TRANSFERENCIA, type ModuloTransferencia } from "./tipos";

const DIA = 86_400_000;
const GESTACION = 114;

/** Días antes del parto probable en que la reproductora pasa a Maternidad (Configuración → Gestación → Metas). */
export async function diasTrasladoMaternidad(tenantId: string) {
  const m = await prisma.configMeta.findFirst({ where: { tenantId, modulo: "GESTACION", kpiKey: "dias_traslado_maternidad" }, select: { valor: true } });
  return m ? Math.max(0, Math.round(Number(m.valor))) : 5;
}

/**
 * Crea la orden «Pasar a Maternidad» de cada reproductora preñada o servida a la que le faltan N días o menos para
 * el parto probable, y anula las órdenes que ya no corresponden (parió antes o ya no está gestando).
 * Es idempotente: se puede llamar cada vez que se abre Gestación, Maternidad o el Dashboard.
 */
export async function generarOrdenesMaternidad(tenantId: string) {
  const [dias, estados, abiertas, abiertasTr] = await Promise.all([
    diasTrasladoMaternidad(tenantId),
    getGestacionStates(tenantId),
    idsCamadasAbiertas(tenantId),
    prisma.transferenciaAnimal.findMany({
      where: { tenantId, destino: "MATERNIDAD", sowId: { not: null }, OR: [{ estado: { in: ["ORDEN", "EN_CAMINO", "RECIBIDA"] } }, { estado: "RECHAZADA", resueltaEn: { gte: new Date(Date.now() - 2 * DIA) } }] },
      select: { id: true, sowId: true, estado: true, createdAt: true },
    }),
  ]);
  const hoy = Date.now();
  const enMaternidad = new Set((await prisma.farrowingEvent.findMany({ where: { id: { in: abiertas } }, select: { sowId: true } })).map(f => f.sowId));
  const gestando = new Map(estados.filter(s => s.estado !== "DISPONIBLE").map(s => [s.sowId, s]));

  // Anular órdenes que ya no corresponden
  const anular = abiertasTr.filter(t => (t.estado === "ORDEN" || t.estado === "EN_CAMINO") && t.sowId && (enMaternidad.has(t.sowId) || !gestando.has(t.sowId)));
  if (anular.length) {
    await prisma.transferenciaAnimal.updateMany({ where: { id: { in: anular.map(t => t.id) } },
      data: { estado: "ANULADA", resueltaEn: new Date(), nota: "Se anuló sola: la reproductora ya parió o dejó de estar gestando." } });
  }

  const nuevas = [];
  for (const s of gestando.values()) {
    if (enMaternidad.has(s.sowId) || s.plantelState === "FARROWING") continue;
    const parto = s.serviceDate.getTime() + GESTACION * DIA;
    if (parto - dias * DIA > hoy) continue;
    // Ya tiene una orden abierta, ya fue recibida en este ciclo o la rechazaron hace poco
    if (abiertasTr.some(t => t.sowId === s.sowId && !anular.includes(t) && (t.estado !== "RECIBIDA" || t.createdAt.getTime() > s.serviceDate.getTime()))) continue;
    const fecha = new Date(parto).toISOString().slice(0, 10).split("-").reverse().join("/");
    nuevas.push({ tenantId, origen: "GESTACION", destino: "MATERNIDAD", categoria: "REPRODUCTORAS", estado: "ORDEN", cantidad: 1, sowId: s.sowId,
      fechaProgramada: new Date(parto - dias * DIA), motivo: `Parto probable el ${fecha}: pasar a Maternidad ${dias} días antes para tener la sala lista` });
  }
  if (nuevas.length) await prisma.transferenciaAnimal.createMany({ data: nuevas, skipDuplicates: true });
  return nuevas.length;
}

/** Lo que una pantalla tiene que ver: órdenes para enviar (sale de acá) y lo que está por recibir (llega acá). */
export async function transferenciasDeModulo(tenantId: string, origen: ModuloTransferencia, destinos: ModuloTransferencia[]) {
  const filas = await prisma.transferenciaAnimal.findMany({
    where: { tenantId, OR: [{ origen, estado: "ORDEN" }, { destino: { in: destinos }, estado: "EN_CAMINO" },
      { OR: [{ origen }, { destino: { in: destinos } }], estado: { in: ["RECIBIDA", "RECHAZADA"] }, resueltaEn: { gte: new Date(Date.now() - 7 * DIA) } }] },
    orderBy: [{ fechaProgramada: "asc" }, { createdAt: "asc" }], take: 80,
  });
  const sows = Array.from(new Set(filas.map(f => f.sowId).filter((x): x is string => !!x)));
  const personas = Array.from(new Set(filas.flatMap(f => [f.creadaPor, f.enviadaPor, f.resueltaPor]).filter((x): x is string => !!x)));
  const [cerdas, usuarios] = await Promise.all([
    sows.length ? prisma.sow.findMany({ where: { id: { in: sows } }, select: { id: true, caravanaCode: true, identCode: true, galponAssigned: true, corralAssigned: true } }) : [],
    personas.length ? prisma.user.findMany({ where: { id: { in: personas } }, select: { id: true, name: true } }) : [],
  ]);
  const cerda = new Map(cerdas.map(c => [c.id, c]));
  const nombre = new Map(usuarios.map(u => [u.id, u.name]));
  return filas.map(f => ({
    id: f.id, origen: f.origen as ModuloTransferencia, destino: f.destino as ModuloTransferencia, categoria: f.categoria, estado: f.estado as keyof typeof ESTADOS,
    motivo: f.motivo, cantidad: f.cantidad, pesoTotalKg: f.pesoTotalKg ? Number(f.pesoTotalKg) : null, edadDias: f.edadDias,
    proveedor: f.proveedor, ubicacion: f.ubicacion, animales: (f.animales ?? null) as { caravana: string; sexo?: string; pesoKg?: number | null; genetica?: string }[] | null,
    fechaProgramada: f.fechaProgramada?.toISOString().slice(0, 10) ?? null, creada: f.createdAt.toISOString(),
    cerda: f.sowId && cerda.get(f.sowId) ? { id: f.sowId, caravana: cerda.get(f.sowId)!.caravanaCode || cerda.get(f.sowId)!.identCode,
      ubicacion: [cerda.get(f.sowId)!.galponAssigned, cerda.get(f.sowId)!.corralAssigned].filter(Boolean).join(" · ") || null } : null,
    enviadaPor: f.enviadaPor ? nombre.get(f.enviadaPor) ?? null : null, resueltaPor: f.resueltaPor ? nombre.get(f.resueltaPor) ?? null : null,
    resueltaEn: f.resueltaEn?.toISOString() ?? null, cantidadRecibida: f.cantidadRecibida, nota: f.nota,
    deDonde: MODULOS_TRANSFERENCIA[f.origen as ModuloTransferencia]?.etiqueta ?? f.origen,
    aDonde: MODULOS_TRANSFERENCIA[f.destino as ModuloTransferencia]?.etiqueta ?? f.destino,
  }));
}
export type FilaTransferencia = Awaited<ReturnType<typeof transferenciasDeModulo>>[number];

/** Para el Dashboard: cuántas órdenes y recepciones esperan en cada módulo. */
export async function pendientesPorModulo(tenantId: string) {
  const filas = await prisma.transferenciaAnimal.groupBy({ by: ["estado", "origen", "destino"], where: { tenantId, estado: { in: ["ORDEN", "EN_CAMINO"] } }, _sum: { cantidad: true }, _count: { _all: true } });
  return filas.map(f => ({ estado: f.estado, origen: f.origen as ModuloTransferencia, destino: f.destino as ModuloTransferencia, transferencias: f._count._all, animales: f._sum.cantidad ?? 0 }));
}

/**
 * Traslado interno ya hecho por el módulo de origen (destete, paso a Engorde): queda «por recibir» en el destino,
 * que confirma cuántos llegaron y dónde quedaron. Nunca frena la operación original si falla.
 */
export async function registrarTraslado(data: {
  tenantId: string; origen: ModuloTransferencia; destino: ModuloTransferencia; categoria: "LECHONES" | "REPRODUCTORAS";
  cantidad: number; motivo: string; creadaPor: string; sowId?: string | null; farrowingId?: string | null;
  nurseryBatchId?: string | null; growingBatchId?: string | null; pesoTotalKg?: number | null;
}) {
  if (data.cantidad <= 0) return;
  try {
    await prisma.transferenciaAnimal.createMany({ skipDuplicates: true, data: [{
      ...data, estado: "EN_CAMINO", enviadaPor: data.creadaPor, enviadaEn: new Date(),
    }] });
  } catch (e) { console.error("[traslado]", e); }
}
