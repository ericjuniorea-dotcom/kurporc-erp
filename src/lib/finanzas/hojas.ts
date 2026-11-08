// Hojas de la planilla de Finanzas (Fase 8, parte 2) como funciones puras: reciben los datos del año ya
// cargados y devuelven las tablas mes a mes. Sin base de datos: se prueban con `npm run prueba:finanzas`.
// Montos en bigint (guaraníes); kilos y cantidades en number.

export const DIETAS = ["GESTACION", "LACTACION", "VILO_BABY", "PRE_INICIAL_1", "PRE_INICIAL_2", "INICIAL", "CRECIMIENTO", "TERMINACION"] as const;
export type Dieta = (typeof DIETAS)[number];
export const NOMBRE_DIETA: Record<Dieta, string> = {
  GESTACION: "Gestación", LACTACION: "Lactación", VILO_BABY: "Vilo Baby", PRE_INICIAL_1: "Pre-inicial 1",
  PRE_INICIAL_2: "Pre-inicial 2", INICIAL: "Inicial", CRECIMIENTO: "Crecimiento", TERMINACION: "Terminación",
};
export const DIETAS_LECHONES: Dieta[] = ["VILO_BABY", "PRE_INICIAL_1", "PRE_INICIAL_2", "INICIAL"];
export const DIETAS_MATRICES: Dieta[] = ["GESTACION", "LACTACION"];

/** Movimiento ya cargado (sin anulados), con lo que necesitan las hojas. */
export type MovHoja = {
  mes: number; tipo: "INGRESO" | "GASTO" | "INVERSION" | "FINANCIAMIENTO"; montoGs: bigint; cantidad: number | null;
  fecha: Date; esInterno: boolean;
  categoria: { id: string; nombre: string; naturaleza: string; area: string; grupoCosto: string | null; dieta: string | null; vidaUtil: string | null };
};
/** Producción del mes (sale de los módulos productivos). */
export type ProdMes = {
  servicios: number; partos: number; nacidosTotales: number; nacidosVivos: number; muertosAlNacer: number;
  destetados: number; muertosLactancia: number; entregados: number; kgEntregados: number; ingresosLechonesGs: bigint;
};
export type ParamsHojas = {
  vidaObraAnios: number; vidaEquiposAnios: number; modoAmortizacion: "PLANILLA" | "POR_ACTIVO";
  amortizarMatrices: boolean; vidaMatrizMeses: number; valorDescarteMatrizGs: bigint; imputacionSanidad: "COMPRA" | "USO";
};

export const meses12 = (anio: number) => Array.from({ length: 12 }, (_, i) => anio * 100 + i + 1);
const idx = (mes: number) => (mes % 100) - 1;
const ceros = () => Array.from({ length: 12 }, () => 0n);
const cerosN = () => Array.from({ length: 12 }, () => 0);
export const sumaB = (xs: bigint[]) => xs.reduce((s, x) => s + x, 0n);
export const sumaN = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
/** División segura: null si el divisor es 0. */
export const div = (a: bigint | number, b: number): number | null => (b ? Number(a) / b : null);

