// Fase 14 · calcularNecesidades(org): junta stock, pedidos en camino, plantel, raciones, calendario
// sanitario y salidas, calcula cada producto y guarda la foto (necesidad_snapshot). Caché de 30 minutos.
import "server-only";
import prisma from "@/lib/db/prisma";
import { hoyUTC } from "@/lib/finanzas/calculos";
import {
  consumoHistoricoDiario, consumoProgramado, consumoRacion, explicar, PARAM_DEFECTO, sugerir, DIAS_PROYECCION,
  type Etapa, type LoteEngorde, type LoteRecria, type Madre, type Metodo, type ParamCompra, type Raciones, type Urgencia,
} from "./calculo";

const DIA = 86_400_000;
const CACHE_MS = 30 * 60_000;
const SANITARIOS = new Set(["VACUNA", "MEDICAMENTO", "SUPLEMENTO"]);
const UNIDAD: Record<string, string> = { KG: "kg", ML: "ml", DOSIS: "dosis", UNIDAD: "unidades", SACO: "sacos" };
const NOMBRE_ETAPA: Record<string, string> = { GESTATION: "gestación", LACTATION: "lactancia", PRE_STARTER: "pre-inicial", PHASE_1: "recría fase 1", PHASE_2: "recría fase 2", GROWING: "engorde" };

export type FilaNecesidad = {
  stockItemId: string; nombre: string; categoria: string; unidad: string; productoCatalogoId: string | null; catalogoNombre: string | null;
  metodo: string; metodoConfig: string; stockActual: number; enTransito: number; consumoDiario: number; coberturaDias: number | null;
  fechaQuiebre: Date | null; cantidadSugerida: number; urgencia: Urgencia; explicacion: string; proyeccion: number[];
  param: ParamCompra; puntoPedido: number; etapas: string[];
};

function paramDe(p: { leadTimeDias: number; seguridadDias: number; cicloCompraDias: number; unidadCompra: unknown; mermaPct: unknown } | undefined): ParamCompra {
  return p ? { leadTimeDias: p.leadTimeDias, seguridadDias: p.seguridadDias, cicloCompraDias: p.cicloCompraDias, unidadCompra: Number(p.unidadCompra), mermaPct: Number(p.mermaPct) } : { ...PARAM_DEFECTO };
}

