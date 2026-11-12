// Una sola definición de "camada en maternidad" para todo el sistema:
// sin destete, con la cerda activa (no muerta ni descartada) y con lechones a cargo
// (vivos + recibidos − donados − muertos > 0). Una camada que nació toda muerta o cuyos
// lechones se donaron (por ejemplo, porque murió la madre) queda cerrada aunque no tenga destete;
// sus lechones siguen trazables en la camada que los recibió.
import prisma from "@/lib/db/prisma";
import { stockCamada } from "@/lib/auditoria/granja";

export const SELECT_STOCK_CAMADA = {
  bornAlive: true,
  deaths: { select: { quantity: true } },
  movementsAsOrigin: { select: { quantity: true } },
  movementsAsDestination: { select: { quantity: true } },
} as const;

/** Ids de las camadas abiertas de la organización (opcionalmente, de una cerda). */
export async function idsCamadasAbiertas(tenantId: string, sowId?: string): Promise<string[]> {
  const xs = await prisma.farrowingEvent.findMany({
    where: { tenantId, weaning: null, sow: { isActive: true }, ...(sowId ? { sowId } : {}) },
    select: { id: true, ...SELECT_STOCK_CAMADA },
  });
  return xs.filter(x => stockCamada(x) > 0).map(x => x.id);
}

export async function contarCamadasAbiertas(tenantId: string): Promise<number> {
  return (await idsCamadasAbiertas(tenantId)).length;
}