// ── 8.8 D · Alimentación ──────────────────────────────────────────
export function hojaAlimentacion(movs: MovHoja[], prod: ProdMes[], matricesPorMes: number[]) {
  const gs = Object.fromEntries(DIETAS.map(d => [d, ceros()])) as Record<Dieta, bigint[]>;
  const kg = Object.fromEntries(DIETAS.map(d => [d, cerosN()])) as Record<Dieta, number[]>;
  for (const m of movs) {
    if (m.tipo !== "GASTO" || m.categoria.grupoCosto !== "ALIMENTACION" || !m.categoria.dieta) continue;
    const d = m.categoria.dieta as Dieta;
    if (!gs[d]) continue;
    gs[d][idx(m.mes)] += m.montoGs;
    kg[d][idx(m.mes)] += m.cantidad ?? 0;
  }
  // Precio por kilo: Gs ÷ kg del mes; un mes sin compras repite el del mes anterior
  const precio = Object.fromEntries(DIETAS.map(d => {
    let anterior: number | null = null;
    return [d, gs[d].map((g, i) => { const p = kg[d][i] > 0 ? Number(g) / kg[d][i] : anterior; anterior = p; return p; })];
  })) as Record<Dieta, (number | null)[]>;
  const totalGs = Array.from({ length: 12 }, (_, i) => DIETAS.reduce((s, d) => s + gs[d][i], 0n));
  const totalKg = Array.from({ length: 12 }, (_, i) => DIETAS.reduce((s, d) => s + kg[d][i], 0));
  const lechonesGs = Array.from({ length: 12 }, (_, i) => DIETAS_LECHONES.reduce((s, d) => s + gs[d][i], 0n));
  const matricesGs = Array.from({ length: 12 }, (_, i) => DIETAS_MATRICES.reduce((s, d) => s + gs[d][i], 0n));
  const indicadores = {
    porMatriz: totalGs.map((g, i) => div(g, matricesPorMes[i])),
    matricesPorMatriz: matricesGs.map((g, i) => div(g, matricesPorMes[i])),
    porDestetado: lechonesGs.map((g, i) => div(g, prod[i]?.destetados ?? 0)),
    porEntregado: totalGs.map((g, i) => div(g, prod[i]?.entregados ?? 0)),
    porKgEntregado: totalGs.map((g, i) => div(g, prod[i]?.kgEntregados ?? 0)),
    kgPorMatriz: totalKg.map((k, i) => div(k, matricesPorMes[i])),
  };
  return { gs, kg, precio, totalGs, totalKg, lechonesGs, matricesGs, indicadores };
}

// ── 8.11 · Amortización ───────────────────────────────────────────
/** Amortización de cada mes del año. Los meses posteriores al corte (si se indica) quedan en 0: todavía no pasaron. */
export function amortizacionMensual(inversiones: MovHoja[], p: ParamsHojas, anio: number, mesCorte?: number): bigint[] {
  const tope = mesCorte && Math.floor(mesCorte / 100) === anio ? (mesCorte % 100) - 1 : mesCorte && Math.floor(mesCorte / 100) < anio ? -1 : 11;
  return calcularAmortizacion(inversiones, p, anio).map((v, i) => (i <= tope ? v : 0n));
}

function calcularAmortizacion(inversiones: MovHoja[], p: ParamsHojas, anio: number): bigint[] {
  const out = ceros();
  const obra = (m: MovHoja) => m.categoria.vidaUtil === "OBRA";
  const equipos = (m: MovHoja) => m.categoria.vidaUtil === "EQUIPOS";
  const invs = inversiones.filter(m => m.tipo === "INVERSION");
  if (p.modoAmortizacion === "PLANILLA") {
    // Réplica exacta: desde enero, sobre todo lo invertido en esas categorías
    const totObra = sumaB(invs.filter(obra).map(m => m.montoGs));
    const totEq = sumaB(invs.filter(equipos).map(m => m.montoGs));
    const mensual = totObra / BigInt(p.vidaObraAnios * 12) + totEq / BigInt(p.vidaEquiposAnios * 12);
    return out.map(() => mensual);
  }
  // Por activo: desde el mes siguiente a su fecha, con la vida útil de su categoría
  for (const m of invs) {
    let vidaMeses = 0, base = m.montoGs;
    if (obra(m)) vidaMeses = p.vidaObraAnios * 12;
    else if (equipos(m)) vidaMeses = p.vidaEquiposAnios * 12;
    else if (m.categoria.vidaUtil === "MATRIZ" && p.amortizarMatrices) {
      vidaMeses = p.vidaMatrizMeses;
      const descarte = p.valorDescarteMatrizGs * BigInt(Math.max(1, Math.round(m.cantidad ?? 1)));
      base = base > descarte ? base - descarte : 0n;
    }
    if (!vidaMeses || base <= 0n) continue;
    const cuota = base / BigInt(vidaMeses);
    const inicio = m.fecha.getUTCFullYear() * 12 + m.fecha.getUTCMonth() + 1; // mes siguiente (índice absoluto)
    for (let i = 0; i < 12; i++) {
      const abs = anio * 12 + i;
      if (abs >= inicio && abs < inicio + vidaMeses) out[i] += cuota;
    }
  }
  return out;
}