async function plantel(org: string, hoy: Date) {
  const [sows, servicios, partos, recria, engorde, curvas, pf, metas] = await Promise.all([
    prisma.sow.findMany({ where: { tenantId: org, isActive: true }, select: { id: true, plantelState: true } }),
    prisma.serviceEvent.findMany({ where: { tenantId: org, serviceDate: { gte: new Date(hoy.getTime() - 130 * DIA) } }, select: { sowId: true, serviceDate: true }, orderBy: { serviceDate: "desc" } }),
    prisma.farrowingEvent.findMany({ where: { tenantId: org, startDatetime: { gte: new Date(hoy.getTime() - 400 * DIA) } }, select: { sowId: true, startDatetime: true, bornAlive: true }, orderBy: { startDatetime: "desc" } }),
    prisma.nurseryBatch.findMany({ where: { tenantId: org, isActive: true }, select: { entryDate: true, currentCount: true } }),
    prisma.growingBatch.findMany({ where: { tenantId: org, status: "ACTIVE" }, select: { entryDate: true, currentCount: true, avgAgeAtEntryDays: true, curvaId: true } }),
    prisma.curvaEngorde.findMany({ where: { organizacionId: org }, select: { id: true, puntos: true, predeterminada: true } }),
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.configMeta.findMany({ where: { tenantId: org }, select: { modulo: true, kpiKey: true, valor: true } }),
  ]);
  const meta = (modulo: string, k: string, d: number) => { const m = metas.find(x => x.modulo === modulo && x.kpiKey === k); return m ? Number(m.valor) : d; };
  const ultimos = partos.slice(0, 10);
  const nv = ultimos.length >= 3 ? ultimos.reduce((s, p) => s + p.bornAlive, 0) / ultimos.length : meta("MATERNIDAD", "nacidos_vivos_meta", 13);
  const raciones: Raciones = {
    gestacionKgDia: Number(pf?.consumoGestacionKgDia ?? 2.5), lactacionKgDia: Number(pf?.consumoLactacionKgDia ?? 8),
    preInicial1KgLechon: Number(pf?.preInicial1KgLechon ?? 2), preInicial2KgLechon: Number(pf?.preInicial2KgLechon ?? 4), inicialKgLechon: Number(pf?.inicialKgLechon ?? 35),
    gestacionDias: meta("GESTACION", "dias_gestacion", 115), lactanciaDias: meta("MATERNIDAD", "dias_lactancia", 21),
    lechonesPorParto: Math.round(nv * (1 - meta("MATERNIDAD", "mortalidad_pct_max", 8) / 100)),
  };
  const madres: Madre[] = sows.map(s => {
    const serv = servicios.find(x => x.sowId === s.id), parto = partos.find(x => x.sowId === s.id);
    if (s.plantelState === "LACTATING" && parto) return { estado: "LACTANCIA", parto: parto.startDatetime, lechones: parto.bornAlive };
    if ((s.plantelState === "PREGNANT" || s.plantelState === "MATED" || s.plantelState === "FARROWING") && serv) return { estado: "GESTANTE", servicio: serv.serviceDate };
    return { estado: "VACIA" };
  });
  const defecto = curvas.find(c => c.predeterminada) ?? null;
  const lotesRecria: LoteRecria[] = recria.map(r => ({ destete: r.entryDate, cantidad: r.currentCount }));
  const lotesEngorde: LoteEngorde[] = engorde.map(g => {
    const c = curvas.find(x => x.id === g.curvaId) ?? defecto;
    return { ingreso: g.entryDate, cantidad: g.currentCount, edadIngresoDias: g.avgAgeAtEntryDays, curva: (c?.puntos as { dia: number; consumoKgDia?: number }[] | null) ?? null };
  });
  const conteo = { gestantes: madres.filter(m => m.estado === "GESTANTE").length, lactancia: madres.filter(m => m.estado === "LACTANCIA").length, vacias: madres.filter(m => m.estado === "VACIA").length,
    recria: lotesRecria.reduce((s, l) => s + l.cantidad, 0), engorde: lotesEngorde.reduce((s, l) => s + l.cantidad, 0) };
  return { raciones, madres, lotesRecria, lotesEngorde, conteo };
}

