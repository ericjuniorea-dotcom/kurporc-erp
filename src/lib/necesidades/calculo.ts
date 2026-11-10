// Fase 14 · Motor de necesidades: cálculos puros (se prueban en scripts/pruebas/necesidades.ts).
// Consumo por día (índice 0 = hoy) según tres métodos, y la sugerencia de compra.

export type Metodo = "RACION" | "PROGRAMADO" | "HISTORICO";
export type Urgencia = "CRITICA" | "PRONTO" | "OK" | "SIN_DATOS";
export type ParamCompra = { leadTimeDias: number; seguridadDias: number; cicloCompraDias: number; unidadCompra: number; mermaPct: number };
export const PARAM_DEFECTO: ParamCompra = { leadTimeDias: 5, seguridadDias: 7, cicloCompraDias: 7, unidadCompra: 1, mermaPct: 0 };
export const DIAS_PROYECCION = 60;
const DIA = 86_400_000;

export const horizonte = (p: ParamCompra) => p.leadTimeDias + p.seguridadDias + p.cicloCompraDias;
const dia = (hoy: Date, f: Date) => Math.floor((Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()) - hoy.getTime()) / DIA);

// ── M1 · Por ración ────────────────────────────────────────────────────────
export type Raciones = {
  gestacionKgDia: number; lactacionKgDia: number;
  preInicial1KgLechon: number; preInicial2KgLechon: number; inicialKgLechon: number;
  gestacionDias: number; lactanciaDias: number; lechonesPorParto: number;
};
/** Estado de cada madre: lo que se sabe hoy; el futuro sale del calendario (servicio → parto → destete). */
export type Madre = { estado: "GESTANTE" | "LACTANCIA" | "VACIA"; servicio?: Date | null; parto?: Date | null; lechones?: number };
export type LoteRecria = { destete: Date; cantidad: number };
export type LoteEngorde = { ingreso: Date; cantidad: number; edadIngresoDias: number | null; curva: { dia: number; consumoKgDia?: number }[] | null };
export type Etapa = "GESTATION" | "LACTATION" | "PRE_STARTER" | "PHASE_1" | "PHASE_2" | "GROWING";

/** Consumo diario de balanceado (kg) de una etapa, por día, con el plantel proyectado. */
export function consumoRacion(etapa: Etapa, hoy: Date, madres: Madre[], recria: LoteRecria[], engorde: LoteEngorde[], r: Raciones, dias = DIAS_PROYECCION): number[] {
  const kg = new Array<number>(dias).fill(0);
  const sumar = (desde: number, hasta: number, valor: number) => { for (let t = Math.max(0, desde); t < Math.min(dias, hasta); t++) kg[t] += valor; };
  // Lechones: programa de kg por lechón repartido en los días de cada etapa (consumo acumulado, no por edad)
  const PRE = { desde: 10, hasta: r.lactanciaDias }; // pre-inicial 1 desde el día 10 de lactancia
  const F1 = { desde: 0, hasta: 14 }, F2 = { desde: 14, hasta: 49 }; // días desde el destete
  const camada = (parto: number, lechones: number) => {
    const destete = parto + r.lactanciaDias;
    if (etapa === "LACTATION") sumar(parto, destete, r.lactacionKgDia);
    if (etapa === "PRE_STARTER") sumar(parto + PRE.desde, parto + PRE.hasta, (r.preInicial1KgLechon / Math.max(1, PRE.hasta - PRE.desde)) * lechones);
    if (etapa === "PHASE_1") sumar(destete + F1.desde, destete + F1.hasta, (r.preInicial2KgLechon / (F1.hasta - F1.desde)) * lechones);
    if (etapa === "PHASE_2") sumar(destete + F2.desde, destete + F2.hasta, (r.inicialKgLechon / (F2.hasta - F2.desde)) * lechones);
    return destete;
  };
  for (const m of madres) {
    let cursor = 0; // hasta qué día está asignada la madre
    if (m.estado === "GESTANTE" && m.servicio) {
      const parto = dia(hoy, m.servicio) + r.gestacionDias;
      if (etapa === "GESTATION") sumar(0, parto, r.gestacionKgDia);
      cursor = camada(Math.max(parto, 0), r.lechonesPorParto);
    } else if (m.estado === "LACTANCIA" && m.parto) {
      cursor = camada(dia(hoy, m.parto), m.lechones ?? r.lechonesPorParto);
    }
    // Después del destete (o vacía hoy): ración de gestación hasta el final del horizonte
    if (etapa === "GESTATION") sumar(cursor, dias, r.gestacionKgDia);
  }
  for (const l of recria) {
    const d = dia(hoy, l.destete);
    if (etapa === "PHASE_1") sumar(d + F1.desde, d + F1.hasta, (r.preInicial2KgLechon / (F1.hasta - F1.desde)) * l.cantidad);
    if (etapa === "PHASE_2") sumar(d + F2.desde, d + F2.hasta, (r.inicialKgLechon / (F2.hasta - F2.desde)) * l.cantidad);
  }
  if (etapa === "GROWING") {
    for (const l of engorde) {
      const inicio = dia(hoy, l.ingreso);
      for (let t = Math.max(0, inicio); t < dias; t++) {
        const diaLote = t - inicio;
        kg[t] += consumoCurva(l.curva, diaLote, l.edadIngresoDias) * l.cantidad;
      }
    }
  }
  return kg.map(v => Math.round(v * 1000) / 1000);
}

