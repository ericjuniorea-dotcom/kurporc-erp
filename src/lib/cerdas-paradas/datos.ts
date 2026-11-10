// Fase 10 · Cerdas paradas: lee los eventos de la granja y los costos del mes de Finanzas (Fase 8).
// No cambia ningún costo: muestra qué parte de los gastos se fue en cerdas paradas y el margen que no se generó.
import "server-only";
import { cache } from "react";
import prisma from "@/lib/db/prisma";
import { datosAnio } from "@/lib/finanzas/anio";
import { amortizacionMensual, hojaAlimentacion, hojaFijosVariables } from "@/lib/finanzas/hojas";
import { hoyUTC, mesDe } from "@/lib/finanzas/calculos";
import {
  costoDia, dia0, paradaHoy, paradosPorMes, partosMaximos, resumir, tramosCerda,
  type Causa, type CerdaLinea, type CostoDia, type ParamsParadas, type Tramo,
} from "./calculo";

const DIA = 86_400_000;
const diasDelMes = (mes: number) => new Date(Date.UTC(Math.floor(mes / 100), mes % 100, 0)).getUTCDate();
const mesAnterior = (mes: number) => (mes % 100 === 1 ? (Math.floor(mes / 100) - 1) * 100 + 12 : mes - 1);
const esMuerte = (t: string | null | undefined) => !!t && /muert|muri|falleci/i.test(t);

/** Metas productivas (Configuración → Jefatura de Producción) y parámetros del cálculo. */
export const parametrosParadas = cache(async (org: string) => {
  const [pf, metas] = await Promise.all([
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.configMeta.findMany({ where: { tenantId: org } }),
  ]);
  const meta = (modulo: string, k: string, porDefecto: number) => {
    const v = metas.find(m => m.modulo === modulo && m.kpiKey === k);
    return v ? Number(v.valor) : porDefecto;
  };
  const calc: ParamsParadas = {
    intervaloObjetivoDias: meta("GESTACION", "dias_open_max", 5),
    toleranciaDias: pf?.toleranciaServicioDias ?? 2,
    edadPrimerServicioDias: pf?.edadPrimerServicioDias ?? 240,
    adaptacionDias: pf?.adaptacionNuliparaDias ?? 30,
  };
  return {
    calc,
    partosMeta: meta("GESTACION", "partos_cerda_anio", 2.4),
    nacidosMeta: meta("MATERNIDAD", "nacidos_vivos_meta", 13),
    mortalidadMeta: meta("MATERNIDAD", "mortalidad_pct_max", 8) / 100,
    gestacionDias: meta("GESTACION", "dias_gestacion", 115),
    lactanciaDias: meta("MATERNIDAD", "dias_lactancia", 21),
    consumoKgDia: Number(pf?.consumoGestacionKgDia ?? 2.5),
    precioLechonGs: Number(pf?.precioReferenciaLechonGs ?? 435000n),
    alertaVaciaDias: pf?.alertaVaciaSinDecisionDias ?? 7,
    alertaDescarteDias: pf?.alertaDescarteSinSalirDias ?? 15,
  };
});