/** Calcula (o devuelve la foto de hace menos de 30 minutos). */
export async function calcularNecesidades(org: string, opciones: { forzar?: boolean; avisar?: boolean } = {}): Promise<{ filas: FilaNecesidad[]; calculadoEn: Date }> {
  const hoy = hoyUTC();
  const productos = await prisma.productoInventario.findMany({ where: { tenantId: org, isActive: true }, select: { id: true, nombre: true, categoria: true, unidadMedida: true, dosisMl: true }, orderBy: { nombre: "asc" } });
  if (!productos.length) return { filas: [], calculadoEn: new Date() };
  const ids = productos.map(p => p.id);

  const [params, lotes, mapeo, feedTypes, eventos, salidas, enCamino, ultima] = await Promise.all([
    prisma.parametroCompra.findMany({ where: { organizacionId: org, stockItemId: { in: ids } } }),
    prisma.loteInventario.findMany({ where: { tenantId: org, vacunaId: { in: ids }, fechaVencimiento: { gte: hoy } }, select: { vacunaId: true, cantidadActual: true } }),
    prisma.stockItemCatalogo.findMany({ where: { organizacionId: org, stockItemId: { in: ids } }, include: { producto: { select: { nombre: true } } } }),
    prisma.feedType.findMany({ where: { tenantId: org, isActive: true, productoBalanceadoId: { in: ids } }, select: { phase: true, productoBalanceadoId: true } }),
    prisma.eventoVacunacion.findMany({ where: { tenantId: org, vacunaId: { in: ids }, estado: { in: ["pendiente", "retrasado"] }, fecha: { lt: new Date(hoy.getTime() + DIAS_PROYECCION * DIA) } }, select: { vacunaId: true, fecha: true, dosisNecesarias: true } }),
    prisma.movimientoInventario.findMany({ where: { tenantId: org, productoId: { in: ids }, tipo: "SALIDA", fecha: { gte: new Date(hoy.getTime() - 56 * DIA) } }, select: { productoId: true, fecha: true, cantidad: true } }),
    prisma.pedido.findMany({ where: { organizacionId: org, estado: { in: ["CONFIRMADO", "EN_CAMINO", "ENTREGADO"] } }, select: { fechaEstimada: true, items: { select: { productoCatalogoId: true, cantidad: true, contenidoBase: true } } } }),
    opciones.forzar ? null : prisma.necesidadSnapshot.findFirst({ where: { organizacionId: org }, orderBy: { calculadoEn: "desc" }, select: { calculadoEn: true } }),
  ]);

  // Envase conocido (dosis por frasco) por producto de catálogo: el último recibido
  const catIds = mapeo.map(m => m.productoCatalogoId);
  const recibidos = catIds.length ? await prisma.pedidoItem.findMany({ where: { productoCatalogoId: { in: catIds }, pedido: { organizacionId: org, estado: "RECIBIDO" } }, orderBy: { pedido: { updatedAt: "desc" } }, select: { productoCatalogoId: true, contenidoBase: true, unidadBase: true } }) : [];

  const necesitaPlantel = feedTypes.length > 0;
  const pl = necesitaPlantel ? await plantel(org, hoy) : null;

  const filas: FilaNecesidad[] = productos.map(prod => {
    const pc = params.find(x => x.stockItemId === prod.id);
    const p = paramDe(pc);
    const map = mapeo.find(m => m.stockItemId === prod.id);
    const unidad = UNIDAD[prod.unidadMedida] ?? prod.unidadMedida.toLowerCase();
    const stock = lotes.filter(l => l.vacunaId === prod.id).reduce((s, l) => s + Number(l.cantidadActual), 0);
    const limiteTransito = hoy.getTime() + p.leadTimeDias * DIA;
    const enTransito = map ? enCamino.filter(x => !x.fechaEstimada || x.fechaEstimada.getTime() <= limiteTransito)
      .flatMap(x => x.items).filter(i => i.productoCatalogoId === map.productoCatalogoId).reduce((s, i) => s + Number(i.cantidad) * Number(i.contenidoBase), 0) : 0;
    const etapas = feedTypes.filter(f => f.productoBalanceadoId === prod.id).map(f => f.phase);
    const evs = eventos.filter(e => e.vacunaId === prod.id);
    const configurado = pc?.metodo ?? "AUTO";
    let metodo: Metodo | null = configurado === "AUTO"
      ? (etapas.length ? "RACION" : SANITARIOS.has(prod.categoria) && evs.length ? "PROGRAMADO" : "HISTORICO")
      : configurado === "NO_PREDECIR" ? null : (configurado as Metodo);

    let consumo: number[] | null = null;
    let motivo = "";
    if (metodo === "RACION" && pl && etapas.length) {
      consumo = new Array(DIAS_PROYECCION).fill(0);
      for (const e of etapas) consumoRacion(e as Etapa, hoy, pl.madres, pl.lotesRecria, pl.lotesEngorde, pl.raciones).forEach((v, i) => { consumo![i] += v; });
      const c = pl.conteo, partes: string[] = [];
      if (etapas.includes("GESTATION")) partes.push(`${c.gestantes + c.vacias} cerdas en gestación o vacías`);
      if (etapas.includes("LACTATION") || etapas.includes("PRE_STARTER")) partes.push(`${c.lactancia} en lactancia`);
      if (etapas.includes("PHASE_1") || etapas.includes("PHASE_2")) partes.push(`${c.recria} lechones en recría`);
      if (etapas.includes("GROWING")) partes.push(`${c.engorde} cerdos en engorde`);
      motivo = `Con ${partes.join(", ") || "tu plantel"} (${etapas.map(e => NOMBRE_ETAPA[e] ?? e).join(" y ")}) y los partos y destetes que vienen,`;
    } else if (metodo === "RACION") {
      metodo = null; // sin etapa de alimentación vinculada no hay ración que aplicar
    }
    if (metodo === "PROGRAMADO") {
      const factor = prod.unidadMedida === "ML" ? Number(prod.dosisMl) || 1 : 1;
      const rec = map ? recibidos.find(r => r.productoCatalogoId === map.productoCatalogoId) : null;
      const dosisEnvase = rec ? (rec.unidadBase === "DOSIS" ? Number(rec.contenidoBase) : rec.unidadBase === "ML" ? Number(rec.contenidoBase) / factor : null) : null;
      consumo = consumoProgramado(hoy, evs.map(e => ({ fecha: e.fecha, dosis: e.dosisNecesarias })), factor, dosisEnvase);
      const prox30 = evs.filter(e => e.fecha.getTime() < hoy.getTime() + 30 * DIA).reduce((s, e) => s + e.dosisNecesarias, 0);
      motivo = `Con ${prox30} dosis programadas en los próximos 30 días${dosisEnvase ? ` (frascos de ${dosisEnvase} dosis que se abren enteros)` : ""},`;
    }
    if (metodo === "HISTORICO") {
      const semanas = new Array(8).fill(0);
      for (const s of salidas.filter(x => x.productoId === prod.id)) {
        const w = Math.floor((hoy.getTime() - s.fecha.getTime()) / (7 * DIA));
        if (w >= 0 && w < 8) semanas[w] += Number(s.cantidad);
      }
      const diario = consumoHistoricoDiario(semanas);
      consumo = diario === null ? null : new Array(DIAS_PROYECCION).fill(diario);
      motivo = "Según tus salidas de stock de las últimas 8 semanas,";
    }
    const s = sugerir(metodo ? consumo : null, stock, enTransito, p);
    const explicacion = metodo
      ? explicar({ producto: prod.nombre, unidad, stock, enTransito, metodo, motivoConsumo: motivo, s, p, hoy })
      : configurado === "NO_PREDECIR" ? "Configurado para no predecir." : explicar({ producto: prod.nombre, unidad, stock, enTransito, metodo: null, motivoConsumo: "", s, p, hoy });
    const puntoPedido = s.consumoDiario * (p.leadTimeDias + p.seguridadDias);
    return {
      stockItemId: prod.id, nombre: prod.nombre, categoria: prod.categoria, unidad, productoCatalogoId: map?.productoCatalogoId ?? null, catalogoNombre: map?.producto.nombre ?? null,
      metodo: metodo ?? (configurado === "NO_PREDECIR" ? "NO_PREDECIR" : "SIN_DATOS"), metodoConfig: configurado,
      stockActual: stock, enTransito, consumoDiario: s.consumoDiario, coberturaDias: s.coberturaDias,
      fechaQuiebre: s.fechaQuiebre === null ? null : new Date(hoy.getTime() + s.fechaQuiebre * DIA), cantidadSugerida: s.cantidad,
      urgencia: configurado === "NO_PREDECIR" ? "OK" : s.urgencia, explicacion, proyeccion: s.proyeccion, param: p, puntoPedido, etapas,
    };
  });

  // Foto: siempre se recalcula para mostrar, y se guarda como máximo cada 30 minutos (o si se fuerza)
  const guardar = opciones.forzar || !ultima || Date.now() - ultima.calculadoEn.getTime() > CACHE_MS;
  const calculadoEn = new Date();
  if (guardar) {
    const previas = opciones.avisar ? await ultimasUrgencias(org) : new Map<string, string>();
    await prisma.necesidadSnapshot.createMany({
      data: filas.map(f => ({
        organizacionId: org, stockItemId: f.stockItemId, productoCatalogoId: f.productoCatalogoId, metodo: f.metodo,
        stockActual: f.stockActual, enTransito: f.enTransito, consumoDiario: f.consumoDiario, coberturaDias: f.coberturaDias,
        fechaQuiebre: f.fechaQuiebre, cantidadSugerida: f.cantidadSugerida, urgencia: f.urgencia, explicacion: f.explicacion, proyeccion: f.proyeccion, calculadoEn,
      })),
    });
    if (opciones.avisar) {
      const nuevas = filas.filter(f => f.urgencia === "CRITICA" && previas.get(f.stockItemId) !== "CRITICA");
      if (nuevas.length) await avisarCriticas(org, nuevas);
    }
  }
  return { filas, calculadoEn: guardar ? calculadoEn : ultima!.calculadoEn };
}

