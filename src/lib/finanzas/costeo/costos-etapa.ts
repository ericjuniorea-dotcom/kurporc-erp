// Finanzas · costeo por etapa · Fase 6: costo de cada etapa por categoría de gasto, en un período (meses AAAAMM).
// Fuentes (sin contar nada dos veces):
//   · Gastos del libro con etapa directa, o divididos entre etapas, o repartidos al cerrar (los compartidos).
//   · Insumos (alimento, sanidad, semen…): lo que SALIÓ del inventario valorizado a costo promedio (R3). Las compras
//     que entraron al inventario no cuentan; las que nunca pasaron por el inventario cuentan en el mes de la compra.
//   · Inversiones no entran (van a su proyecto y se deprecian, Fase 8). Los financieros se muestran aparte.
// «Con apoyo y estructura»: Mantenimiento, Áreas verdes, Bioseguridad y Estructura se reparten cada mes entre las
// etapas productivas por animales presentes a fin de mes (R9, R10: la estructura se muestra siempre aparte también).
import "server-only";
import prisma from "@/lib/db/prisma";
import { censo, proponerReparto } from "./reparto";

export const PRODUCTIVAS = ["GES", "MAT", "DES", "ENG"];
const APOYO_Y_ESTRUCTURA = ["MAN", "VER", "BIO", "EST"];
const DIETA_ETAPA: Record<string, string> = { GESTACION: "GES", LACTACION: "MAT", VILO_BABY: "MAT", PRE_INICIAL_1: "MAT", PRE_INICIAL_2: "DES", INICIAL: "DES", CRECIMIENTO: "ENG", TERMINACION: "ENG" };
const CAT_PRODUCTO: Record<string, string> = { BALANCEADO: "ALI", VACUNA: "SAN", MEDICAMENTO: "SAN", SUPLEMENTO: "SAN", EQUIPAMIENTO: "INS" };

export type Partida = { etapa: string; categoria: string; gs: number; fuente: "LIBRO" | "INVENTARIO" | "REPARTO" | "APOYO"; texto: string; mes: number };

const mesesEntre = (desde: number, hasta: number) => {
  const r: number[] = [];
  for (let m = desde; m <= hasta; m = m % 100 === 12 ? (Math.floor(m / 100) + 1) * 100 + 1 : m + 1) r.push(m);
  return r;
};
const inicioMes = (m: number) => new Date(Date.UTC(Math.floor(m / 100), (m % 100) - 1, 1));
const mesDe = (d: Date) => d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;

