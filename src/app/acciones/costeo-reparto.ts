"use server";
// Finanzas · costeo por etapa · Fase 5: repartir los gastos compartidos del mes y editar las reglas de reparto.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { requirePermiso, ErrorPermiso } from "@/lib/permisos/servidor";
import { aplicarReparto } from "@/lib/finanzas/costeo/reparto";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  console.error("[costeo-reparto]", e);
  return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
}
const mesSchema = z.number().int().min(200001).max(210012);

export async function repartirMes(mes: number): Promise<R<{ movimientos: number }>> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.cierre.cerrar");
    mesSchema.parse(mes);
    const org = permisos.organizacionId;
    const cerrado = await prisma.cierreMes.findFirst({ where: { organizacionId: org, unidadId: null, mes, estado: "CERRADO" }, select: { id: true } });
    if (cerrado) throw new Error("•Ese mes está cerrado: reabrilo para volver a repartir.");
    const n = await aplicarReparto(org, mes, session.user.id);
    revalidatePath("/finanzas", "layout");
    return { ok: true, movimientos: n };
  } catch (e) { return manejar(e); }
}

const regla = z.object({
  subcategoriaCodigo: z.string().regex(/^([A-Z]{3}-\d{2}|\*)$/),
  criterio: z.enum(["PERSONAL", "POTENCIA", "ANIMALES", "PORCENTAJE", "ETAPA"]),
  valores: z.record(z.string().regex(/^[A-Z]{2,5}$/), z.number().min(0).max(1e7)).default({}),
  etapaCodigo: z.string().regex(/^[A-Z]{2,5}$/).nullable().default(null),
});

export async function guardarReglaReparto(datos: z.input<typeof regla>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.cierre.cerrar");
    const d = regla.parse(datos);
    const org = permisos.organizacionId;
    if (d.criterio === "ETAPA" && !d.etapaCodigo) throw new Error("•Elegí la etapa.");
    if (d.criterio === "PORCENTAJE") {
      const suma = Math.round(Object.values(d.valores).reduce((s, v) => s + v, 0) * 100);
      if (suma !== 10_000) throw new Error(`•Los porcentajes tienen que sumar 100 % (suman ${(suma / 100).toLocaleString("es-PY")} %).`);
    }
    const etapas = new Set((await prisma.etapaCosto.findMany({ where: { organizacionId: org }, select: { codigo: true } })).map(e => e.codigo));
    for (const e of [...Object.keys(d.valores), ...(d.etapaCodigo ? [d.etapaCodigo] : [])]) if (!etapas.has(e) || e === "INV" || e === "CMP") throw new Error("•Una de las etapas no es válida.");
    const data = { criterio: d.criterio, valores: d.criterio === "POTENCIA" || d.criterio === "PORCENTAJE" ? d.valores : {}, etapaCodigo: d.criterio === "ETAPA" ? d.etapaCodigo : null, actualizadoPor: session.user.id, updatedAt: new Date() };
    await prisma.reglaReparto.upsert({ where: { organizacionId_subcategoriaCodigo: { organizacionId: org, subcategoriaCodigo: d.subcategoriaCodigo } },
      create: { organizacionId: org, subcategoriaCodigo: d.subcategoriaCodigo, ...data }, update: data });
    revalidatePath("/finanzas/cierre");
    return { ok: true };
  } catch (e) { return manejar(e); }
}