async function ultimasUrgencias(org: string) {
  const u = await prisma.necesidadSnapshot.findFirst({ where: { organizacionId: org }, orderBy: { calculadoEn: "desc" }, select: { calculadoEn: true } });
  if (!u) return new Map<string, string>();
  const filas = await prisma.necesidadSnapshot.findMany({ where: { organizacionId: org, calculadoEn: u.calculadoEn }, select: { stockItemId: true, urgencia: true } });
  return new Map(filas.map(f => [f.stockItemId, f.urgencia]));
}

async function avisarCriticas(org: string, filas: FilaNecesidad[]) {
  const ms = await prisma.miembro.findMany({
    where: { organizacionId: org, estado: "ACTIVO", OR: [{ esPropietario: true }, { rol: { permisos: { some: { permisoClave: "compras.necesidades.ver" } } } }] },
    select: { userId: true },
  });
  if (!ms.length) return;
  const nombres = filas.slice(0, 4).map(f => f.nombre).join(", ") + (filas.length > 4 ? "…" : "");
  await prisma.notificacion.createMany({
    data: ms.map(m => ({ userId: m.userId, organizacionId: org, tipo: "NECESIDADES", titulo: `${filas.length} producto${filas.length > 1 ? "s" : ""} por quedarse sin stock`, cuerpo: `${nombres}. Pedí ya: el proveedor no llega a tiempo si esperás.`, enlace: "/compras/necesidades" })),
  });
}