/** kg/día por animal según la curva de engorde (interpolada); sin curva, 2,2 kg/día. Pasados 120 días, 0 (salió a venta). */
export function consumoCurva(curva: { dia: number; consumoKgDia?: number }[] | null, diaLote: number, _edad: number | null): number {
  if (diaLote > 120) return 0;
  const pts = (curva ?? []).filter(p => typeof p.consumoKgDia === "number").sort((a, b) => a.dia - b.dia);
  if (!pts.length) return 2.2;
  if (diaLote <= pts[0].dia) return pts[0].consumoKgDia!;
  for (let i = 1; i < pts.length; i++) {
    if (diaLote <= pts[i].dia) {
      const a = pts[i - 1], b = pts[i];
      return a.consumoKgDia! + ((b.consumoKgDia! - a.consumoKgDia!) * (diaLote - a.dia)) / (b.dia - a.dia);
    }
  }
  return pts[pts.length - 1].consumoKgDia!;
}

// ── M2 · Programado (vacunas y medicamentos del protocolo) ─────────────────
/**
 * Dosis por día según los eventos sanitarios pendientes. Si se conoce el envase (dosis por frasco),
 * se agrupan frascos por día de aplicación: ceil(dosis_dia / dosis_por_frasco) frascos, que se abren enteros.
 * `factor` pasa de dosis a la unidad del stock (ml por dosis si el stock está en ml).
 */
export function consumoProgramado(hoy: Date, eventos: { fecha: Date; dosis: number }[], factor: number, dosisPorEnvase: number | null, dias = DIAS_PROYECCION): number[] {
  const dosis = new Array<number>(dias).fill(0);
  for (const e of eventos) {
    const d = Math.max(0, dia(hoy, e.fecha)); // atrasadas: se necesitan hoy
    if (d < dias) dosis[d] += e.dosis;
  }
  return dosis.map(x => (x <= 0 ? 0 : dosisPorEnvase && dosisPorEnvase > 0 ? Math.ceil(x / dosisPorEnvase) * dosisPorEnvase * factor : x * factor));
}

// ── M3 · Histórico ─────────────────────────────────────────────────────────
/**
 * Promedio móvil ponderado de 8 semanas (la más reciente pesa 8, la más vieja 1).
 * `semanas[0]` = la última semana. Con menos de 3 semanas con salidas → null (SIN_DATOS).
 */
export function consumoHistoricoDiario(semanas: number[]): number | null {
  const s = semanas.slice(0, 8);
  if (s.filter(x => x > 0).length < 3) return null;
  let suma = 0, pesos = 0;
  s.forEach((x, i) => { const w = 8 - i; suma += x * w; pesos += w; });
  return suma / pesos / 7;
}