// ── 8.11 · Costos de producción ───────────────────────────────────
export type FilaCosto = { clave: string; etiqueta: string; valores: bigint[] };
export function hojaCostos(
  movsAnio: MovHoja[], movsInversionHastaAnio: MovHoja[], prod: ProdMes[], matricesPorMes: number[],
  p: ParamsHojas, anio: number, sanidadUsadaGs?: bigint[], mesCorte?: number,
) {
  const gastos = movsAnio.filter(m => m.tipo === "GASTO" && !m.esInterno);
  const alim = hojaAlimentacion(movsAnio, prod, matricesPorMes);
  const filasAlim: FilaCosto[] = DIETAS.filter(d => alim.gs[d].some(v => v > 0n)).map(d => ({ clave: d, etiqueta: NOMBRE_DIETA[d], valores: alim.gs[d] }));
  const porCategoria = (grupo: string) => {
    const mapa = new Map<string, FilaCosto>();
    for (const m of gastos) {
      if (m.categoria.grupoCosto !== grupo) continue;
      const f = mapa.get(m.categoria.id) ?? { clave: m.categoria.id, etiqueta: m.categoria.nombre, valores: ceros() };
      f.valores[idx(m.mes)] += m.montoGs;
      mapa.set(m.categoria.id, f);
    }
    return Array.from(mapa.values());
  };
  let directos = porCategoria("OTROS_DIRECTOS");
  if (p.imputacionSanidad === "USO" && sanidadUsadaGs) {
    // La sanidad entra al costo el mes en que se aplicó (no cuando se compró)
    directos = directos.filter(f => f.etiqueta !== "Sanidad");
    directos.unshift({ clave: "SANIDAD_USADA", etiqueta: "Sanidad (lo aplicado)", valores: sanidadUsadaGs });
  }
  const estructura = porCategoria("ESTRUCTURA");
  const sub = (fs: FilaCosto[]) => Array.from({ length: 12 }, (_, i) => fs.reduce((s, f) => s + f.valores[i], 0n));
  const subAlim = alim.totalGs, subDirectos = sub(directos), subEstructura = sub(estructura);
  const amortizacion = amortizacionMensual(movsInversionHastaAnio, p, anio, mesCorte);
  const sinAmort = Array.from({ length: 12 }, (_, i) => subAlim[i] + subDirectos[i] + subEstructura[i]);
  const conAmort = sinAmort.map((v, i) => v + amortizacion[i]);
  const unit = {
    entregados: prod.map(x => x.entregados), kgEntregados: prod.map(x => x.kgEntregados), destetados: prod.map(x => x.destetados),
    ingresos: prod.map(x => x.ingresosLechonesGs),
    precioPromedio: prod.map(x => div(x.ingresosLechonesGs, x.entregados)),
    costoPorEntregado: conAmort.map((c, i) => div(c, prod[i]?.entregados ?? 0)),
    costoPorKg: conAmort.map((c, i) => div(c, prod[i]?.kgEntregados ?? 0)),
    costoPorMatriz: conAmort.map((c, i) => div(c, matricesPorMes[i])),
    costoPorDestetado: conAmort.map((c, i) => div(c, prod[i]?.destetados ?? 0)),
    participacionAlimento: conAmort.map((c, i) => (c > 0n ? Number(subAlim[i]) / Number(c) : null)),
    alimentoPorMatriz: subAlim.map((a, i) => div(a, matricesPorMes[i])),
  };
  const margenPorLechon = unit.precioPromedio.map((pr, i) => (pr !== null && unit.costoPorEntregado[i] !== null ? pr - unit.costoPorEntregado[i]! : null));
  const margenSobrePrecio = margenPorLechon.map((m, i) => (m !== null && unit.precioPromedio[i] ? m / unit.precioPromedio[i]! : null));
  return { filasAlim, directos, estructura, subAlim, subDirectos, subEstructura, amortizacion, sinAmort, conAmort, unit: { ...unit, margenPorLechon, margenSobrePrecio } };
}