/** Precisión (14.4): consumo predicho por las fotos contra las salidas reales de los últimos 28 días. */
export async function precisionNecesidades(org: string) {
  const hoy = hoyUTC(), desde = new Date(hoy.getTime() - 28 * DIA);
  const [fotos, salidas, productos] = await Promise.all([
    prisma.necesidadSnapshot.findMany({ where: { organizacionId: org, calculadoEn: { gte: desde }, metodo: { in: ["RACION", "PROGRAMADO", "HISTORICO"] } }, select: { stockItemId: true, consumoDiario: true, calculadoEn: true, metodo: true } }),
    prisma.movimientoInventario.groupBy({ by: ["productoId"], where: { tenantId: org, tipo: "SALIDA", fecha: { gte: desde } }, _sum: { cantidad: true } }),
    prisma.productoInventario.findMany({ where: { tenantId: org }, select: { id: true, nombre: true, categoria: true, unidadMedida: true } }),
  ]);
  const ids = Array.from(new Set(fotos.map(f => f.stockItemId)));
  return ids.map(id => {
    const fs = fotos.filter(f => f.stockItemId === id);
    const dias = new Set(fs.map(f => f.calculadoEn.toISOString().slice(0, 10))).size;
    const promedio = fs.reduce((s, f) => s + Number(f.consumoDiario), 0) / fs.length;
    const predicho = promedio * Math.min(28, dias);
    const real = Number(salidas.find(s => s.productoId === id)?._sum.cantidad ?? 0) * (Math.min(28, dias) / 28);
    const p = productos.find(x => x.id === id);
    return { id, nombre: p?.nombre ?? "—", categoria: p?.categoria ?? "", unidad: UNIDAD[p?.unidadMedida ?? ""] ?? "", metodo: fs[fs.length - 1].metodo, dias, predicho, real, error: real > 0 ? Math.abs(predicho - real) / real : null };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/** Para el tablero: productos que se terminan en los próximos 7 días (de la última foto). */
export async function seTerminanEstaSemana(org: string) {
  const u = await prisma.necesidadSnapshot.findFirst({ where: { organizacionId: org }, orderBy: { calculadoEn: "desc" }, select: { calculadoEn: true } });
  if (!u) return [];
  const limite = new Date(hoyUTC().getTime() + 7 * DIA);
  return prisma.necesidadSnapshot.findMany({ where: { organizacionId: org, calculadoEn: u.calculadoEn, fechaQuiebre: { lte: limite } }, select: { stockItemId: true, urgencia: true, fechaQuiebre: true } });
}
