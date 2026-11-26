// Finanzas · costeo por etapa · Fase 3: la clasificación de un movimiento nuevo (qué es, dónde se consumió o para qué
// proyecto, y la división entre etapas). Reglas R1 (gasto directo exige etapa), R2 (división = 100 %) y R7 (inversión
// exige proyecto). Cuando la carga viene de otro módulo (sin subcategoría elegida) se sugiere y, si falta algo,
// queda «pendiente de revisión» en vez de bloquear.
import "server-only";
import prisma from "@/lib/db/prisma";
import { asegurarCatalogoCostos } from "./catalogo";
import { etapaPorModo, repartirMonto, sugerirSubcategoria } from "./sugerir";

export type EntradaCosteo = {
  tipo: string; categoriaNombre: string; montoGs: bigint; esVacuna: boolean;
  subcategoriaGastoId?: string; etapaCodigo?: string; proyectoId?: string;
  division?: { etapaCodigo: string; porcentaje: number }[];
};
export type Costeo = {
  datos: { subcategoriaGastoId: string | null; etapaCodigo: string | null; proyectoId: string | null; revisionPendiente: boolean; motivoRevision: string | null };
  division: { etapaCodigo: string; porcentaje: number; montoGs: bigint }[];
};

const VACIO: Costeo = { datos: { subcategoriaGastoId: null, etapaCodigo: null, proyectoId: null, revisionPendiente: false, motivoRevision: null }, division: [] };
const falla = (t: string) => new Error(`•${t}`);

export async function resolverCosteo(org: string, e: EntradaCosteo): Promise<Costeo> {
  if (e.tipo === "INGRESO") return VACIO;
  if ((await prisma.etapaCosto.count({ where: { organizacionId: org } })) === 0) await asegurarCatalogoCostos(org);
  const [subs, etapas] = await Promise.all([
    prisma.subcategoriaGasto.findMany({ where: { organizacionId: org }, select: { id: true, codigo: true, nombre: true, modo: true, etapaCodigo: true, nombresAnteriores: true, activa: true } }),
    prisma.etapaCosto.findMany({ where: { organizacionId: org, activa: true }, select: { codigo: true, nombre: true } }),
  ]);
  const validas = new Set(etapas.map(x => x.codigo));
  const elegida = !!e.subcategoriaGastoId; // la eligió la persona en el formulario → se exige completa
  let revision: string | null = null;
  let sub = elegida ? subs.find(s => s.id === e.subcategoriaGastoId && s.activa) : sugerirSubcategoria(subs, e.tipo, e.categoriaNombre, e.esVacuna);
  if (elegida && !sub) throw falla("Esa subcategoría no existe o está desactivada.");
  if (sub === null) return VACIO; // préstamo, cuota o aporte: no es costo
  if (!sub) { sub = subs.find(s => s.codigo === "OTR-01"); revision = "Categoría sin equivalente: elegí la subcategoría"; }
  if (!sub) return VACIO;

  if (sub.modo === "INVERSION") {
    if (e.tipo !== "INVERSION") throw falla(`«${sub.nombre}» es una inversión: elegí el tipo Inversión.`);
    let proyectoId: string | null = null;
    if (e.proyectoId) {
      if (!(await prisma.proyectoInversion.count({ where: { id: e.proyectoId, organizacionId: org } }))) throw falla("Ese proyecto no existe.");
      proyectoId = e.proyectoId;
    } else if (elegida) throw falla("Toda inversión va a un proyecto: elegilo (o crealo en Finanzas → Catálogos de costos → Proyectos).");
    else revision ??= "Elegí el proyecto de esta inversión";
    return { datos: { subcategoriaGastoId: sub.id, etapaCodigo: "INV", proyectoId, revisionPendiente: !!revision, motivoRevision: revision }, division: [] };
  }
  if (e.tipo === "INVERSION" && elegida) throw falla("Una inversión va con una subcategoría de inversión (INV-…).");

  if (sub.modo === "INVENTARIO") {
    return { datos: { subcategoriaGastoId: sub.id, etapaCodigo: sub.etapaCodigo, proyectoId: null, revisionPendiente: !!revision, motivoRevision: revision }, division: [] };
  }

  // Directo o a repartir: una etapa, o dividido entre varias
  const filas = (e.division ?? []).filter(f => f.etapaCodigo);
  if (filas.length) {
    if (filas.length < 2) throw falla("Para dividir hacen falta al menos dos etapas.");
    if (new Set(filas.map(f => f.etapaCodigo)).size !== filas.length) throw falla("Hay una etapa repetida en la división.");
    for (const f of filas) {
      if (!validas.has(f.etapaCodigo) || f.etapaCodigo === "INV") throw falla("Una de las etapas de la división no existe.");
      if (!(f.porcentaje > 0)) throw falla("Cada etapa de la división lleva un porcentaje mayor a cero.");
    }
    const suma = Math.round(filas.reduce((s, f) => s + f.porcentaje, 0) * 100);
    if (suma !== 10_000) throw falla(`Los porcentajes tienen que sumar 100 % (suman ${(suma / 100).toLocaleString("es-PY")} %).`);
    const montos = repartirMonto(e.montoGs, filas.map(f => f.porcentaje));
    return {
      datos: { subcategoriaGastoId: sub.id, etapaCodigo: null, proyectoId: null, revisionPendiente: !!revision, motivoRevision: revision },
      division: filas.map((f, i) => ({ etapaCodigo: f.etapaCodigo, porcentaje: f.porcentaje, montoGs: montos[i] })),
    };
  }
  let etapa = e.etapaCodigo || etapaPorModo(sub).etapaCodigo;
  if (etapa && (!validas.has(etapa) || etapa === "INV")) throw falla("Esa etapa no existe.");
  if (!etapa) {
    if (elegida) throw falla("Elegí la etapa donde se consumió, o «Dividir entre etapas» si sirvió a varias.");
    revision ??= "Indicá a qué etapa corresponde";
    etapa = null;
  }
  return { datos: { subcategoriaGastoId: sub.id, etapaCodigo: etapa, proyectoId: null, revisionPendiente: !!revision, motivoRevision: revision }, division: [] };
}
