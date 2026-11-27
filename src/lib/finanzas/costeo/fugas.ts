// Finanzas · costeo por etapa · Fase 7: Fugas. Dónde se está perdiendo plata, con los guaraníes en juego y a dónde
// ir a corregirlo. Cada fuga explica cómo se calcula. Período: meses AAAAMM (desde–hasta).
import "server-only";
import prisma from "@/lib/db/prisma";
import { resumenParadas } from "@/lib/cerdas-paradas/datos";
import { censo } from "./reparto";
import { costosPorEtapa } from "./costos-etapa";

export type Fuga = { clave: string; titulo: string; gs: number; detalle: string; como: string; href: string; accion: string; nivel: "alta" | "media" | "info" };

const inicioMes = (m: number) => new Date(Date.UTC(Math.floor(m / 100), (m % 100) - 1, 1));
const siguiente = (m: number) => (m % 100 === 12 ? (Math.floor(m / 100) + 1) * 100 + 1 : m + 1);
const diasMes = (m: number) => new Date(Date.UTC(Math.floor(m / 100), m % 100, 0)).getUTCDate();
const gs = (v: number) => `₲ ${Math.round(v).toLocaleString("es-PY")}`;
const n = (v: number, d = 0) => v.toLocaleString("es-PY", { maximumFractionDigits: d });

