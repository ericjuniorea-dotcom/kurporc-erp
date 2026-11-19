// Tablero de la mañana: indicadores de toda la granja (últimos 12 meses y últimos 3), inventario por fase,
// próximos eventos, actividad del mes y avisos. Las fórmulas son las del catálogo (src/lib/indicadores/catalogo.ts):
// si cambiás una cuenta acá, cambiá también su texto allá.
import "server-only";
import prisma from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";
import { SELECT_STOCK_CAMADA } from "@/lib/maternidad/camadas";
import { stockCamada } from "@/lib/auditoria/granja";
import { INDICADORES, evaluar, tendencia, type ClaveIndicador, type Estado } from "./catalogo";
import { generarOrdenesMaternidad, pendientesPorModulo } from "@/lib/transferencias/servidor";
import { MODULOS_TRANSFERENCIA } from "@/lib/transferencias/tipos";

const DIA = 86_400_000;
const GESTACION = 114;           // días de gestación para la fecha probable de parto
const MADURA_TASA_PARTO = 115;   // un servicio se cuenta para la tasa de parto recién cuando ya pudo parir
const MISMO_CELO = 5;            // servicios a menos de 5 días = el mismo celo (varias dosis)
const VENTANA_REPETICION = 60;   // volver a servirse dentro de 60 días sin parir = repetición
const VENTANA_IDS = 60;          // primer servicio dentro de los 60 días del destete

type Ventana = { desde: Date; hasta: Date; dias: number };
const dentro = (d: Date, v: Ventana) => d >= v.desde && d < v.hasta;
const suma = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const div = (a: number, b: number) => (b > 0 ? a / b : null);
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);

export type FilaIndicador = {
  clave: ClaveIndicador; anual: number | null; reciente: number | null; meta: number | null;
  estado: Estado; distancia: number | null; tendencia: ReturnType<typeof tendencia>; base: number;
};
export type Aviso = { nivel: "critico" | "atencion" | "info"; texto: string; href: string; clave?: ClaveIndicador };

