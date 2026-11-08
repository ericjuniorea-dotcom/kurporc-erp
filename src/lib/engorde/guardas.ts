// Reglas de Engorde (Fase 9) que valen para cualquier evento.
import prisma from "@/lib/db/prisma";

/** Un lote cerrado no acepta eventos. Devuelve el mensaje de error o null si se puede cargar. */
export async function loteCerrado(tenantId: string, ...ids: (string | null | undefined)[]): Promise<string | null> {
  for (const id of ids) {
    if (!id) continue;
    const l = await prisma.growingBatch.findFirst({ where: { id, tenantId }, select: { status: true, batchCode: true } });
    if (!l) return "Ese lote no existe.";
    if (l.status === "CLOSED") return `El lote ${l.batchCode} está cerrado: no acepta más eventos.`;
  }
  return null;
}
