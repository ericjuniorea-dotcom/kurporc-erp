// Finanzas · costeo por etapa · Fase 2: clasificar los movimientos por su categoría anterior.
// Cada gasto/inversión recibe su subcategoría (qué es) y su etapa (dónde se consumió) o su proyecto (inversión).
// Los que no tienen una etapa única quedan «pendientes de revisión» para asignarla en la pantalla de revisión.
// Nunca cambia importes ni la categoría anterior; solo agrega la clasificación. Idempotente: no toca lo ya clasificado.
import prisma from "@/lib/db/prisma";
import { etapaPorModo, sugerirSubcategoria } from "./sugerir";

export const PROYECTO_INICIAL = "Instalación inicial de la granja";

type Sub = { id: string; codigo: string; nombre: string; modo: string; etapaCodigo: string | null; nombresAnteriores: string[] };
type Mov = { id: string; tipo: string; fecha: Date; montoGs: bigint; concepto: string; productoSanitarioId: string | null; categoria: { nombre: string } };

export type Propuesta = {
  movimientoId: string; categoriaAnterior: string; tipo: string; montoGs: bigint;
  subcategoria: Sub; etapaCodigo: string | null; conProyecto: boolean; revision: string | null;
};

export { etapaPorModo };

/** Propuesta para cada movimiento todavía sin clasificar (no escribe nada). */
export async function proponerClasificacion(org: string): Promise<{ propuestas: Propuesta[]; sinTocar: number }> {
  const [subs, movs] = await Promise.all([
    prisma.subcategoriaGasto.findMany({ where: { organizacionId: org }, select: { id: true, codigo: true, nombre: true, modo: true, etapaCodigo: true, nombresAnteriores: true } }),
    prisma.movimiento.findMany({ where: { organizacionId: org, subcategoriaGastoId: null }, orderBy: { fecha: "asc" },
      select: { id: true, tipo: true, fecha: true, montoGs: true, concepto: true, productoSanitarioId: true, categoria: { select: { nombre: true } } } }),
  ]);
  const porCodigo = new Map(subs.map(s => [s.codigo, s]));
  const ids = [...new Set(movs.map(m => m.productoSanitarioId).filter(Boolean))] as string[];
  const vacunas = new Set((await prisma.productoInventario.findMany({ where: { id: { in: ids }, categoria: "VACUNA" }, select: { id: true } })).map(p => p.id));

  const propuestas: Propuesta[] = [];
  let sinTocar = 0;
  for (const m of movs as Mov[]) {
    const sugerida = sugerirSubcategoria(subs, m.tipo, m.categoria.nombre, !!m.productoSanitarioId && vacunas.has(m.productoSanitarioId));
    if (sugerida === null) { sinTocar++; continue; }
    let sub: Sub | undefined = sugerida;
    let revision: string | null = null;
    if (!sub) { sub = porCodigo.get("OTR-01"); revision = "Categoría sin equivalente: elegí la subcategoría"; }
    if (!sub) { sinTocar++; continue; }
    const e = etapaPorModo(sub);
    propuestas.push({ movimientoId: m.id, categoriaAnterior: m.categoria.nombre, tipo: m.tipo, montoGs: m.montoGs, subcategoria: sub,
      etapaCodigo: e.etapaCodigo, conProyecto: sub.modo === "INVERSION", revision: revision ?? e.revision });
  }
  return { propuestas, sinTocar };
}

/** Aplica la propuesta. Las inversiones van al proyecto «Instalación inicial de la granja» (se crea si falta). */
export async function aplicarClasificacion(org: string, usuarioId: string): Promise<{ clasificados: number; pendientes: number; proyectoId: string | null }> {
  const { propuestas } = await proponerClasificacion(org);
  let proyectoId: string | null = null;
  const inversiones = propuestas.filter(p => p.conProyecto);
  if (inversiones.length) {
    const existente = await prisma.proyectoInversion.findFirst({ where: { organizacionId: org, nombre: PROYECTO_INICIAL }, select: { id: true } });
    if (existente) proyectoId = existente.id;
    else {
      const fechas = await prisma.movimiento.aggregate({ where: { id: { in: inversiones.map(p => p.movimientoId) } }, _min: { fecha: true }, _max: { fecha: true } });
      proyectoId = (await prisma.proyectoInversion.create({ data: {
        organizacionId: org, nombre: PROYECTO_INICIAL, estado: "EN_CURSO", fechaInicio: fechas._min.fecha ?? new Date(),
        notas: "Creado al migrar las inversiones anteriores (obras, jaulas, equipos y plantel inicial).",
      }, select: { id: true } })).id;
    }
  }
  const ahora = new Date();
  // Agrupar por (subcategoría, etapa, proyecto, revisión) → pocas actualizaciones
  const grupos = new Map<string, { ids: string[]; p: Propuesta }>();
  for (const p of propuestas) {
    const k = `${p.subcategoria.id}|${p.etapaCodigo}|${p.conProyecto}|${p.revision}`;
    const g = grupos.get(k) ?? { ids: [], p };
    g.ids.push(p.movimientoId); grupos.set(k, g);
  }
  await prisma.$transaction(async tx => {
    for (const { ids, p } of grupos.values()) {
      await tx.movimiento.updateMany({ where: { id: { in: ids }, organizacionId: org, subcategoriaGastoId: null }, data: {
        subcategoriaGastoId: p.subcategoria.id, etapaCodigo: p.etapaCodigo, proyectoId: p.conProyecto ? proyectoId : null,
        revisionPendiente: !!p.revision, motivoRevision: p.revision, clasificadoPor: usuarioId, clasificadoEn: ahora,
      } });
    }
  }, { timeout: 60_000 });
  return { clasificados: propuestas.length, pendientes: propuestas.filter(p => p.revision).length, proyectoId };
}
