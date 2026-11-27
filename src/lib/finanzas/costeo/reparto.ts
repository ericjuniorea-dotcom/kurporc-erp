// Finanzas · costeo por etapa · Fase 5: reparto de los gastos compartidos (etapa CMP) entre las etapas productivas.
// Criterios (sección 4.4 de la especificación, con lo que eligió la granja):
//   PERSONAL   → por persona de RRHH según su sector (pesa el sueldo base si está cargado; si no, 1 por persona)
//   POTENCIA   → kW instalados en cada etapa (luz)
//   ANIMALES   → animales presentes a fin de mes (agua y el resto)
//   PORCENTAJE → % fijo por etapa
//   ETAPA      → todo a una etapa (combustible de maquinaria → Mantenimiento)
import "server-only";
import prisma from "@/lib/db/prisma";
import { repartirMonto } from "./sugerir";

export const PRODUCTIVAS = ["GES", "MAT", "DES", "ENG"] as const;
export type Criterio = "PERSONAL" | "POTENCIA" | "ANIMALES" | "PORCENTAJE" | "ETAPA";
export type Regla = { subcategoriaCodigo: string; criterio: Criterio; valores: Record<string, number>; etapaCodigo: string | null };

export const CRITERIOS: Record<Criterio, { nombre: string; como: string }> = {
  PERSONAL: { nombre: "Por personal de cada módulo", como: "Cada persona de RRHH cuenta para la etapa de su sector (pesa su sueldo base si está cargado). «Todos» y veterinario se dividen entre las etapas productivas; administración no entra (es Estructura)." },
  POTENCIA: { nombre: "Por potencia instalada (kW)", como: "Monto × kW de la etapa ÷ kW totales." },
  ANIMALES: { nombre: "Por animales presentes", como: "Monto × animales de la etapa a fin de mes ÷ animales totales." },
  PORCENTAJE: { nombre: "Porcentaje fijo", como: "Monto × % de cada etapa." },
  ETAPA: { nombre: "Todo a una etapa", como: "El monto completo va a la etapa elegida." },
};

const DEFECTO: Regla[] = [
  { subcategoriaCodigo: "MOB-01", criterio: "PERSONAL", valores: {}, etapaCodigo: null },
  { subcategoriaCodigo: "MOB-02", criterio: "PERSONAL", valores: {}, etapaCodigo: null },
  { subcategoriaCodigo: "MOB-03", criterio: "PERSONAL", valores: {}, etapaCodigo: null },
  { subcategoriaCodigo: "ENE-01", criterio: "POTENCIA", valores: {}, etapaCodigo: null },
  { subcategoriaCodigo: "ENE-02", criterio: "ANIMALES", valores: {}, etapaCodigo: null },
  { subcategoriaCodigo: "LOG-03", criterio: "ETAPA", valores: {}, etapaCodigo: "MAN" },
  { subcategoriaCodigo: "*", criterio: "ANIMALES", valores: {}, etapaCodigo: null },
];

export async function reglasDe(org: string): Promise<Regla[]> {
  const guardadas = await prisma.reglaReparto.findMany({ where: { organizacionId: org } });
  const porCodigo = new Map(guardadas.map(g => [g.subcategoriaCodigo, { subcategoriaCodigo: g.subcategoriaCodigo, criterio: g.criterio as Criterio, valores: (g.valores ?? {}) as Record<string, number>, etapaCodigo: g.etapaCodigo }]));
  const todas = DEFECTO.map(d => porCodigo.get(d.subcategoriaCodigo) ?? d);
  for (const g of porCodigo.values()) if (!todas.some(t => t.subcategoriaCodigo === g.subcategoriaCodigo)) todas.push(g);
  return todas;
}
export const reglaPara = (reglas: Regla[], codigo: string) => reglas.find(r => r.subcategoriaCodigo === codigo) ?? reglas.find(r => r.subcategoriaCodigo === "*")!;

const finDeMes = (mes: number) => new Date(Date.UTC(Math.floor(mes / 100), mes % 100, 1) - 1);