/** Línea de vida de cada reproductora a partir de lo que ya registra el ERP. */
export const lineasCerdas = cache(async (org: string): Promise<(CerdaLinea & { activa: boolean })[]> => {
  const [cerdas, servicios, checks, repeticiones, abortos, descartes, muertes] = await Promise.all([
    prisma.sow.findMany({ where: { tenantId: org }, select: { id: true, identCode: true, birthDate: true, entryDate: true, isActive: true, plantelState: true } }),
    prisma.serviceEvent.findMany({ where: { tenantId: org }, select: { id: true, sowId: true, serviceDate: true,
      farrowing: { select: { startDatetime: true, weaning: { select: { weaningDate: true, sowDestination: true } } } } } }),
    prisma.pregnancyCheck.findMany({ where: { tenantId: org, result: "NOT_PREGNANT" }, select: { serviceEventId: true, checkDate: true } }),
    prisma.heatRepeat.findMany({ where: { tenantId: org, serviceEventId: { not: null } }, select: { serviceEventId: true, repeatDate: true } }),
    prisma.abortionEvent.findMany({ where: { tenantId: org, serviceEventId: { not: null } }, select: { serviceEventId: true, abortionDate: true } }),
    prisma.sowDiscard.findMany({ where: { tenantId: org }, select: { sowId: true, discardDate: true, categoria: true, tipoDescarte: true, destination: true } }),
    prisma.animalEvent.findMany({ where: { tenantId: org, eventType: "DEATH", sowId: { not: null } }, select: { sowId: true, eventDate: true } }),
  ]);
  const fallo = new Map<string, NonNullable<CerdaLinea["servicios"][number]["fallo"]>>();
  const anotar = (id: string | null, tipo: "REPETICION" | "VACIA" | "ABORTO", fecha: Date) => {
    if (!id) return;
    const a = fallo.get(id);
    if (!a || a.fecha > fecha) fallo.set(id, { tipo, fecha });
  };
  for (const c of checks) anotar(c.serviceEventId, "VACIA", c.checkDate);
  for (const r of repeticiones) anotar(r.serviceEventId, "REPETICION", r.repeatDate);
  for (const a of abortos) anotar(a.serviceEventId, "ABORTO", a.abortionDate);

  return cerdas.map(c => {
    const d = descartes.filter(x => x.sowId === c.id).sort((a, b) => a.discardDate.getTime() - b.discardDate.getTime())[0];
    const m = muertes.find(x => x.sowId === c.id);
    const salida = d ? { fecha: d.discardDate, tipo: (esMuerte(d.categoria) || esMuerte(d.tipoDescarte) || esMuerte(d.destination) ? "MUERTE" : "DESCARTE") as "MUERTE" | "DESCARTE" }
      : m ? { fecha: m.eventDate, tipo: "MUERTE" as const }
      : !c.isActive ? { fecha: new Date(), tipo: c.plantelState === "DEAD" ? "MUERTE" as const : "DESCARTE" as const } : null;
    return {
      id: c.id, codigo: c.identCode, nacimiento: c.birthDate, ingreso: c.entryDate, salida, activa: c.isActive,
      servicios: servicios.filter(s => s.sowId === c.id).map(s => ({
        id: s.id, fecha: s.serviceDate,
        parto: s.farrowing ? { fecha: s.farrowing.startDatetime, destete: s.farrowing.weaning ? { fecha: s.farrowing.weaning.weaningDate, descarte: s.farrowing.weaning.sowDestination === "CULL" } : null } : null,
        fallo: s.farrowing ? null : fallo.get(s.id) ?? null,
      })),
    };
  });
});

