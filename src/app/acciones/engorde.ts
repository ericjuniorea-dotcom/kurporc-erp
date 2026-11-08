"use server";
// Engorde (Fase 9): modalidad y costo del lote, tratamientos con carencia y curvas de crecimiento.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { ErrorPermiso, requirePermiso } from "@/lib/permisos/servidor";
import { loteCerrado } from "@/lib/engorde/guardas";

type R = { ok: true } | { ok: false; error: string };
function manejar(e: unknown): { ok: false; error: string } {
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  const m = e instanceof Error ? e.message : "";
  if (m.startsWith("•")) return { ok: false, error: m.slice(1) };
  console.error("[engorde]", e);
  return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
}
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const gsOpc = z.string().trim().regex(/^\d{0,15}$/, "Monto inválido").optional().default("");

const loteSchema = z.object({
  modalidad: z.enum(["PROPIO", "INTEGRADO"]),
  integrador: z.string().trim().max(120).optional().default(""),
  pagoIntegracion: z.enum(["", "POR_KG_PRODUCIDO", "POR_ANIMAL_DIA", "POR_CABEZA"]).default(""),
  tarifaIntegracionGs: gsOpc,
  alimentoLoProvee: z.enum(["PROPIO", "INTEGRADOR"]),
  sexo: z.enum(["", "MACHOS_CASTRADOS", "HEMBRAS", "MIXTO"]).default(""),
  genetica: z.string().trim().max(80).optional().default(""),
  costoIngresoGs: gsOpc,
  targetWeightKg: z.string().trim().regex(/^\d{2,3}([.,]\d{1,2})?$/, "Peso objetivo inválido"),
  curvaId: z.string().uuid().or(z.literal("")).default(""),
}).strict();

export async function actualizarLote(id: string, datos: z.input<typeof loteSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("engorde.lotes.editar");
    const d = loteSchema.parse(datos);
    const org = permisos.organizacionId;
    const cerrado = await loteCerrado(org, id);
    if (cerrado) throw new Error(`•${cerrado}`);
    if (d.modalidad === "INTEGRADO" && (!d.integrador || !d.pagoIntegracion || !d.tarifaIntegracionGs)) throw new Error("•En un lote integrado cargá el integrador, cómo paga y la tarifa.");
    if (d.curvaId && !(await prisma.curvaEngorde.findFirst({ where: { id: d.curvaId, organizacionId: org } }))) throw new Error("•Esa curva no existe.");
    let integradorId: string | null = null;
    if (d.modalidad === "INTEGRADO") {
      const cp = await prisma.contraparte.upsert({ where: { organizacionId_nombre: { organizacionId: org, nombre: d.integrador } }, create: { organizacionId: org, nombre: d.integrador, tipo: "AMBOS" }, update: {} });
      integradorId = cp.id;
    }
    await conActor(session.user.id, tx => tx.growingBatch.update({
      where: { id },
      data: {
        modalidad: d.modalidad, integradorId, pagoIntegracion: d.modalidad === "INTEGRADO" ? d.pagoIntegracion : null,
        tarifaIntegracionGs: d.modalidad === "INTEGRADO" && d.tarifaIntegracionGs ? BigInt(d.tarifaIntegracionGs) : null,
        alimentoLoProvee: d.alimentoLoProvee, sexo: d.sexo || null, genetica: d.genetica || null,
        costoIngresoGs: d.costoIngresoGs ? BigInt(d.costoIngresoGs) : null, targetWeightKg: Number(d.targetWeightKg.replace(",", ".")), curvaId: d.curvaId || null,
      },
    }));
    revalidatePath(`/engorde/lotes/${id}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

const tratamientoSchema = z.object({
  medicineId: z.string().min(1, "Elegí el medicamento").max(40),
  fecha,
  animales: z.coerce.number().int().min(1, "¿A cuántos animales?").max(100000),
  mlAplicados: z.string().trim().regex(/^(\d{1,7}([.,]\d{1,2})?)?$/, "ml inválidos").default(""),
  costoGs: gsOpc,
}).strict();

/** Tratamiento al lote: abre la carencia (bloquea la venta hasta que termine) y suma al costo de sanidad del lote. */
export async function registrarTratamientoLote(loteId: string, datos: z.input<typeof tratamientoSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("sanidad.tratamientos.crear");
    const d = tratamientoSchema.parse(datos);
    const org = permisos.organizacionId;
    const cerrado = await loteCerrado(org, loteId);
    if (cerrado) throw new Error(`•${cerrado}`);
    const med = await prisma.medicine.findFirst({ where: { id: d.medicineId, tenantId: org } });
    if (!med) throw new Error("•Ese medicamento no existe.");
    const inicio = new Date(`${d.fecha}T00:00:00Z`);
    const fin = new Date(inicio.getTime() + med.withdrawalDays * 86_400_000);
    await conActor(session.user.id, tx => tx.withdrawalPeriod.create({
      data: {
        tenantId: org, growingBatchId: loteId, medicineId: med.id, withdrawalDays: med.withdrawalDays, startDate: inicio, endDate: fin,
        isActive: med.withdrawalDays > 0, animales: d.animales, mlAplicados: d.mlAplicados ? d.mlAplicados.replace(",", ".") : null,
        costoGs: d.costoGs ? BigInt(d.costoGs) : null,
      },
    }));
    revalidatePath(`/engorde/lotes/${loteId}`);
    return { ok: true };
  } catch (e) { return manejar(e); }
}

const curvaSchema = z.object({
  id: z.string().uuid().nullable(),
  nombre: z.string().trim().min(2, "Poné un nombre").max(80),
  puntos: z.array(z.object({ dia: z.number().int().min(0).max(400), pesoKg: z.number().min(1).max(300), consumoKgDia: z.number().min(0).max(10).optional() })).min(2, "Al menos dos puntos").max(60),
  predeterminada: z.boolean(),
}).strict();

export async function guardarCurva(datos: z.input<typeof curvaSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("engorde.curvas.configurar");
    const d = curvaSchema.parse(datos);
    const org = permisos.organizacionId;
    const puntos = [...d.puntos].sort((a, b) => a.dia - b.dia);
    for (let i = 1; i < puntos.length; i++) if (puntos[i].pesoKg < puntos[i - 1].pesoKg || puntos[i].dia === puntos[i - 1].dia) throw new Error("•Los días no se pueden repetir y el peso no puede bajar.");
    await conActor(session.user.id, async tx => {
      if (d.predeterminada) await tx.curvaEngorde.updateMany({ where: { organizacionId: org }, data: { predeterminada: false } });
      if (d.id) {
        const c = await tx.curvaEngorde.findFirst({ where: { id: d.id, organizacionId: org } });
        if (!c) throw new Error("•Esa curva no existe.");
        await tx.curvaEngorde.update({ where: { id: d.id }, data: { nombre: d.nombre, puntos, predeterminada: d.predeterminada } });
      } else await tx.curvaEngorde.create({ data: { organizacionId: org, nombre: d.nombre, puntos, predeterminada: d.predeterminada } });
    });
    revalidatePath("/engorde/curvas");
    return { ok: true };
  } catch (e) { return manejar(e); }
}