/** Animales presentes por etapa al último día del mes. */
export async function censo(org: string, mes: number): Promise<Record<string, number>> {
  const fin = finDeMes(mes);
  const [cerdas, verracos, partos, recria, engorde] = await Promise.all([
    prisma.sow.findMany({ where: { tenantId: org, entryDate: { lte: fin }, OR: [{ isActive: true }, { discards: { some: { discardDate: { gt: fin } } } }] }, select: { id: true } }),
    prisma.boar.count({ where: { tenantId: org, isActive: true, OR: [{ entryDate: null }, { entryDate: { lte: fin } }] } }),
    prisma.farrowingEvent.findMany({ where: { tenantId: org, startDatetime: { lte: fin }, OR: [{ weaning: null }, { weaning: { weaningDate: { gt: fin } } }] }, select: { sowId: true, bornAlive: true } }),
    prisma.nurseryBatch.aggregate({ where: { tenantId: org, entryDate: { lte: fin }, isActive: true }, _sum: { currentCount: true } }),
    prisma.growingBatch.aggregate({ where: { tenantId: org, entryDate: { lte: fin }, OR: [{ status: "ACTIVE" }, { closedAt: { gt: fin } }] }, _sum: { currentCount: true } }),
  ]);
  const enMat = new Set(partos.map(p => p.sowId));
  return {
    GES: cerdas.filter(c => !enMat.has(c.id)).length + verracos,
    MAT: enMat.size + partos.reduce((s, p) => s + p.bornAlive, 0),
    DES: recria._sum.currentCount ?? 0,
    ENG: engorde._sum.currentCount ?? 0,
  };
}

const SECTOR_ETAPA: Record<string, string> = { gestacion: "GES", maternidad: "MAT", recria: "DES", iniciacion: "DES", engorde: "ENG" };

/** Personal por etapa: el peso de cada persona (sueldo base o 1) va a la etapa de su sector. */
export async function personal(org: string, etapasConAnimales: string[]): Promise<Record<string, number>> {
  const gente = await prisma.employee.findMany({ where: { tenantId: org, isActive: true }, select: { sector: true, baseSalaryGs: true } });
  const conSueldo = gente.some(g => Number(g.baseSalaryGs) > 0);
  const destinoComun = etapasConAnimales.length ? etapasConAnimales : [...PRODUCTIVAS];
  const pesos: Record<string, number> = {};
  for (const g of gente) {
    const sector = (g.sector ?? "").toLowerCase();
    if (sector === "admin") continue;
    const peso = conSueldo ? Number(g.baseSalaryGs) : 1;
    if (!(peso > 0)) continue;
    const etapa = SECTOR_ETAPA[sector];
    if (etapa) pesos[etapa] = (pesos[etapa] ?? 0) + peso;
    else for (const e of destinoComun) pesos[e] = (pesos[e] ?? 0) + peso / destinoComun.length; // «todos», veterinario
  }
  return pesos;
}

export type LineaReparto = { movimientoId: string; fecha: string; concepto: string; subcategoria: string; montoGs: bigint; criterio: Criterio; partes: { etapa: string; porcentaje: number; montoGs: bigint }[]; error: string | null };