/** Costo de un día parado de cada mes pedido, con los números de Finanzas de ese mes. */
export const costosPorMes = cache(async (org: string, meses: number[]): Promise<Map<number, CostoDia & { mes: number; usado: number }>> => {
  const p = await parametrosParadas(org);
  const corte = mesDe(hoyUTC());
  const anios = Array.from(new Set(meses.flatMap(m => [Math.floor(m / 100), Math.floor(m / 100) - 1]))).filter(a => a >= 2020);
  const datos = new Map(await Promise.all(anios.map(async a => [a, await datosAnio(org, a)] as const)));
  type Base = { fijos: number; amort: number; variables: number; entregados: number; precioGest: number | null; matrices: number };
  const base = (mes: number): Base | null => {
    const d = datos.get(Math.floor(mes / 100));
    if (!d) return null;
    const i = (mes % 100) - 1, anio = Math.floor(mes / 100);
    const fv = hojaFijosVariables(d.movs, Math.min(mes, corte));
    const amort = amortizacionMensual(d.inversiones, d.params, anio, corte);
    const alim = hojaAlimentacion(d.movs, d.prod, d.matricesPorMes);
    return { fijos: Number(fv.fijos[i]), amort: Number(amort[i]), variables: Number(fv.variables[i]), entregados: d.prod[i].entregados, precioGest: alim.precio.GESTACION[i], matrices: d.matricesPorMes[i] };
  };
  const out = new Map<number, CostoDia & { mes: number; usado: number }>();
  for (const mes of meses) {
    // Un mes sin gastos cargados (el actual recién empezado, o uno futuro) usa el último mes con datos
    let usado = mes, b = base(mes);
    for (let k = 0; k < 12 && b && b.fijos === 0 && b.variables === 0; k++) { usado = mesAnterior(usado); b = base(usado) ?? b; }
    if (!b) continue;
    // Costo variable por lechón del mes; sin ventas, el promedio de los 3 meses anteriores con ventas
    let costoVar: number | null = b.entregados > 0 ? b.variables / b.entregados : null;
    if (costoVar === null) {
      let v = 0, e = 0, m = usado;
      for (let k = 0; k < 3; k++) { m = mesAnterior(m); const x = base(m); if (x) { v += x.variables; e += x.entregados; } }
      costoVar = e > 0 ? v / e : null;
    }
    // Sin ventas cerca (meses de armado de la granja): el promedio de todos los meses con ventas
    if (costoVar === null) {
      let v = 0, e = 0;
      for (const [a] of datos) for (let k = 1; k <= 12; k++) { const x = base(a * 100 + k); if (x && x.entregados > 0) { v += x.variables; e += x.entregados; } }
      costoVar = e > 0 ? v / e : null;
    }
    out.set(mes, { ...costoDia({
      consumoKgDia: p.consumoKgDia, precioGestacionKg: b.precioGest, fijosGs: b.fijos, amortizacionGs: b.amort, matrices: b.matrices, diasMes: diasDelMes(usado),
      partosMeta: p.partosMeta, nacidosMeta: p.nacidosMeta, mortalidadMeta: p.mortalidadMeta, precioLechonGs: p.precioLechonGs, costoVariableLechonGs: costoVar,
    }), mes, usado });
  }
  return out;
});

export type CerdaParada = { id: string; codigo: string; causa: Causa; desde: string; dias: number; perdidaGs: number; perdidaDiaGs: number; alerta: boolean };