export async function tableroGranja(tenantId: string) {
  const hoy = new Date();
  const d12: Ventana = { desde: new Date(hoy.getTime() - 365 * DIA), hasta: new Date(hoy.getTime() + DIA), dias: 365 };
  const d3: Ventana = { desde: new Date(hoy.getTime() - 91 * DIA), hasta: d12.hasta, dias: 91 };
  const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
  const desdeServicios = new Date(d12.desde.getTime() - (MADURA_TASA_PARTO + VENTANA_REPETICION + 10) * DIA);

  const [
    partos, destetes, muertesLact, muertesIni, muertesEng, lotesEng, servicios, madres, metasDb,
    estados, camadas, ini, eng, machos, cuarentena, cachorras, tareasVencidas,
  ] = await Promise.all([
    prisma.farrowingEvent.findMany({ where: { tenantId, startDatetime: { gte: d12.desde } },
      select: { startDatetime: true, bornAlive: true, bornDead: true, mummified: true, totalLitterWeightKg: true, gestationDays: true } }),
    prisma.weaningEvent.findMany({ where: { tenantId, weaningDate: { gte: new Date(d12.desde.getTime() - VENTANA_IDS * DIA) } },
      select: { weaningDate: true, pigletsWeaned: true, lactationDays: true, totalLitterWeightKg: true, nurseryBatchId: true, farrowing: { select: { sowId: true, ...SELECT_STOCK_CAMADA } } } }),
    prisma.pigletDeath.findMany({ where: { tenantId, deathDatetime: { gte: d12.desde } }, select: { deathDatetime: true, quantity: true } }),
    prisma.animalEvent.findMany({ where: { tenantId, eventType: "DEATH", moduleSource: "RECRIA", eventDate: { gte: d12.desde } }, select: { eventDate: true, metadata: true } }),
    prisma.growingDeath.findMany({ where: { tenantId, deathDate: { gte: d12.desde } }, select: { deathDate: true, count: true } }),
    prisma.growingBatch.findMany({ where: { tenantId, entryDate: { gte: d12.desde } },
      select: { entryDate: true, currentCount: true, deaths: { select: { count: true } }, sales: { select: { animalCount: true } },
        otherExits: { select: { count: true } }, outgoingTransfers: { select: { count: true } }, incomingTransfers: { select: { count: true } } } }),
    prisma.serviceEvent.findMany({ where: { tenantId, serviceDate: { gte: desdeServicios } }, orderBy: [{ sowId: "asc" }, { serviceDate: "asc" }],
      select: { sowId: true, serviceDate: true, farrowing: { select: { id: true } } } }),
    prisma.sow.count({ where: { tenantId, isActive: true } }),
    prisma.configMeta.findMany({ where: { tenantId }, select: { modulo: true, kpiKey: true, valor: true } }),
    getGestacionStates(tenantId),
    prisma.farrowingEvent.findMany({ where: { tenantId, weaning: null, sow: { isActive: true } }, select: { id: true, startDatetime: true, ...SELECT_STOCK_CAMADA } }),
    prisma.nurseryBatch.aggregate({ where: { tenantId, isActive: true }, _sum: { currentCount: true }, _count: { _all: true } }),
    prisma.growingBatch.aggregate({ where: { tenantId, status: "ACTIVE" }, _sum: { currentCount: true }, _count: { _all: true } }),
    prisma.boar.count({ where: { tenantId, plantelState: { in: ["ACTIVE", "RESTING"] } } }),
    prisma.sow.count({ where: { tenantId, isActive: true, plantelState: "QUARANTINE" } }),
    prisma.sow.count({ where: { tenantId, isActive: true, plantelState: { in: ["REPLACEMENT_DEVELOPING", "REPLACEMENT_READY"] } } }),
    prisma.healthTask.count({ where: { tenantId, isCompleted: false, dueDate: { lt: hoy } } }),
  ]);

  const meta = (modulo: string, kpiKey: string, defecto: number) => {
    const m = metasDb.find(x => x.modulo === modulo && x.kpiKey === kpiKey);
    return m ? Number(m.valor) : defecto;
  };
  const metaDe = (c: ClaveIndicador) => { const i = INDICADORES[c]; return "meta" in i && i.meta ? meta(i.meta.modulo, i.meta.kpiKey, i.meta.defecto) : null; };

  // Celos: las dosis de un mismo celo cuentan como un solo servicio
  // siguiente = fecha del próximo celo servido de la misma cerda (para saber si volvió y a los cuántos días)
  type Celo = { sowId: string; fecha: Date; pario: boolean; siguiente?: number };
  const celos: Celo[] = [];
  let ult: Celo | null = null, ultFecha = 0;
  for (const s of servicios) {
    const t = s.serviceDate.getTime();
    if (ult && ult.sowId === s.sowId && t - ultFecha <= MISMO_CELO * DIA) { ult.pario ||= !!s.farrowing; ultFecha = t; continue; }
    if (ult && ult.sowId === s.sowId) ult.siguiente = t;
    const c: Celo = { sowId: s.sowId, fecha: s.serviceDate, pario: !!s.farrowing };
    celos.push(c); ult = c; ultFecha = t;
  }
  const muertosIni = (v: Ventana) => suma(muertesIni.filter(e => dentro(e.eventDate, v)), e => Number(((e.metadata ?? {}) as { quantity?: number }).quantity ?? 1));

  function calcular(v: Ventana): Record<string, { valor: number | null; base: number }> {
    const p = partos.filter(x => dentro(x.startDatetime, v));
    const w = destetes.filter(x => dentro(x.weaningDate, v));
    const vivos = suma(p, x => x.bornAlive), totales = suma(p, x => x.bornAlive + x.bornDead + x.mummified);
    const conPesoP = p.filter(x => Number(x.totalLitterWeightKg) > 0 && x.bornAlive > 0);
    const conPesoW = w.filter(x => Number(x.totalLitterWeightKg) > 0 && x.pigletsWeaned > 0);
    const destetados = suma(w, x => x.pigletsWeaned);
    const mIni = muertosIni(v);
    const mEng = suma(muertesEng.filter(x => dentro(x.deathDate, v)), x => x.count);
    const entranIniConLote = suma(w.filter(x => x.nurseryBatchId), x => x.pigletsWeaned);
    const entranIni = entranIniConLote || destetados;
    const entranEng = suma(lotesEng.filter(l => dentro(l.entryDate, v)), l =>
      l.currentCount + suma(l.deaths, x => x.count) + suma(l.sales, x => x.animalCount) + suma(l.otherExits, x => x.count)
      + suma(l.outgoingTransfers, x => x.count) - suma(l.incomingTransfers, x => x.count));
    // Tasa de parto: servicios ya «maduros» (la ventana corrida 115 días hacia atrás)
    const maduros = celos.filter(c => c.fecha >= new Date(v.desde.getTime() - MADURA_TASA_PARTO * DIA) && c.fecha < new Date(v.hasta.getTime() - MADURA_TASA_PARTO * DIA));
    // Repetición: de los servicios con al menos 60 días (ya se pudo ver si volvieron), cuántos se volvieron a servir sin parir
    const corrida = (dias: number) => celos.filter(c => c.fecha >= new Date(v.desde.getTime() - dias * DIA) && c.fecha < new Date(v.hasta.getTime() - dias * DIA));
    const madurosRep = corrida(VENTANA_REPETICION);
    const volvio = (c: Celo) => !c.pario && c.siguiente != null ? (c.siguiente - c.fecha.getTime()) / DIA : null;
    const repiten = madurosRep.filter(c => { const d = volvio(c); return d != null && d <= VENTANA_REPETICION; }).length;
    const tardias = maduros.filter(c => { const d = volvio(c); return d != null && d > VENTANA_REPETICION; }).length;
    // Intervalo destete-servicio: primer celo de la cerda dentro de los 60 días del destete, si cae en la ventana
    const ids: number[] = [];
    for (const x of destetes) {
      const c = celos.find(c => c.sowId === x.farrowing.sowId && c.fecha > x.weaningDate && c.fecha.getTime() - x.weaningDate.getTime() <= VENTANA_IDS * DIA);
      if (c && dentro(c.fecha, v)) ids.push((c.fecha.getTime() - x.weaningDate.getTime()) / DIA);
    }
    // Ciclo de la cerda: gestación + lactancia + intervalo destete-servicio (sirve aunque el registro tenga menos de un año)
    const gest = p.filter(x => x.gestationDays && x.gestationDays > 100 && x.gestationDays < 130);
    const diasGest = gest.length ? suma(gest, x => x.gestationDays!) / gest.length : GESTACION + 1;
    const lact = div(suma(w, x => x.lactationDays), w.length);
    const idsProm = div(suma(ids, x => x), ids.length);
    const pca = lact != null && idsProm != null ? 365 / (diasGest + lact + idsProm) : null;
    const destCamada = div(destetados, w.length);
    // Predestete: de las camadas destetadas en el período, muertos en lactancia ÷ lechones a cargo (vivos + recibidos − donados)
    const aCargo = suma(w, x => x.farrowing.bornAlive + suma(x.farrowing.movementsAsDestination, m => m.quantity) - suma(x.farrowing.movementsAsOrigin, m => m.quantity));
    const muertosCamadas = suma(w, x => suma(x.farrowing.deaths, d => d.quantity));
    const pre = pct(muertosCamadas, aCargo), mi = pct(mIni, entranIni), me = pct(mEng, entranEng);
    // Total: de cada 100 que nacen vivos, cuántos se pierden pasando por las fases con dato
    const fases = [pre, mi, me].filter((x): x is number => x != null);
    const total = fases.length ? (1 - fases.reduce((s, x) => s * (1 - x / 100), 1)) * 100 : null;
    return {
      tasa_parto: { valor: pct(maduros.filter(c => c.pario).length, maduros.length), base: maduros.length },
      repeticion_celo: { valor: pct(repiten, madurosRep.length), base: madurosRep.length },
      repeticion_tardia: { valor: pct(tardias, maduros.length), base: maduros.length },
      intervalo_destete_servicio: { valor: idsProm, base: ids.length },
      partos_cerda_anio: { valor: pca, base: w.length },
      destetados_cerda_anio: { valor: pca != null && destCamada != null ? pca * destCamada : null, base: w.length },
      nacidos_totales_parto: { valor: div(totales, p.length), base: p.length },
      nacidos_vivos_parto: { valor: div(vivos, p.length), base: p.length },
      muertos_al_nacer: { valor: pct(totales - vivos, totales), base: p.length },
      nacidos_muertos: { valor: pct(suma(p, x => x.bornDead), totales), base: p.length },
      momificados: { valor: pct(suma(p, x => x.mummified), totales), base: p.length },
      peso_al_nacer: { valor: div(suma(conPesoP, x => Number(x.totalLitterWeightKg)), suma(conPesoP, x => x.bornAlive)), base: conPesoP.length },
      mortalidad_predestete: { valor: pre, base: w.length },
      destetados_camada: { valor: destCamada, base: w.length },
      peso_destete: { valor: div(suma(conPesoW, x => Number(x.totalLitterWeightKg)), suma(conPesoW, x => x.pigletsWeaned)), base: conPesoW.length },
      dias_lactancia: { valor: lact, base: w.length },
      mortalidad_iniciacion: { valor: mi, base: entranIni },
      mortalidad_engorde: { valor: me, base: entranEng },
      mortalidad_total: { valor: total, base: w.length },
    };
  }

  const a = calcular(d12), r = calcular(d3);
  const indicadores: FilaIndicador[] = (Object.keys(a) as ClaveIndicador[]).map(clave => {
    const i = INDICADORES[clave];
    const sentido = "sentido" in i ? i.sentido : "mayor";
    const m = metaDe(clave);
    const ev = evaluar(a[clave].valor, m, sentido);
    return { clave, anual: a[clave].valor, reciente: r[clave].valor, meta: m, estado: ev.estado, distancia: ev.distancia,
      tendencia: tendencia(r[clave].valor, a[clave].valor, sentido), base: a[clave].base };
  });

  // ── Inventario de hoy ──
  const abiertas = camadas.map(c => ({ ...c, lechones: stockCamada(c) })).filter(c => c.lechones > 0);
  const lechonesMat = suma(abiertas, c => c.lechones);
  const prenadas = estados.filter(s => s.estado === "PRENADA").length;
  const servidas = estados.filter(s => s.estado === "SERVIDA").length;
  const lactantes = abiertas.length;
  const vacias = Math.max(0, madres - prenadas - servidas - lactantes - cuarentena - cachorras);
  const lechonesIni = ini._sum.currentCount ?? 0, cerdosEng = eng._sum.currentCount ?? 0;

  // ── Próximos eventos ──
  const metaLact = meta("MATERNIDAD", "dias_lactancia", 21);
  const diasHasta = (d: Date) => Math.round((d.getTime() - hoy.getTime()) / DIA);
  const fechasParto = estados.filter(s => s.estado !== "DISPONIBLE").map(s => new Date(s.serviceDate.getTime() + GESTACION * DIA)).sort((x, y) => x.getTime() - y.getTime());
  const fechasDestete = abiertas.map(c => new Date(c.startDatetime.getTime() + metaLact * DIA)).sort((x, y) => x.getTime() - y.getTime());
  const proximo = (xs: Date[]) => xs[0] ? { fecha: xs[0].toISOString().slice(0, 10), enDias: diasHasta(xs[0]), cantidad: xs.filter(d => d.getTime() - xs[0].getTime() < 7 * DIA).length } : null;
  const partos7 = fechasParto.filter(d => diasHasta(d) <= 7).length;
  const atrasadas = abiertas.filter(c => (hoy.getTime() - c.startDatetime.getTime()) / DIA > metaLact).length;

  // ── Actividad del mes ──
  const mes: Ventana = { desde: inicioMes, hasta: d12.hasta, dias: 31 };
  const ult30: Ventana = { desde: new Date(hoy.getTime() - 30 * DIA), hasta: d12.hasta, dias: 30 };
  const gestReales = partos.filter(p => p.gestationDays && p.gestationDays > 100 && p.gestationDays < 130).map(p => p.gestationDays!);

  // ── Avisos: lo que está fuera de meta y empeora primero ──
  const href: Record<string, string> = { Reproducción: "/gestacion?tab=analisis", Maternidad: "/maternidad?tab=analisis", Iniciación: "/recria", Engorde: "/engorde?tab=analisis", General: "/dashboard" };
  const peso = (f: FilaIndicador) => (f.estado === "FUERA" ? 2 : 1) + (f.tendencia === "empeora" ? 1 : 0) + Math.min(1, Math.abs(f.distancia ?? 0));
  const avisos: Aviso[] = indicadores.filter(f => (f.estado === "FUERA" || f.estado === "ATENCION") && f.clave !== "muertos_al_nacer" /* ya avisan sus partes: nacidos muertos y momificados */).sort((x, y) => peso(y) - peso(x)).map(f => {
    const i = INDICADORES[f.clave];
    const fmt = (v: number | null) => v == null ? "—" : `${v.toLocaleString("es-PY", { maximumFractionDigits: i.decimales })}${i.unidad === "%" ? "%" : ""}`;
    const simbolo = "sentido" in i && i.sentido === "menor" ? "≤" : "≥";
    const tend = f.tendencia === "empeora" ? " y empeorando en los últimos 3 meses" : f.tendencia === "mejora" ? ", pero mejorando en los últimos 3 meses" : "";
    // Nacidos muertos y momificados apuntan a la vacunación de las reproductoras
    const vacunas = f.clave === "nacidos_muertos" || f.clave === "momificados";
    return { nivel: f.estado === "FUERA" ? "critico" as const : "atencion" as const, clave: f.clave, href: vacunas ? "/sanidad?categoria=vacunacion" : href[i.grupo] ?? "/dashboard",
      texto: `${i.nombre}: ${fmt(f.anual)} (meta ${simbolo} ${fmt(f.meta)})${tend}${vacunas ? " · revisá la vacunación de las reproductoras" : ""}` };
  });
  const operativos: Aviso[] = [];
  if (atrasadas) operativos.push({ nivel: "atencion", href: "/maternidad", texto: `${atrasadas} camada${atrasadas === 1 ? "" : "s"} pasó los ${metaLact} días de lactancia: programá el destete` });
  if (partos7) operativos.push({ nivel: "info", href: "/gestacion", texto: `${partos7} parto${partos7 === 1 ? "" : "s"} esperado${partos7 === 1 ? "" : "s"} en los próximos 7 días: prepará las salas` });
  if (tareasVencidas) operativos.push({ nivel: "atencion", href: "/tareas", texto: `${tareasVencidas} tarea${tareasVencidas === 1 ? "" : "s"} de sanidad vencida${tareasVencidas === 1 ? "" : "s"}` });
  // Transferencias de animales: lo que espera ser recibido o enviado en cada módulo
  await generarOrdenesMaternidad(tenantId).catch(e => console.error("[ordenes-maternidad]", e));
  for (const t of await pendientesPorModulo(tenantId)) {
    const m = t.estado === "EN_CAMINO" ? t.destino : t.origen;
    const info = MODULOS_TRANSFERENCIA[m];
    if (!info) continue;
    operativos.unshift(t.estado === "EN_CAMINO"
      ? { nivel: "atencion", href: info.href, texto: `${info.etiqueta}: ${t.animales} animal${t.animales === 1 ? "" : "es"} por recibir (${MODULOS_TRANSFERENCIA[t.origen]?.etiqueta ?? t.origen})` }
      : { nivel: "atencion", href: info.href, texto: `${info.etiqueta}: ${t.transferencias} orden${t.transferencias === 1 ? "" : "es"} para pasar a ${MODULOS_TRANSFERENCIA[t.destino]?.etiqueta ?? t.destino}` });
  }

  return {
    generado: hoy.toISOString(),
    indicadores,
    avisos: [...operativos, ...avisos].slice(0, 8),
    inventario: {
      madres, prenadas, servidas, lactantes, vacias, cuarentena, cachorras, machos,
      lechonesMat, camadas: lactantes, lechonesIni, lotesIni: ini._count._all, cerdosEng, lotesEng: eng._count._all,
      total: lechonesMat + lechonesIni + cerdosEng,
    },
    eventos: { parto: proximo(fechasParto), destete: proximo(fechasDestete), atrasadas, metaLact },
    actividad: {
      servicios: celos.filter(c => dentro(c.fecha, mes)).length,
      partos: partos.filter(p => dentro(p.startDatetime, mes)).length,
      destetados30: suma(destetes.filter(w => dentro(w.weaningDate, ult30)), w => w.pigletsWeaned),
      bajas: suma(muertesLact.filter(x => dentro(x.deathDatetime, mes)), x => x.quantity) + muertosIni(mes) + suma(muertesEng.filter(x => dentro(x.deathDate, mes)), x => x.count),
      gestacionReal: gestReales.length ? suma(gestReales, x => x) / gestReales.length : null,
    },
  };
}

export type TableroGranja = Awaited<ReturnType<typeof tableroGranja>>;