export async function costosPorEtapa(org: string, desde: number, hasta: number) {
  const meses = mesesEntre(desde, hasta);
  const ini = inicioMes(desde), fin = inicioMes(meses.length ? (hasta % 100 === 12 ? (Math.floor(hasta / 100) + 1) * 100 + 1 : hasta + 1) : desde);
  const [etapas, categorias, movs, salidas, productos] = await Promise.all([
    prisma.etapaCosto.findMany({ where: { organizacionId: org }, orderBy: { orden: "asc" }, select: { codigo: true, nombre: true, tipo: true } }),
    prisma.categoriaGasto.findMany({ where: { organizacionId: org }, orderBy: { orden: "asc" }, select: { codigo: true, nombre: true } }),
    prisma.movimiento.findMany({
      where: { organizacionId: org, mes: { gte: desde, lte: hasta }, estado: { not: "ANULADO" }, tipo: { in: ["GASTO", "FINANCIAMIENTO"] }, subcategoriaGastoId: { not: null } },
      select: { id: true, mes: true, concepto: true, montoGs: true, etapaCodigo: true, fleteRecepcionId: true, productoSanitarioId: true,
        categoria: { select: { nombre: true, dieta: true } }, subcategoriaGasto: { select: { codigo: true, nombre: true, modo: true, categoria: { select: { codigo: true } } } },
        division: { select: { etapaCodigo: true, montoGs: true } }, _count: { select: { recepciones: true } } },
    }),
    prisma.movimientoInventario.findMany({
      where: { tenantId: org, fecha: { gte: ini, lt: fin }, etapaCodigo: { not: null }, origen: { not: "COMPRA" }, costoGs: { not: null } },
      select: { fecha: true, tipo: true, cantidad: true, costoGs: true, etapaCodigo: true, productoId: true },
    }),
    prisma.productoInventario.findMany({ where: { tenantId: org }, select: { id: true, nombre: true, categoria: true, etapaConsumoCodigo: true, subcategoriaGastoId: true } }),
  ]);
  const catDeSub = new Map((await prisma.subcategoriaGasto.findMany({ where: { organizacionId: org }, select: { id: true, categoria: { select: { codigo: true } } } })).map(x => [x.id, x.categoria.codigo]));
  const prod = new Map(productos.map(p => [p.id, p]));
  const repartos = await prisma.repartoMes.findMany({ where: { organizacionId: org, movimientoId: { in: movs.filter(m => m.etapaCodigo === "CMP").map(m => m.id) } }, select: { movimientoId: true, etapaCodigo: true, montoGs: true } });
  const repartoDe = new Map<string, { etapaCodigo: string; montoGs: bigint }[]>();
  for (const r of repartos) repartoDe.set(r.movimientoId, [...(repartoDe.get(r.movimientoId) ?? []), r]);

  // Meses todavía sin repartir: se usa el reparto propuesto (estimado) para que el costo no quede en «Compartido»
  const estimado = new Map<string, { etapa: string; montoGs: bigint }[]>();
  const mesesSinReparto = [...new Set(movs.filter(m => m.etapaCodigo === "CMP" && !repartoDe.has(m.id)).map(m => m.mes))];
  for (const mes of mesesSinReparto) {
    const p = await proponerReparto(org, mes);
    for (const l of p.lineas) if (!l.error) estimado.set(l.movimientoId, l.partes);
  }

  const partidas: Partida[] = [];
  for (const m of movs) {
    const sub = m.subcategoriaGasto!;
    const cat = sub.categoria.codigo;
    const texto = `${m.concepto} (${sub.codigo})`;
    const add = (etapa: string, gs: number, fuente: Partida["fuente"] = "LIBRO") => partidas.push({ etapa, categoria: cat, gs, fuente, texto, mes: m.mes });
    if (m.etapaCodigo === "INV") continue;
    if (sub.modo === "INVENTARIO" || m.fleteRecepcionId) {
      if (m._count.recepciones > 0) continue;                       // entró al inventario: cuenta cuando sale
      if (m.fleteRecepcionId && !m.etapaCodigo) continue;            // flete sumado al costo del ítem
      // Compra que no pasó por el inventario: cuenta en el mes de la compra
      const etapa = m.etapaCodigo ?? (m.categoria.dieta ? DIETA_ETAPA[m.categoria.dieta] : null) ?? (m.productoSanitarioId ? prod.get(m.productoSanitarioId)?.etapaConsumoCodigo : null) ?? "SIN";
      add(etapa, Number(m.montoGs));
      continue;
    }
    if (m.division.length) { for (const d of m.division) add(d.etapaCodigo, Number(d.montoGs)); continue; }
    if (m.etapaCodigo === "CMP") {
      const r = repartoDe.get(m.id);
      const e = estimado.get(m.id);
      if (r?.length) for (const x of r) add(x.etapaCodigo, Number(x.montoGs), "REPARTO");
      else if (e?.length) for (const x of e) partidas.push({ etapa: x.etapa, categoria: cat, gs: Number(x.montoGs), fuente: "REPARTO", texto: `${texto} · reparto estimado (mes sin cerrar)`, mes: m.mes });
      else add("CMP", Number(m.montoGs));
      continue;
    }
    add(m.etapaCodigo ?? "SIN", Number(m.montoGs));
  }
  for (const s of salidas) {
    const p = prod.get(s.productoId);
    const signo = s.tipo === "SALIDA" ? 1 : s.tipo === "ENTRADA" ? -1 : -Math.sign(Number(s.cantidad));
    partidas.push({ etapa: s.etapaCodigo!, categoria: (p?.subcategoriaGastoId ? catDeSub.get(p.subcategoriaGastoId) : undefined) ?? CAT_PRODUCTO[p?.categoria ?? ""] ?? "OTR",
      gs: signo * Number(s.costoGs), fuente: "INVENTARIO", texto: `Consumo de ${p?.nombre ?? "insumo"}`, mes: mesDe(s.fecha) });
  }

  // Apoyo y estructura → etapas productivas, mes a mes, por animales presentes
  const censos = new Map<number, Record<string, number>>();
  for (const mes of meses) censos.set(mes, await censo(org, mes));
  const repartidoApoyo: Partida[] = [];
  for (const mes of meses) {
    const c = censos.get(mes)!;
    const base = PRODUCTIVAS.filter(e => (c[e] ?? 0) > 0);
    const totalAnimales = base.reduce((s, e) => s + c[e], 0);
    if (!totalAnimales) continue;
    for (const p of partidas.filter(x => x.mes === mes && APOYO_Y_ESTRUCTURA.includes(x.etapa))) {
      for (const e of base) repartidoApoyo.push({ etapa: e, categoria: p.categoria, gs: (p.gs * c[e]) / totalAnimales, fuente: "APOYO", texto: `Parte de ${p.etapa}: ${p.texto}`, mes });
    }
  }

  // Matrices
  const sumar = (lista: Partida[]) => {
    const m: Record<string, Record<string, number>> = {};
    for (const p of lista) { m[p.etapa] ??= {}; m[p.etapa][p.categoria] = (m[p.etapa][p.categoria] ?? 0) + p.gs; }
    return m;
  };
  const directo = sumar(partidas);
  const conApoyo = sumar([...partidas.filter(p => !APOYO_Y_ESTRUCTURA.includes(p.etapa)), ...repartidoApoyo]);
  const totalEtapa = (m: Record<string, Record<string, number>>, e: string) => Object.values(m[e] ?? {}).reduce((s, v) => s + v, 0);

  // Indicadores
  const [destetes, ] = await Promise.all([
    prisma.weaningEvent.aggregate({ where: { farrowing: { tenantId: org }, weaningDate: { gte: ini, lt: fin } }, _sum: { pigletsWeaned: true, totalLitterWeightKg: true } }),
  ]);
  const destetados = destetes._sum.pigletsWeaned ?? 0;
  const kgDestetados = Number(destetes._sum.totalLitterWeightKg ?? 0);
  const cerdasProm = meses.length ? meses.reduce((s, mes) => s + (censos.get(mes)!.CERDAS ?? 0), 0) / meses.length : 0;
  const gesMat = totalEtapa(conApoyo, "GES") + totalEtapa(conApoyo, "MAT");
  const gesMatDirecto = totalEtapa(directo, "GES") + totalEtapa(directo, "MAT");
  const totalProductivo = PRODUCTIVAS.reduce((s, e) => s + totalEtapa(directo, e), 0);
  const alimentacion = PRODUCTIVAS.reduce((s, e) => s + (directo[e]?.ALI ?? 0), 0);
  const estructura = totalEtapa(directo, "EST");
  const totalGeneral = [...PRODUCTIVAS, ...APOYO_Y_ESTRUCTURA].reduce((s, e) => s + totalEtapa(directo, e), 0);

  return {
    meses, etapas, categorias, directo, conApoyo, censos: Object.fromEntries(censos),
    partidas: [...partidas, ...repartidoApoyo],
    pendientes: { cmp: totalEtapa(directo, "CMP"), sinEtapa: totalEtapa(directo, "SIN"), estimadoGs: [...estimado.values()].flat().reduce((s, x) => s + Number(x.montoGs), 0) },
    financieros: totalEtapa(directo, "FIN"),
    indicadores: {
      costo_lechon_destetado: destetados ? gesMat / destetados : null,
      costo_kg_destetado: kgDestetados ? gesMat / kgDestetados : null,
      costo_cerda_anio: cerdasProm ? (gesMatDirecto / cerdasProm) * (12 / meses.length) : null,
      peso_alimentacion: totalProductivo ? (alimentacion / totalProductivo) * 100 : null,
      peso_estructura: totalGeneral ? (estructura / totalGeneral) * 100 : null,
    },
    bases: { destetados, kgDestetados, cerdasProm, gesMat, gesMatDirecto, totalProductivo, totalGeneral },
  };
}
