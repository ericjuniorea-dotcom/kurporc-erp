// Escrituras con actor (Fase 2.1).
// Prisma no pasa por auth.uid(): para que el trigger registrar_cambio() sepa
// quién hizo el cambio, la escritura corre en una transacción que primero
// fija app.actor_id. El cliente por organización de la Fase 7 (dbOrg) lo usa
// siempre, para que sea imposible olvidarlo.

import type { Prisma } from "@prisma/client";
import prisma from "./prisma";

export async function conActor<T>(
  actorId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`select set_config('app.actor_id', ${actorId}, true)`;
    return fn(tx);
  });
}