// ── Sugerencia (14.3) ──────────────────────────────────────────────────────
export type Sugerencia = { consumoDiario: number; fechaQuiebre: number | null; coberturaDias: number | null; demandaH: number; cantidad: number; urgencia: Urgencia; proyeccion: number[] };

export function sugerir(consumo: number[] | null, stock: number, enTransito: number, p: ParamCompra, pedidoMinimo = 0): Sugerencia {
  if (!consumo) return { consumoDiario: 0, fechaQuiebre: null, coberturaDias: null, demandaH: 0, cantidad: 0, urgencia: "SIN_DATOS", proyeccion: [] };
  const merma = Math.min(0.9, Math.max(0, p.mermaPct));
  const c = consumo.map(x => x / (1 - merma));
  const H = horizonte(p);
  const disponible = stock + enTransito;
  const proyeccion: number[] = [];
  let acum = 0, quiebre: number | null = null;
  for (let t = 0; t < c.length; t++) {
    acum += c[t];
    const s = disponible - acum;
    proyeccion.push(Math.round(s * 100) / 100);
    if (quiebre === null && s < 0) quiebre = t;
  }
  const demandaH = c.slice(0, H + 1).reduce((a, b) => a + b, 0);
  const faltante = Math.max(0, demandaH - disponible);
  const unidad = p.unidadCompra > 0 ? p.unidadCompra : 1;
  const cantidad = faltante > 0 ? Math.max(pedidoMinimo, Math.ceil(faltante / unidad - 1e-9) * unidad) : 0;
  const consumoDiario = c.slice(0, 28).reduce((a, b) => a + b, 0) / Math.min(28, c.length || 1);
  const cobertura = quiebre;
  const urgencia: Urgencia = consumoDiario <= 0 && quiebre === null ? "OK"
    : cobertura !== null && cobertura <= p.leadTimeDias ? "CRITICA"
    : cobertura !== null && cobertura <= p.leadTimeDias + p.seguridadDias ? "PRONTO" : "OK";
  return { consumoDiario, fechaQuiebre: quiebre, coberturaDias: cobertura, demandaH, cantidad, urgencia, proyeccion };
}

// ── Explicación obligatoria ────────────────────────────────────────────────
const n = (v: number, d = 0) => v.toLocaleString("es-PY", { maximumFractionDigits: d });
export function explicar(d: { producto: string; unidad: string; stock: number; enTransito: number; metodo: Metodo | null; motivoConsumo: string; s: Sugerencia; p: ParamCompra; hoy: Date }): string {
  if (d.s.urgencia === "SIN_DATOS") return `Todavía no hay datos para estimar el consumo de ${d.producto}: hacen falta al menos 3 semanas con salidas de stock, o vincularlo a una etapa de alimentación o al calendario sanitario.`;
  const partes = [`Tenés ${n(d.stock, 1)} ${d.unidad} de ${d.producto}${d.enTransito > 0 ? ` y ${n(d.enTransito, 1)} ${d.unidad} en camino` : ""}.`];
  partes.push(`${d.motivoConsumo} consumís unos ${n(d.s.consumoDiario, 1)} ${d.unidad} por día.`);
  partes.push(`El proveedor tarda ${d.p.leadTimeDias} día${d.p.leadTimeDias === 1 ? "" : "s"}.`);
  if (d.s.fechaQuiebre !== null) {
    const f = new Date(d.hoy.getTime() + d.s.fechaQuiebre * DIA);
    partes.push(d.s.fechaQuiebre === 0 ? "Ya no te alcanza para hoy." : `Te quedás sin stock alrededor del ${f.getUTCDate().toString().padStart(2, "0")}/${(f.getUTCMonth() + 1).toString().padStart(2, "0")}.`);
  } else partes.push(`Te alcanza para más de ${DIAS_PROYECCION} días.`);
  partes.push(d.s.cantidad > 0 ? `Sugerimos pedir ${n(d.s.cantidad, 1)} ${d.unidad}.` : "Por ahora no hace falta pedir.");
  return partes.join(" ");
}
