// Animales vivos HOY de cada evento de vacunación: la cantidad guardada en el evento es la del día en que se
// programó; si después murió un lechón (o se vendió o trasladó), la dosis tiene que salir con los que quedan.
import "server-only";
import prisma from "@/lib/db/prisma";
import { SELECT_STOCK_CAMADA } from "@/lib/maternidad/camadas";
import { stockCamada } from "@/lib/auditoria/granja";

type Ev = { id: string; dosisNecesarias: number; farrowingId?: string | null; nurseryBatchId?: string | null; growingBatchId?: string | null };

export async function animalesVivos(tenantId: string, eventos: Ev[]): Promise<Map<string, number>> {
  const ids = (k: "farrowingId" | "nurseryBatchId" | "growingBatchId") => Array.from(new Set(eventos.map(e => e[k]).filter((x): x is string => !!x)));
  const [camadas, iniciacion, engorde] = await Promise.all([
    ids("farrowingId").length ? prisma.farrowingEvent.findMany({ where: { tenantId, id: { in: ids("farrowingId") } }, select: { id: true, ...SELECT_STOCK_CAMADA } }) : [],
    ids("nurseryBatchId").length ? prisma.nurseryBatch.findMany({ where: { tenantId, id: { in: ids("nurseryBatchId") } }, select: { id: true, currentCount: true } }) : [],
    ids("growingBatchId").length ? prisma.growingBatch.findMany({ where: { tenantId, id: { in: ids("growingBatchId") } }, select: { id: true, currentCount: true } }) : [],
  ]);
  const vivosCamada = new Map(camadas.map(c => [c.id, stockCamada(c)]));
  const vivosIni = new Map(iniciacion.map(l => [l.id, l.currentCount]));
  const vivosEng = new Map(engorde.map(l => [l.id, l.currentCount]));
  const out = new Map<string, number>();
  for (const e of eventos) {
    const v = e.farrowingId ? vivosCamada.get(e.farrowingId) : e.nurseryBatchId ? vivosIni.get(e.nurseryBatchId) : e.growingBatchId ? vivosEng.get(e.growingBatchId) : undefined;
    out.set(e.id, Math.max(0, v ?? e.dosisNecesarias ?? 1));
  }
  return out;
}