/** Propuesta de reparto de los gastos compartidos del mes (no escribe nada). */
export async function proponerReparto(org: string, mes: number) {
  const [movs, reglas, animales, subs] = await Promise.all([
    prisma.movimiento.findMany({ where: { organizacionId: org, mes, etapaCodigo: "CMP", estado: { not: "ANULADO" } }, orderBy: { fecha: "asc" },
      select: { id: true, fecha: true, concepto: true, montoGs: true, subcategoriaGasto: { select: { codigo: true, nombre: true } } } }),
    reglasDe(org), censo(org, mes),
    prisma.subcategoriaGasto.findMany({ where: { organizacionId: org }, select: { codigo: true, nombre: true } }),
  ]);
  const etapasConAnimales = PRODUCTIVAS.filter(e => (animales[e] ?? 0) > 0);
  const gente = await personal(org, etapasConAnimales);
  const pesosDe = (r: Regla): { pesos: Record<string, number>; error: string | null } => {
    if (r.criterio === "ETAPA") return r.etapaCodigo ? { pesos: { [r.etapaCodigo]: 1 }, error: null } : { pesos: {}, error: "Falta elegir la etapa." };
    const pesos = r.criterio === "PERSONAL" ? gente : r.criterio === "ANIMALES" ? animales : r.valores;
    const limpio = Object.fromEntries(Object.entries(pesos).filter(([, v]) => Number(v) > 0));
    if (!Object.keys(limpio).length) {
      return { pesos: {}, error: r.criterio === "POTENCIA" ? "Falta cargar la potencia instalada (kW) de cada etapa."
        : r.criterio === "PERSONAL" ? "No hay personal de producción con sector en RRHH."
        : r.criterio === "ANIMALES" ? "No hay animales presentes a fin de mes." : "Faltan los porcentajes." };
    }
    if (r.criterio === "PORCENTAJE") {
      const suma = Math.round(Object.values(limpio).reduce((s, v) => s + Number(v), 0) * 100);
      if (suma !== 10_000) return { pesos: {}, error: `Los porcentajes suman ${(suma / 100).toLocaleString("es-PY")} %: tienen que sumar 100 %.` };
    }
    return { pesos: limpio, error: null };
  };
  const lineas: LineaReparto[] = movs.map(m => {
    const codigo = m.subcategoriaGasto?.codigo ?? "*";
    const r = reglaPara(reglas, codigo);
    const { pesos, error } = pesosDe(r);
    const etapas = Object.keys(pesos);
    const total = etapas.reduce((s, e) => s + Number(pesos[e]), 0);
    const pcts = etapas.map(e => (Number(pesos[e]) / total) * 100);
    const montos = error ? [] : repartirMonto(m.montoGs, pcts);
    return {
      movimientoId: m.id, fecha: m.fecha.toISOString().slice(0, 10), concepto: m.concepto,
      subcategoria: m.subcategoriaGasto ? `${m.subcategoriaGasto.codigo} · ${m.subcategoriaGasto.nombre}` : "Sin subcategoría",
      montoGs: m.montoGs, criterio: r.criterio, error,
      partes: error ? [] : etapas.map((e, i) => ({ etapa: e, porcentaje: Math.round(pcts[i] * 10_000) / 10_000, montoGs: montos[i] })),
    };
  });
  const hechos = new Set((await prisma.repartoMes.findMany({ where: { organizacionId: org, mes }, select: { movimientoId: true }, distinct: ["movimientoId"] })).map(r => r.movimientoId));
  return { lineas, animales, personal: gente, reglas, subcategorias: subs, repartidos: lineas.filter(l => hechos.has(l.movimientoId)).length };
}

/** Aplica el reparto del mes (reemplaza el anterior). Bloquea si alguna línea tiene un error. */
export async function aplicarReparto(org: string, mes: number, usuarioId: string) {
  const { lineas } = await proponerReparto(org, mes);
  const conError = lineas.filter(l => l.error);
  if (conError.length) throw new Error(`•No se puede repartir: ${[...new Set(conError.map(l => l.error))].join(" ")}`);
  await prisma.$transaction(async tx => {
    await tx.repartoMes.deleteMany({ where: { organizacionId: org, mes } });
    const filas = lineas.flatMap(l => l.partes.map(p => ({ organizacionId: org, mes, movimientoId: l.movimientoId, etapaCodigo: p.etapa, porcentaje: p.porcentaje, montoGs: p.montoGs, criterio: l.criterio, creadoPor: usuarioId })));
    if (filas.length) await tx.repartoMes.createMany({ data: filas });
  });
  return lineas.length;
}

/** ¿Quedan gastos compartidos del mes sin repartir? (R15: el cierre se bloquea) */
export async function pendientesDeReparto(org: string, mes: number) {
  const cmp = await prisma.movimiento.findMany({ where: { organizacionId: org, mes, etapaCodigo: "CMP", estado: { not: "ANULADO" } }, select: { id: true } });
  if (!cmp.length) return 0;
  const hechos = new Set((await prisma.repartoMes.findMany({ where: { organizacionId: org, mes, movimientoId: { in: cmp.map(c => c.id) } }, select: { movimientoId: true } })).map(r => r.movimientoId));
  return cmp.filter(c => !hechos.has(c.id)).length;
}
