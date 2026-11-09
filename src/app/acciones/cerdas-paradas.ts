"use server";
// Fase 10 · Crear la tarea sugerida para una cerda parada en el sistema de tareas.
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import { getSession } from "@/lib/auth/config";
import { lineasCerdas, parametrosParadas } from "@/lib/cerdas-paradas/datos";
import { ACCION, NOMBRE_CAUSA, paradaHoy, tramosCerda } from "@/lib/cerdas-paradas/calculo";
import { hoyUTC } from "@/lib/finanzas/calculos";

type R = { ok: true } | { ok: false; error: string };

export async function crearTareaParada(sowId: string): Promise<R> {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) return { ok: false, error: "Iniciá sesión." };
  if (!puede(permisos, "tareas.tareas.crear") || !puedeAlguno(permisos, ["gestacion.cerdas_paradas.ver", "finanzas.cerdas_paradas.ver"])) return { ok: false, error: "No tenés permiso para crear tareas." };
  const org = session.user.tenantId, hoy = hoyUTC();
  const [p, lineas] = await Promise.all([parametrosParadas(org), lineasCerdas(org)]);
  const l = lineas.find(x => x.id === String(sowId));
  if (!l) return { ok: false, error: "Cerda no encontrada." };
  const ph = paradaHoy(tramosCerda(l, p.calc, hoy), hoy);
  if (!ph) return { ok: false, error: "Esta cerda ya no está parada." };
  const disparador = `parada-${l.id}-${ph.desde.toISOString().slice(0, 10)}`;
  if (await prisma.task.findFirst({ where: { tenantId: org, disparador, fechaCompletada: null }, select: { id: true } })) return { ok: false, error: "Ya hay una tarea abierta para esta cerda." };
  await prisma.task.create({ data: {
    tenantId: org, tipo: "cerda-parada", sector: "gestacion", alcance: "animal", animalId: l.id, targetLabel: `Cerda ${l.codigo}`,
    titulo: `${ACCION[ph.causa]} · cerda ${l.codigo}`,
    descripcion: `${NOMBRE_CAUSA[ph.causa]}: lleva ${ph.dias} día(s) parada.`,
    prioridad: ph.dias > 7 ? "urgente" : "hoy", fechaVencimiento: hoy, responsableNombre: "Jefatura de Producción",
    generadaPor: "manual", disparador,
  } });
  revalidatePath("/finanzas/cerdas-paradas");
  revalidatePath("/gestacion/cerdas-paradas");
  return { ok: true };
}
