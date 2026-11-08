// Uso diario de la plataforma (Fase 11): una fila por persona y día, con la cantidad de pantallas.
// Se escribe después de responder (after) y como máximo cada 10 minutos por persona, para no frenar nada.
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC } from "@/lib/finanzas/calculos";

const ultimo = new Map<string, number>();
const CADA_MS = 10 * 60_000;

export async function registrarActividad(userId: string, organizacionId: string | null) {
  const ahora = Date.now();
  if ((ultimo.get(userId) ?? 0) > ahora - CADA_MS) return;
  if (ultimo.size > 10_000) ultimo.clear();
  ultimo.set(userId, ahora);
  const fecha = hoyUTC();
  try {
    await prisma.actividadDiaria.upsert({
      where: { userId_fecha: { userId, fecha } },
      create: { userId, fecha, organizacionId },
      update: { accesos: { increment: 1 }, organizacionId },
    });
    await prisma.user.update({ where: { id: userId }, data: { ultimoAcceso: new Date() } });
  } catch (e) { console.error("[actividad]", e); }
}