export async function fugas(org: string, desde: number, hasta: number) {
  const meses: number[] = [];
  for (let m = desde; m <= hasta; m = siguiente(m)) meses.push(m);
  const ini = inicioMes(desde), fin = inicioMes(siguiente(hasta));
  const params = await prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } });
  const lista: Fuga[] = [];
  const costos = await costosPorEtapa(org, desde, hasta);
  const censos = costos.censos as Record<number, Record<string, number>>;

  // 1) Desvío de alimento (cerdas): consumo cargado vs teórico (kg/día de Parámetros × cerdas × días)
  const consumos = await prisma.feedRecord.findMany({ where: { tenantId: org, anuladoEn: null, recordDate: { gte: ini, lt: fin }, feedType: { modulo: { in: ["GESTACION", "MATERNIDAD_HEMBRAS"] } } },
    select: { quantityKg: true, feedType: { select: { modulo: true, productoBalanceadoId: true } } } });
  const precioKg = async (productoId: string | null, dieta: string) => {
    if (productoId) { const p = await prisma.productoInventario.findUnique({ where: { id: productoId }, select: { costoPromedio: true } }); if (p?.costoPromedio) return Number(p.costoPromedio); }
    const c = await prisma.movimiento.aggregate({ where: { organizacionId: org, estado: { not: "ANULADO" }, categoria: { dieta }, cantidad: { gt: 0 }, fecha: { gte: new Date(ini.getTime() - 120 * 86_400_000), lt: fin } }, _sum: { montoGs: true, cantidad: true } });
    return c._sum.cantidad && Number(c._sum.cantidad) > 0 ? Number(c._sum.montoGs ?? 0n) / Number(c._sum.cantidad) : 0;
  };
  for (const [modulo, dieta, kgDia, cerdasDe, nombre] of [
    ["GESTACION", "GESTACION", Number(params?.consumoGestacionKgDia ?? 2.5), (c: Record<string, number>) => (c.CERDAS ?? 0) - (c.CERDAS_MAT ?? 0), "Gestación"],
    ["MATERNIDAD_HEMBRAS", "LACTACION", Number(params?.consumoLactacionKgDia ?? 8), (c: Record<string, number>) => c.CERDAS_MAT ?? 0, "Lactación"],
  ] as const) {
    const real = consumos.filter(c => c.feedType.modulo === modulo).reduce((s, c) => s + Number(c.quantityKg), 0);
    if (!real) continue; // sin consumos cargados no se puede comparar
    const teorico = meses.reduce((s, m) => s + cerdasDe(censos[m] ?? {}) * diasMes(m) * kgDia, 0);
    const exceso = real - teorico;
    if (teorico > 0 && exceso / teorico > 0.05) {
      const precio = await precioKg(consumos.find(c => c.feedType.modulo === modulo)?.feedType.productoBalanceadoId ?? null, dieta);
      lista.push({ clave: `alimento_${modulo}`, titulo: `Desvío de alimento en ${nombre}`, gs: exceso * precio, nivel: exceso / teorico > 0.15 ? "alta" : "media",
        detalle: `Se cargaron ${n(real)} kg y lo esperado eran ${n(teorico)} kg: ${n(exceso)} kg de más (${n((exceso / teorico) * 100)} %).`,
        como: `Teórico = cerdas a fin de cada mes × días del mes × ${n(kgDia, 2)} kg/día (Parámetros). Exceso × precio del kg (costo promedio del balanceado o última compra).`,
        href: "/sanidad", accion: "Revisar consumos" });
    }
  }

  // 2) Diferencias de inventario (conteos físicos)
  const conteos = await prisma.conteoInventario.findMany({ where: { tenantId: org, fecha: { gte: ini, lt: fin } }, select: { fecha: true, diferenciaGs: true, valorSistemaGs: true } });
  const faltante = conteos.reduce((s, c) => s + Math.min(0, Number(c.diferenciaGs)), 0);
  if (faltante < 0) {
    const valor = conteos.reduce((s, c) => s + Number(c.valorSistemaGs), 0);
    lista.push({ clave: "inventario", titulo: "Faltantes en el conteo de inventario", gs: -faltante, nivel: valor && -faltante / valor > 0.02 ? "alta" : "media",
      detalle: `${conteos.length} conteo(s): faltó mercadería por ${gs(-faltante)}${valor ? ` (${n((-faltante / valor) * 100, 1)} % del stock)` : ""}.`,
      como: "Σ (contado − sistema) × costo promedio, solo lo que falta.", href: "/inventario", accion: "Ver conteos" });
  }

  // 3) Suba de precio por insumo: precio por unidad del período vs los 3 meses anteriores (más de 10 %)
  const prev = new Date(ini.getTime() - 92 * 86_400_000);
  const compras = await prisma.movimiento.findMany({ where: { organizacionId: org, estado: { not: "ANULADO" }, tipo: "GASTO", cantidad: { gt: 0 }, fecha: { gte: prev, lt: fin } },
    select: { fecha: true, montoGs: true, cantidad: true, unidadMedida: true, productoSanitarioId: true, categoria: { select: { id: true, nombre: true } } } });
  const nombresProd = new Map((await prisma.productoInventario.findMany({ where: { tenantId: org }, select: { id: true, nombre: true } })).map(p => [p.id, p.nombre]));
  const porCat = new Map<string, { nombre: string; unidad: string; antes: [number, number]; ahora: [number, number] }>();
  for (const c of compras) {
    // Mismo insumo: misma categoría, misma unidad y, en Sanidad, el mismo producto (si no, se mezclan vacunas distintas)
    if (c.categoria.nombre === "Sanidad" && !c.productoSanitarioId) continue;
    const unidad = (c.unidadMedida ?? "unidad").trim().toLowerCase();
    const clave = `${c.categoria.id}|${c.productoSanitarioId ?? ""}|${unidad}`;
    const nombre = c.productoSanitarioId ? nombresProd.get(c.productoSanitarioId) ?? c.categoria.nombre : c.categoria.nombre;
    const x = porCat.get(clave) ?? { nombre, unidad, antes: [0, 0], ahora: [0, 0] };
    const k = c.fecha >= ini ? "ahora" : "antes";
    x[k][0] += Number(c.montoGs); x[k][1] += Number(c.cantidad);
    porCat.set(clave, x);
  }
  for (const x of porCat.values()) {
    if (!x.antes[1] || !x.ahora[1]) continue;
    const pAntes = x.antes[0] / x.antes[1], pAhora = x.ahora[0] / x.ahora[1];
    const suba = pAhora / pAntes - 1;
    if (suba > 0.1) lista.push({ clave: `precio_${x.nombre}`, titulo: `Subió el precio: ${x.nombre}`, gs: (pAhora - pAntes) * x.ahora[1], nivel: suba > 0.2 ? "alta" : "media",
      detalle: `${gs(pAntes)} → ${gs(pAhora)} por ${x.unidad} (+${n(suba * 100)} %) en ${n(x.ahora[1])} ${x.unidad}.`,
      como: "Precio por unidad del período ÷ promedio de los 3 meses anteriores − 1. En juego: diferencia de precio × cantidad comprada.", href: "/finanzas/movimientos", accion: "Ver compras" });
  }

  // 4) Cerdas paradas (hoy): días sin gestar ni lactar × costo diario
  try {
    const r = await resumenParadas(org);
    const paradas = r.paradas ?? [];
    const total = paradas.reduce((s, p) => s + p.perdidaGs, 0);
    if (total > 0) lista.push({ clave: "paradas", titulo: "Cerdas paradas", gs: total, nivel: paradas.some(p => p.alerta) ? "alta" : "media",
      detalle: `${paradas.length} cerda(s) sin gestar ni lactar hoy; ${paradas.filter(p => p.alerta).length} pasaron el límite.`,
      como: "Días parada × costo diario de la cerda (lo que gasta + lo que deja de producir).", href: "/finanzas/cerdas-paradas", accion: "Ver cerdas" });
  } catch { /* sin datos suficientes */ }

  // 5) Mortalidad valorizada: lechones muertos × lo que ya costaron
  const [muertesLact, muertesIni] = await Promise.all([
    prisma.pigletDeath.aggregate({ where: { tenantId: org, deathDatetime: { gte: ini, lt: fin } }, _sum: { quantity: true } }),
    prisma.animalEvent.findMany({ where: { tenantId: org, eventType: "DEATH", moduleSource: "RECRIA", eventDate: { gte: ini, lt: fin } }, select: { metadata: true } }),
  ]);
  const partos = await prisma.farrowingEvent.aggregate({ where: { tenantId: org, startDatetime: { gte: ini, lt: fin } }, _sum: { bornAlive: true } });
  const costoNacido = partos._sum.bornAlive ? costos.bases.gesMat / partos._sum.bornAlive : 0;
  const costoDestetado = costos.indicadores.costo_lechon_destetado ?? 0;
  const mLact = muertesLact._sum.quantity ?? 0;
  const mIni = muertesIni.reduce((s, e) => s + Number(((e.metadata ?? {}) as { quantity?: number }).quantity ?? 1), 0);
  const valorMort = mLact * costoNacido + mIni * costoDestetado;
  if (valorMort > 0) lista.push({ clave: "mortalidad", titulo: "Mortalidad valorizada", gs: valorMort, nivel: "media",
    detalle: `${n(mLact)} lechones muertos en lactancia${mIni ? ` y ${n(mIni)} en Iniciación` : ""}.`,
    como: "Muertos en lactancia × costo por lechón nacido vivo (Gestación + Maternidad ÷ nacidos vivos) + muertos en Iniciación × costo por lechón destetado.", href: "/maternidad", accion: "Ver Maternidad" });

  // 6) Peso de «Otros gastos» (OTR-01)
  const umbral = Number(params?.umbralOtrosGastos ?? 0.03);
  const [otros, totalGasto] = await Promise.all([
    prisma.movimiento.aggregate({ where: { organizacionId: org, mes: { gte: desde, lte: hasta }, estado: { not: "ANULADO" }, tipo: "GASTO", subcategoriaGasto: { codigo: "OTR-01" } }, _sum: { montoGs: true } }),
    prisma.movimiento.aggregate({ where: { organizacionId: org, mes: { gte: desde, lte: hasta }, estado: { not: "ANULADO" }, tipo: "GASTO" }, _sum: { montoGs: true } }),
  ]);
  const o = Number(otros._sum.montoGs ?? 0n), t = Number(totalGasto._sum.montoGs ?? 0n);
  if (t && o / t > umbral) lista.push({ clave: "otros", titulo: "Demasiado en «Otros gastos»", gs: o, nivel: "media",
    detalle: `${n((o / t) * 100, 1)} % del gasto está en Otros gastos (límite ${n(umbral * 100, 1)} %).`,
    como: "Otros gastos (OTR-01) ÷ gastos totales del período. Lo que va a Otros no se sabe en qué etapa se consumió.", href: "/finanzas/clasificacion", accion: "Reclasificar" });

  // 7) Gastos sin etapa o sin repartir
  if (costos.pendientes.cmp > 0 || costos.pendientes.sinEtapa > 0) lista.push({ clave: "pendientes", titulo: "Gastos que no llegan a ninguna etapa", gs: costos.pendientes.cmp + costos.pendientes.sinEtapa, nivel: "info",
    detalle: `${costos.pendientes.sinEtapa ? `${gs(costos.pendientes.sinEtapa)} sin etapa` : ""}${costos.pendientes.sinEtapa && costos.pendientes.cmp ? " · " : ""}${costos.pendientes.cmp ? `${gs(costos.pendientes.cmp)} compartidos que no se pueden repartir` : ""}.`,
    como: "No es plata perdida: es costo que no se ve en ninguna etapa, así que los costos por etapa quedan por debajo de la realidad.", href: costos.pendientes.sinEtapa ? "/finanzas/clasificacion" : "/finanzas/cierre", accion: costos.pendientes.sinEtapa ? "Asignar etapa" : "Ir al cierre" });

  lista.sort((a, b) => (a.nivel === "info" ? 1 : 0) - (b.nivel === "info" ? 1 : 0) || b.gs - a.gs);
  return { fugas: lista, totalGs: lista.filter(f => f.nivel !== "info").reduce((s, f) => s + f.gs, 0), umbralOtros: umbral, sinConsumos: consumos.length === 0 };
}