/** Todo lo de la pantalla y el tablero: hoy, el mes, el año, por causa, tendencia e indicadores. */
export const resumenParadas = cache(async (org: string) => {
  const hoy = hoyUTC(), mesHoy = mesDe(hoy), anio = Math.floor(mesHoy / 100);
  const [p, lineas] = await Promise.all([parametrosParadas(org), lineasCerdas(org)]);
  const tramosDe = new Map<string, Tramo[]>(lineas.map(l => [l.id, tramosCerda(l, p.calc, hoy)]));

  // Meses a valorizar: los del año y los de cualquier día parado de las cerdas paradas hoy
  const porMesCerda = new Map(lineas.map(l => [l.id, paradosPorMes(tramosDe.get(l.id)!)]));
  const meses = new Set<number>(Array.from({ length: mesHoy % 100 }, (_, i) => anio * 100 + i + 1));
  for (const m of porMesCerda.values()) for (const k of m.keys()) meses.add(k);
  const costos = await costosPorMes(org, Array.from(meses).sort());
  const perdidaDe = (mes: number) => costos.get(mes)?.perdidaDia ?? 0;
  const costoHoy = costos.get(mesHoy);

  // Por mes del año y por causa
  const porMes = Array.from({ length: 12 }, (_, i) => ({ mes: anio * 100 + i + 1, dias: 0, gastadoGs: 0, dejadoGs: 0, lechones: 0 }));
  const porCausa: Partial<Record<Causa, { dias: number; gs: number }>> = {};
  for (const m of porMesCerda.values()) for (const [mes, causas] of m) {
    const c = costos.get(mes);
    for (const [causa, dias] of Object.entries(causas) as [Causa, number][]) {
      if (Math.floor(mes / 100) === anio) {
        const x = porMes[(mes % 100) - 1];
        x.dias += dias; x.gastadoGs += dias * (c?.costoDia ?? 0); x.dejadoGs += dias * (c?.lucroCesante ?? 0); x.lechones += dias * (c?.lechonesDia ?? 0);
        const pc = porCausa[causa] ?? { dias: 0, gs: 0 };
        pc.dias += dias; pc.gs += dias * (c?.perdidaDia ?? 0);
        porCausa[causa] = pc;
      }
    }
  }

  // Cerdas paradas hoy
  const paradas: CerdaParada[] = [];
  for (const l of lineas) {
    if (!l.activa) continue;
    const ph = paradaHoy(tramosDe.get(l.id)!, hoy);
    if (!ph) continue;
    let gs = 0;
    for (let d = ph.desde.getTime(); d < hoy.getTime(); d += DIA) { const f = new Date(d); gs += perdidaDe(f.getUTCFullYear() * 100 + f.getUTCMonth() + 1); }
    const limite = ph.causa === "DESCARTE_DEMORADO" ? p.alertaDescarteDias : ph.causa === "VACIA" || ph.causa === "ABORTO" ? p.alertaVaciaDias : 0;
    paradas.push({ id: l.id, codigo: l.codigo, causa: ph.causa, desde: ph.desde.toISOString().slice(0, 10), dias: ph.dias, perdidaGs: Math.round(gs), perdidaDiaGs: Math.round(costoHoy?.perdidaDia ?? 0), alerta: ph.dias > limite });
  }
  paradas.sort((a, b) => b.perdidaGs - a.perdidaGs || b.dias - a.dias);

  // Indicadores de los últimos 365 días
  const desde365 = new Date(dia0(hoy).getTime() - 365 * DIA);
  let dnp = 0, diasCerda = 0;
  for (const l of lineas) for (const t of tramosDe.get(l.id)!) {
    const a = Math.max(t.desde.getTime(), desde365.getTime()), b = Math.min(t.hasta.getTime(), hoy.getTime());
    if (b <= a) continue;
    const n = Math.round((b - a) / DIA);
    diasCerda += n;
    if (t.estado === "NORMAL" || t.estado === "PARADA") dnp += n;
  }
  const cerdasPromedio = diasCerda / 365;
  const intervalos: number[] = [];
  let servicios = 0, fallados = 0, partos = 0;
  for (const l of lineas) {
    const sv = [...l.servicios].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    sv.forEach((s, i) => {
      if (s.fecha >= desde365) {
        const sig = sv[i + 1];
        if (s.parto || s.fallo || sig) { servicios++; if (!s.parto) fallados++; }
      }
      if (s.parto && s.parto.fecha >= desde365) partos++;
      const w = s.parto?.destete;
      const sig = sv[i + 1];
      if (w && !w.descarte && w.fecha >= desde365 && sig) intervalos.push(Math.round((dia0(sig.fecha).getTime() - dia0(w.fecha).getTime()) / DIA));
    });
  }
  const objetivo = p.calc.intervaloObjetivoDias + p.calc.toleranciaDias;
  const indicadores = {
    dnpPorCerdaAnio: cerdasPromedio > 0 ? dnp / cerdasPromedio : null,
    intervaloDesteteServicio: intervalos.length ? intervalos.reduce((s, x) => s + x, 0) / intervalos.length : null,
    servidasATiempo: intervalos.length ? intervalos.filter(x => x <= objetivo).length / intervalos.length : null,
    tasaRepeticion: servicios ? fallados / servicios : null,
    partosCerdaAnio: cerdasPromedio > 0 ? partos / cerdasPromedio : null,
    partosMaximos: partosMaximos(p.gestacionDias, p.lactanciaDias, p.calc.intervaloObjetivoDias),
    cerdasPromedio,
  };

  const mesActual = porMes[(mesHoy % 100) - 1];
  const anioTot = porMes.reduce((s, x) => ({ gastado: s.gastado + x.gastadoGs, dejado: s.dejado + x.dejadoGs, lechones: s.lechones + x.lechones, dias: s.dias + x.dias }), { gastado: 0, dejado: 0, lechones: 0, dias: 0 });
  return {
    hoy: hoy.toISOString().slice(0, 10), mesHoy, params: p, costoHoy: costoHoy ?? null,
    paradas, perdidaDiariaHoyGs: Math.round(paradas.length * (costoHoy?.perdidaDia ?? 0)),
    mes: { gastadoGs: Math.round(mesActual.gastadoGs), dejadoGs: Math.round(mesActual.dejadoGs), lechones: mesActual.lechones, dias: mesActual.dias },
    anio: { gastadoGs: Math.round(anioTot.gastado), dejadoGs: Math.round(anioTot.dejado), lechones: anioTot.lechones, dias: anioTot.dias },
    porMes: porMes.slice(0, mesHoy % 100).map(x => ({ ...x, gastadoGs: Math.round(x.gastadoGs), dejadoGs: Math.round(x.dejadoGs) })),
    porCausa: (Object.entries(porCausa) as [Causa, { dias: number; gs: number }][]).map(([causa, v]) => ({ causa, dias: v.dias, gs: Math.round(v.gs) })).sort((a, b) => b.gs - a.gs || b.dias - a.dias),
    indicadores,
  };
});

