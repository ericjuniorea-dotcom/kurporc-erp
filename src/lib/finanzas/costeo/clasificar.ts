// Finanzas · costeo por etapa · Fase 2: clasificar los movimientos por su categoría anterior.
// Cada gasto/inversión recibe su subcategoría (qué es) y su etapa (dónde se consumió) o su proyecto (inversión).
// Los que no tienen una etapa única quedan «pendientes de revisión» para asignarla en la pantalla de revisión.
// Nunca cambia importes ni la categoría anterior; solo agrega la clasificación. Idempotente: no toca lo ya clasificado.
import prisma from "@/lib/db/prisma";

export const PROYECTO_INICIAL = "Instalación inicial de la granja";

type Sub = { id: string; codigo: string; nombre: string; modo: string; etapaCodigo: string | null; nombresAnteriores: string[] };
type Mov = { id: string; tipo: string; fecha: Date; montoGs: bigint; concepto: string; productoSanitarioId: string | null; categoria: { nombre: string } };

export type Propuesta = {
  movimientoId: string; categoriaAnterior: string; tipo: string; montoGs: bigint;
  subcategoria: Sub; etapaCodigo: string | null; conProyecto: boolean; revision: string | null;
};

const norm = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Etapa y revisión que corresponden a una subcategoría según su modo de registro. */
export function etapaPorModo(sub: Pick<Sub, "modo" | "etapaCodigo">): { etapaCodigo: string | null; revision: string | null } {
  if (sub.modo === "INVENTARIO") return { etapaCodigo: sub.etapaCodigo ?? null, revision: null }; // el costo lo da la etapa que consume (si es única, queda anotada)
  if (sub.modo === "INVERSION") return { etapaCodigo: "INV", revision: null };
  if (sub.modo === "REPARTO") return { etapaCodigo: sub.etapaCodigo ?? "CMP", revision: null };
  return sub.etapaCodigo ? { etapaCodigo: sub.etapaCodigo, revision: null } : { etapaCodigo: null, revision: "Indicá a qué etapa corresponde" };
}

/** Propuesta para cada movimiento todavía sin clasificar (no escribe nada). */
export async function proponerClasificacion(org: string): Promise<{ propuestas: Propuesta[]; sinTocar: number }> {
  const [subs, movs] = await Promise.all([
    prisma.subcategoriaGasto.findMany({ where: { organizacionId: org }, select: { id: true, codigo: true, nombre: true, modo: true, etapaCodigo: true, nombresAnteriores: true } }),
    prisma.movimiento.findMany({ where: { organizacionId: org, subcategoriaGastoId: null }, orderBy: { fecha: "asc" },
      select: { id: true, tipo: true, fecha: true, montoGs: true, concepto: true, productoSanitarioId: true, categoria: { select: { nombre: true } } } }),
  ]);
  const porCodigo = new Map(subs.map(s => [s.codigo, s]));
  const porNombre = new Map<string, Sub>();
  for (const s of subs) for (const n of s.nombresAnteriores) porNombre.set(norm(n), s);
  const ids = [...new Set(movs.map(m => m.productoSanitarioId).filter(Boolean))] as string[];
  const vacunas = new Set((await prisma.productoInventario.findMany({ where: { id: { in: ids }, categoria: "VACUNA" }, select: { id: true } })).map(p => p.id));

  const propuestas: Propuesta[] = [];
  let sinTocar = 0;
  for (const m of movs as Mov[]) {
    const nombre = norm(m.categoria.nombre);
    let sub: Sub | undefined;
    if (m.tipo === "INGRESO") { sinTocar++; continue; }
    if (m.tipo === "FINANCIAMIENTO") {
      sub = porNombre.get(nombre); // solo los intereses son gasto (financiero); préstamos, cuotas y aportes no
      if (!sub || sub.modo === "INVERSION") { sinTocar++; continue; }
    } else if (nombre === "sanidad") {
      sub = porCodigo.get(m.productoSanitarioId && vacunas.has(m.productoSanitarioId) ? "SAN-01" : "SAN-02");
    } else if (m.tipo === "INVERSION") {
      sub = porNombre.get(nombre);
      if (!sub || sub.modo !== "INVERSION") sub = porCodigo.get(nombre.includes("matri") || nombre.includes("reproduc") ? "INV-03" : "INV-02");
    } else {
      sub = porNombre.get(nombre);
    }
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