// ── 8.12 · Gastos fijos y variables ───────────────────────────────
export function hojaFijosVariables(movsAnio: MovHoja[], mesCorte: number) {
  const gastos = movsAnio.filter(m => m.tipo === "GASTO" && !m.esInterno);
  const fijos = ceros(), variables = ceros();
  const cats = new Map<string, { nombre: string; naturaleza: string; area: string; total: bigint }>();
  for (const m of gastos) {
    if (m.categoria.naturaleza === "FIJO") fijos[idx(m.mes)] += m.montoGs; else variables[idx(m.mes)] += m.montoGs;
    const c = cats.get(m.categoria.id) ?? { nombre: m.categoria.nombre, naturaleza: m.categoria.naturaleza, area: m.categoria.area, total: 0n };
    c.total += m.montoGs;
    cats.set(m.categoria.id, c);
  }
  const total = fijos.map((f, i) => f + variables[i]);
  let acum = 0n;
  const acumulado = total.map(t => (acum += t));
  const totalAnio = sumaB(total);
  const mesesTranscurridos = Math.max(1, mesCorte % 100);
  const detalle = Array.from(cats.values()).sort((a, b) => (b.total > a.total ? 1 : -1)).map(c => ({
    ...c, pct: totalAnio > 0n ? Number(c.total) / Number(totalAnio) : null, promedioMensual: c.total / BigInt(mesesTranscurridos),
  }));
  return { fijos, variables, total, acumulado, totalAnio, detalle };
}

// ── 8.9 · Sanidad valorizada (por producto) ───────────────────────
export type ProductoSanidad = {
  id: string; nombre: string; tipo: string; unidadMedida: string; dosisMl: number;
  compradoUnidades: number; compradoMl: number; compradoGs: bigint; precioListaPorMl: number | null;
  usadoCantidad: number; stockCantidad: number; conteoCantidad: number | null;
};
export function filaSanidad(p: ProductoSanidad) {
  // Todo se lleva a ml: un producto por DOSIS usa sus ml por dosis
  const aMl = (c: number) => (p.unidadMedida === "DOSIS" ? c * p.dosisMl : c);
  const precioMl = p.compradoMl > 0 ? Number(p.compradoGs) / p.compradoMl : p.precioListaPorMl;
  const usadoMl = aMl(p.usadoCantidad);
  const teoricoMl = Math.max(0, aMl(p.stockCantidad));
  const conteoMl = p.conteoCantidad === null ? null : aMl(p.conteoCantidad);
  const stockMl = conteoMl ?? teoricoMl;
  const estado =
    p.compradoGs > 0n && p.compradoMl === 0 ? "FALTAN los ml por unidad"
    : usadoMl > 0 && precioMl === null ? "Sin precio: cargar precio de lista"
    : conteoMl === null ? "Sin conteo: stock teórico"
    : Math.abs(conteoMl - teoricoMl) > Math.max(1, 0.1 * p.compradoMl) ? "Revisar: no cierra"
    : "OK";
  return {
    ...p, precioMl, usadoMl, costoUsadoGs: precioMl === null ? null : BigInt(Math.round(usadoMl * precioMl)),
    teoricoMl, stockMl, valorStockGs: precioMl === null ? null : BigInt(Math.round(stockMl * precioMl)),
    diferenciaMl: conteoMl === null ? null : conteoMl - teoricoMl, estado,
  };
}