/** Línea de tiempo de una cerda con la pérdida de cada período parado. */
export async function detalleCerda(org: string, sowId: string) {
  const hoy = hoyUTC();
  const [p, lineas] = await Promise.all([parametrosParadas(org), lineasCerdas(org)]);
  const l = lineas.find(x => x.id === sowId);
  if (!l) return null;
  const tramos = tramosCerda(l, p.calc, hoy);
  const meses = Array.from(paradosPorMes(tramos).keys());
  const costos = await costosPorMes(org, meses);
  return {
    codigo: l.codigo, resumen: resumir(tramos),
    tramos: tramos.map(t => {
      let gs = 0;
      if (t.estado === "PARADA") for (let d = t.desde.getTime(); d < t.hasta.getTime(); d += DIA) { const f = new Date(d); gs += costos.get(f.getUTCFullYear() * 100 + f.getUTCMonth() + 1)?.perdidaDia ?? 0; }
      return { desde: t.desde.toISOString().slice(0, 10), hasta: t.hasta.toISOString().slice(0, 10), estado: t.estado, causa: t.causa ?? null, dias: t.dias, perdidaGs: Math.round(gs) };
    }),
  };
}

/**
 * Servidas sin diagnóstico (acción "Hacer ecografía", 10.3): cerdas con el último servicio hace más de los
 * días de ecografía configurados (Gestación → protocolo de seguimiento, 28 por defecto) y sin diagnóstico
 * de preñez de ese servicio. Todavía no son días parados, pero si resultan vacías lo van a ser desde el servicio.
 */
export const sinDiagnostico = cache(async (org: string) => {
  const hoy = hoyUTC();
  const config = await prisma.configProceso.findFirst({ where: { tenantId: org, modulo: "GESTACION", procesoKey: "protocolo_seguimiento_servicio" }, select: { valor: true } });
  const diasEco = Number(((config?.valor ?? {}) as Record<string, unknown>).dias_ecografia ?? 28);
  // Solo las que siguen como "servidas": si alguien ya la pasó a gestante, la dio por preñada
  const sows = await prisma.sow.findMany({ where: { tenantId: org, isActive: true, plantelState: "MATED" }, select: { id: true, identCode: true } });
  if (!sows.length) return { diasEco, cerdas: [] as { id: string; codigo: string; servicio: string; dias: number }[] };
  const servicios = await prisma.serviceEvent.findMany({
    where: { tenantId: org, sowId: { in: sows.map(s => s.id) } }, orderBy: { serviceDate: "desc" },
    select: { id: true, sowId: true, serviceDate: true, pregnancyChecks: { where: { result: { in: ["PREGNANT", "NOT_PREGNANT"] } }, select: { id: true } } },
  });
  const cerdas = sows.flatMap(s => {
    const ult = servicios.find(x => x.sowId === s.id);
    if (!ult || ult.pregnancyChecks.length) return [];
    const dias = Math.floor((hoy.getTime() - ult.serviceDate.getTime()) / 86_400_000);
    // Más allá de 110 días ya es un problema de registro (debería haber parido): no es una ecografía
    return dias >= diasEco && dias <= 110 ? [{ id: s.id, codigo: s.identCode, servicio: ult.serviceDate.toISOString().slice(0, 10), dias }] : [];
  }).sort((a, b) => b.dias - a.dias);
  return { diasEco, cerdas };
});
