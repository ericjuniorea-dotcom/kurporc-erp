/**
 * Carga los registros de Producción (KUR-PRO-REG-01) y Sanidad (KUR-SAN-REG-01) de una granja real:
 * plantel, reproductores, servicios, diagnósticos, repeticiones, partos, adopciones, mortandad,
 * destetes y lotes de recría, salidas (enlazadas a las ventas ya importadas en Finanzas, sin duplicar
 * ingresos), protocolo sanitario y aplicaciones registradas.
 *
 *   DATOS=ruta.json ORG=<id de organización> PROPIETARIO=correo npm run db:importar-produccion
 *   SOLO_VALIDAR=<id de organización> npm run db:importar-produccion        (solo el informe)
 *
 * El archivo de datos tiene información de la granja y sus clientes: no va al repositorio.
 * Todo corre en una transacción: si algo falla no queda nada a medias. Se niega si la granja ya tiene cerdas.
 */
import { readFileSync } from "node:fs";
import { PrismaClient, type Prisma, type SowPlantelState, type PigletDeathCause, type FarrowingType, type BodyConditionScore } from "@prisma/client";

const prisma = new PrismaClient();
type Tx = Prisma.TransactionClient;
type Fila = (string | number | null)[];
type Datos = {
  corte: string; fuente: string;
  reproductores: { codigo: string; tipo: string }[];
  plantel: Fila[]; servicios: Fila[]; partos: Fila[]; destetes: Fila[]; lotes: [string, string][];
  mortandad: Fila[]; adopciones: [string, string, string, number][]; salidas: Fila[];
  sanidad: {
    productos: [string, string, string | null, string, string, number][];
    protocolo_cerdas: [string, string, string[], string, number][];
    protocolo_lechones: [string, string, string[], string, number][];
    aplicaciones_cerdas: Record<string, (string | null)[]>;
    aplicaciones_lechones: Record<string, (string | null)[]>;
  };
};

const D = (s: string) => new Date(`${s}T12:00:00Z`); // mediodía UTC: se ve el mismo día en Paraguay
const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);
const sumar = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function semanaIso(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - ini.getTime()) / 86_400_000 + 1) / 7)).padStart(2, "0")}`;
}
const CAUSA: Record<string, PigletDeathCause> = { "Otra": "OTHER", "Neumonía": "DISEASE", "Diarrea": "DIARRHEA", "Aplastamiento": "CRUSHING", "Débil al nacer": "WEAKNESS", "Malformación": "CONGENITAL" };
const TIPO_PARTO: Record<string, FarrowingType> = { "Normal": "NORMAL", "Distócico": "DYSTOCIA", "Asistido": "ASSISTED" };

async function importar(tx: Tx, org: string, actor: string, d: Datos) {
  const r = { cerdas: 0, reproductores: 0, servicios: 0, diagnosticos: 0, repeticiones: 0, partos: 0, adopciones: 0, muertesLactancia: 0, muertesRecria: 0, destetes: 0, lotes: 0, salidas: 0, productos: 0, protocoloItems: 0, eventosSanidad: 0, aplicaciones: 0 };

  // Reproductores
  const verraco = new Map<string, string>();
  for (const b of d.reproductores) {
    const x = await tx.boar.create({ data: { tenantId: org, identCode: b.codigo, breed: b.codigo, geneticLine: b.codigo, plantelState: "ACTIVE", plantelNotes: b.tipo } });
    verraco.set(b.codigo, x.id); r.reproductores++;
  }

  // Plantel
  const partosDe = new Map<string, number>();
  for (const p of d.partos) { const s = d.servicios.find(x => x[0] === p[1]); if (s) partosDe.set(String(s[2]), (partosDe.get(String(s[2])) ?? 0) + 1); }
  const cerda = new Map<string, { id: string; baja: Date | null }>();
  for (const [codigo, arete, genetica, nac, ingreso, baja, motivo, estado, obs] of d.plantel as [string, string, string, string, string, string | null, string | null, SowPlantelState, string][]) {
    const x = await tx.sow.create({ data: {
      tenantId: org, identCode: codigo, caravanaCode: codigo, tattooCode: arete, breed: genetica, geneticLine: genetica,
      birthDate: D(nac), entryDate: D(ingreso), sourceProvider: "Propia", currentParityCount: partosDe.get(codigo) ?? 0,
      isActive: !baja, plantelState: estado, plantelNotes: obs,
    } });
    cerda.set(codigo, { id: x.id, baja: baja ? D(baja) : null }); r.cerdas++;
    await tx.animalEvent.create({ data: { tenantId: org, sowId: x.id, eventType: "ENTRY", eventDate: D(ingreso), description: `Ingreso al plantel (${genetica})`, moduleSource: "PLANTEL", userId: actor } });
    if (baja) {
      await tx.sowDiscard.create({ data: { tenantId: org, sowId: x.id, discardDate: D(baja), reason: motivo ?? "", destination: "Muerte", categoria: "Muerte", motivoPrincipal: motivo, tipoDescarte: "Muerte", numeroParto: partosDe.get(codigo) ?? 0, observaciones: obs } });
      await tx.animalEvent.create({ data: { tenantId: org, sowId: x.id, eventType: "DEATH", eventDate: D(baja), description: `Muerte: ${motivo}`, newState: "DEAD", moduleSource: "PLANTEL", userId: actor } });
    }
  }

  // Servicios por banda (o por semana si no tiene banda), diagnósticos y repeticiones
  const tanda = new Map<string, string>();
  const servicio = new Map<string, { id: string; fecha: Date; cerda: string; resultado: string | null }>();
  for (const [num, fecha, codigo, rep, dosis, banda, resultado, fDiag, metodo] of d.servicios as [string, string, string, string | null, number, string | null, string | null, string | null, string | null][]) {
    const c = cerda.get(codigo); if (!c) throw new Error(`${num}: la cerda ${codigo} no está en el plantel`);
    const f = D(fecha), semana = semanaIso(f), clave = `${semana}|${banda ?? ""}`;
    if (!tanda.has(clave)) tanda.set(clave, (await tx.serviceBatch.create({ data: { tenantId: org, weekLabel: semana, code: banda, notes: banda ? `Banda ${banda}` : null } })).id);
    const s = await tx.serviceEvent.create({ data: {
      tenantId: org, sowId: c.id, serviceBatchId: tanda.get(clave)!, serviceDate: f, serviceType: "AI",
      boarId: rep ? verraco.get(rep) ?? null : null, employeeId: actor, notes: `${num} · ${dosis} dosis${rep ? ` · ${rep}` : ""}`,
    } });
    servicio.set(num, { id: s.id, fecha: f, cerda: codigo, resultado }); r.servicios++;
    if (resultado === "Repitió celo" && fDiag) {
      await tx.heatRepeat.create({ data: { tenantId: org, sowId: c.id, serviceEventId: s.id, repeatDate: D(fDiag), cause: metodo ?? "Repetición de celo" } }); r.repeticiones++;
    } else if ((resultado === "Preñada" || resultado === "Vacía") && fDiag) {
      await tx.pregnancyCheck.create({ data: { tenantId: org, sowId: c.id, serviceEventId: s.id, checkDate: D(fDiag), method: metodo === "Ecografía" ? "ULTRASOUND" : "VISUAL", result: resultado === "Preñada" ? "PREGNANT" : "NOT_PREGNANT", notes: metodo } }); r.diagnosticos++;
    }
  }

  // Partos
  const parto = new Map<string, { id: string; fecha: Date; vivos: number; cerda: string; servicio: string }>();
  for (const [num, sv, fecha, vivos, muertos, peso, tipo, obs] of d.partos as [string, string, string, number, number, number | null, string, string | null][]) {
    const s = servicio.get(sv); if (!s) throw new Error(`${num}: no existe el servicio ${sv}`);
    const f = D(fecha);
    const x = await tx.farrowingEvent.create({ data: {
      tenantId: org, sowId: cerda.get(s.cerda)!.id, serviceEventId: s.id, farrowingType: TIPO_PARTO[tipo] ?? "NORMAL", startDatetime: f,
      gestationDays: dias(s.fecha, f), bornAlive: vivos, bornDead: muertos, mummified: 0, totalBorn: vivos + muertos,
      totalLitterWeightKg: peso ?? 0, avgPigletWeightKg: peso && vivos ? Math.round((peso / vivos) * 1000) / 1000 : null,
      employeeId: actor, notes: [num, obs].filter(Boolean).join(" · "),
    } });
    parto.set(num, { id: x.id, fecha: f, vivos, cerda: s.cerda, servicio: sv }); r.partos++;
    await tx.animalEvent.create({ data: { tenantId: org, sowId: cerda.get(s.cerda)!.id, eventType: "FARROWING", eventDate: f, description: `Parto ${num}: ${vivos} vivos, ${muertos} muertos`, moduleSource: "MATERNIDAD", userId: actor, metadata: { farrowingId: x.id } } });
  }

  // Adopciones
  for (const [fecha, dona, recibe, n] of d.adopciones) {
    await tx.pigletMovement.create({ data: { tenantId: org, originId: parto.get(dona)!.id, destinationId: parto.get(recibe)!.id, movementDate: D(fecha), quantity: n, employeeId: actor } }); r.adopciones++;
  }

  // Lechones vivos de una camada en una fecha (para dosis y para el stock al destete)
  const vivosEn = (num: string, f: Date, incluirDia = false) => {
    const p = parto.get(num)!;
    const antes = (s: string) => incluirDia ? D(s) <= f : D(s) < f;
    const recibe = d.adopciones.filter(a => a[2] === num && antes(a[0])).reduce((t, a) => t + a[3], 0);
    const dona = d.adopciones.filter(a => a[1] === num && antes(a[0])).reduce((t, a) => t + a[3], 0);
    const muertos = (d.mortandad as [string, string | null, string | null, string | null, number][]).filter(m => m[1] === num && antes(m[0])).reduce((t, m) => t + m[4], 0);
    return p.vivos + recibe - dona - muertos;
  };

  // Mortandad en lactancia (las de recría y de la cerda van aparte)
  for (const [fecha, pt, , , n, causa] of d.mortandad as [string, string | null, string | null, string | null, number, string | null][]) {
    if (!pt) continue;
    const p = parto.get(pt)!;
    await tx.pigletDeath.create({ data: { tenantId: org, farrowingId: p.id, deathDatetime: D(fecha), quantity: n, ageAtDeathDays: dias(p.fecha, D(fecha)), cause: CAUSA[causa ?? "Otra"] ?? "OTHER", employeeId: actor } });
    r.muertesLactancia += n;
  }

  // Lotes de recría (uno por fecha de destete, con el código de la planilla) y destetes
  const lote = new Map<string, { id: string; fecha: Date; codigo: string }>();
  const lotePorFecha = new Map<string, string>();
  for (const [codigo, fecha] of d.lotes) {
    const destetados = (d.destetes as [string, string, number][]).filter(w => w[1] === fecha).reduce((t, w) => t + w[2], 0);
    const muertos = (d.mortandad as [string, string | null, string | null, string | null, number][]).filter(m => m[2] === codigo).reduce((t, m) => t + m[4], 0);
    const vendidos = (d.salidas as [string, string, string, number][]).filter(s => s[2] === codigo).reduce((t, s) => t + s[3], 0);
    const quedan = destetados - muertos - vendidos;
    const x = await tx.nurseryBatch.create({ data: { tenantId: org, batchCode: codigo, phase: "PHASE_1", entryDate: D(fecha), currentCount: quedan, isActive: quedan > 0 } });
    lote.set(codigo, { id: x.id, fecha: D(fecha), codigo }); lotePorFecha.set(fecha, codigo); r.lotes++;
  }
  for (const [pt, fecha, n, cc, obs] of d.destetes as [string, string, number, number, string | null][]) {
    const p = parto.get(pt)!, f = D(fecha), l = lote.get(lotePorFecha.get(fecha)!)!;
    await tx.weaningEvent.create({ data: {
      tenantId: org, farrowingId: p.id, weaningDate: f, lactationDays: dias(p.fecha, f), pigletsAvailable: Math.max(n, vivosEn(pt, f, true)), pigletsWeaned: n,
      totalLitterWeightKg: 0, avgPigletWeightKg: 0, nurseryBatchId: l.id, sowDestination: "GESTATION", bodyConditionScore: `SCORE_${cc}` as BodyConditionScore,
      employeeId: actor, notes: [`Lote ${l.codigo}`, obs].filter(Boolean).join(" · "),
    } });
    await tx.animalEvent.create({ data: { tenantId: org, sowId: cerda.get(p.cerda)!.id, eventType: "WEANING", eventDate: f, description: `Destete de ${n} lechones al lote ${l.codigo}`, moduleSource: "MATERNIDAD", userId: actor } });
    r.destetes++;
  }

  // Mortandad en recría y de la cerda
  for (const [fecha, , lt, , n, causa, obs] of d.mortandad as [string, string | null, string | null, string | null, number, string | null, string | null][]) {
    if (!lt) continue;
    const l = lote.get(lt)!;
    await tx.animalEvent.create({ data: { tenantId: org, eventType: "DEATH", eventDate: D(fecha), moduleSource: "RECRIA", userId: actor,
      description: `Muerte en lote ${l.codigo}: ${n} animal${n > 1 ? "es" : ""} — ${causa ?? "Sin causa registrada"}`,
      metadata: { batchId: l.id, batchCode: l.codigo, quantity: n, cause: CAUSA[causa ?? "Otra"] ?? "OTHER", notes: obs ?? (causa ? undefined : "Falta la causa") } } });
    r.muertesRecria += n;
  }

  // Salidas: enlazadas a la venta que ya está en Finanzas (por remito); no se crea otro ingreso
  for (const [remito, fecha, lt, n, kg, precio, cliente, , obs] of d.salidas as [string, string, string, number, number, number, string, string, string | null][]) {
    const l = lote.get(lt)!;
    await tx.batchSale.create({ data: { tenantId: org, nurseryBatchId: l.id, saleDate: D(fecha), animalCount: n, totalWeightKg: kg, pricePerKg: precio, totalAmount: Math.round(kg * precio), buyerName: cliente, transferGuide: remito, employeeId: actor } });
    const v = await tx.venta.findFirst({ where: { organizacionId: org, remitoFactura: remito, estado: "CONFIRMADA" } });
    if (v) await tx.venta.update({ where: { id: v.id }, data: { loteDesteteId: l.id } });
    else console.warn(`  ! La salida ${remito} no tiene venta en Finanzas: queda solo la salida del lote`);
    if (obs) console.warn(`  · ${remito}: ${obs}`);
    r.salidas++;
  }

  // ── Sanidad ─────────────────────────────────────────────────────────────
  const producto = new Map<string, string>();
  for (const [nombre, enfermedad, laboratorio, via, sector, ml] of d.sanidad.productos) {
    const p = await tx.productoInventario.findFirst({ where: { tenantId: org, nombre } })
      ?? await tx.productoInventario.create({ data: { tenantId: org, nombre, enfermedad, sectorDestino: sector, categoria: "VACUNA", unidadMedida: "ML", dosisMl: ml } });
    await tx.productoInventario.update({ where: { id: p.id }, data: { enfermedad, sectorDestino: sector, viaAplicacion: via, dosisMl: ml, ...(laboratorio ? { observaciones: `Laboratorio: ${laboratorio}` } : {}) } });
    producto.set(nombre, p.id); r.productos++;
  }
  const mlDe = new Map(d.sanidad.productos.map(p => [p[0], p[5]]));
  const proto = async (nombre: string, fase: string, tipoAnimal: string, items: [string, string, string[], string, number][]) => {
    const pr = await tx.protocoloSanitario.create({ data: { tenantId: org, nombre, fase, tipoAnimal, descripcion: "Calendario KUR-SAN-PRO-01, importado de la planilla de Sanidad" } });
    const out = new Map<string, { itemIds: { id: string; vacunaId: string; nombre: string }[]; dia: number; disparador: string; etiqueta: string }>();
    for (const [clave, etiqueta, productos, disparador, dia] of items) {
      const ids = [];
      for (const pn of productos) {
        const it = await tx.protocoloItem.create({ data: { tenantId: org, protocoloId: pr.id, vacunaId: producto.get(pn)!, diaCiclo: dia, disparador, esObligatorio: true, descripcion: etiqueta } });
        ids.push({ id: it.id, vacunaId: it.vacunaId, nombre: pn }); r.protocoloItems++;
      }
      out.set(clave, { itemIds: ids, dia, disparador, etiqueta });
    }
    return out;
  };
  const pc = await proto("Calendario de cerdas", "gestacion", "cerda", d.sanidad.protocolo_cerdas);
  const pl = await proto("Calendario de lechones", "maternidad", "lechon", d.sanidad.protocolo_lechones);

  // Carnet de la cerda (ConfigVacuna): días de gestación y posparto, para las alertas por animal
  const carnet = new Map<string, string>();
  for (const [clave, etiqueta, productos, disparador, dia] of d.sanidad.protocolo_cerdas) {
    for (const pn of productos) {
      const info = d.sanidad.productos.find(p => p[0] === pn)!;
      const cv = await tx.configVacuna.create({ data: {
        tenantId: org, modulo: disparador === "servicio" ? "GESTACION" : "MATERNIDAD", nombreVacuna: etiqueta === pn ? pn : `${etiqueta} — ${pn}`,
        marcaComercial: pn, laboratorio: info[2] ?? "—", principioActivo: "—", enfermedadObjetivo: info[1], viaAplicacion: info[3].toUpperCase(),
        dosisMl: info[5], momentoAplicacion: disparador === "servicio" ? `Día ${dia} desde el servicio` : `Día ${dia} posparto`,
        paisProcedencia: "—", tempConservacion: "Heladera 2 a 8 °C", obligatoria: false, paridad: "AMBAS",
        diaGestacion: disparador === "servicio" ? dia : null, ordenDosis: clave.endsWith("2") ? 2 : 1,
        grupoMezclaId: productos.length > 1 ? clave : null, sujeto: disparador === "parto" ? "HEMBRA" : null, diaReferencia: disparador === "parto" ? dia : null,
      } });
      carnet.set(`${clave}|${pn}`, cv.id);
    }
  }

  const evento = async (o: { item: { id: string; vacunaId: string; nombre: string }; clave: string; fecha: Date; sector: string; disparador: string; dosis: number; etiqueta: string;
    animalId?: string; farrowingId?: string; aplicado: string | null }) => {
    const aplicada = o.aplicado && o.aplicado !== "NO";
    const fechaApl = aplicada ? (o.aplicado === "SI" ? o.fecha : D(o.aplicado!)) : null;
    const ev = await tx.eventoVacunacion.create({ data: {
      tenantId: org, protocoloItemId: o.item.id, vacunaId: o.item.vacunaId, sector: o.sector, fecha: o.fecha, animalId: o.animalId, farrowingId: o.farrowingId,
      targetLabel: o.etiqueta, dosisNecesarias: o.dosis, estado: aplicada ? "aplicado" : "pendiente", disparador: o.disparador, sectorAlAplicar: aplicada ? o.sector : null,
    } });
    r.eventosSanidad++;
    if (aplicada && fechaApl) {
      await tx.aplicacionVacuna.create({ data: { tenantId: org, eventoId: ev.id, vacunaId: o.item.vacunaId, dosisAplicadas: o.dosis, fechaAplicacion: fechaApl,
        responsable: "Planilla de Sanidad", observaciones: o.aplicado === "SI" ? "Marcada como aplicada sin fecha real: se tomó la fecha programada" : null } });
      r.aplicaciones++;
      const cv = carnet.get(`${o.clave}|${o.item.nombre}`);
      if (o.animalId && cv) await tx.animalEvent.create({ data: { tenantId: org, sowId: o.animalId, eventType: "VACCINATION", eventDate: fechaApl, moduleSource: "SANIDAD", userId: actor,
        metadata: { configVacunaId: cv, nombreVacuna: o.item.nombre, responsable: "Planilla de Sanidad", lote: null, observaciones: null, diasEsperaServicio: 0, ml: mlDe.get(o.item.nombre) } } });
    }
  };

  // Cerdas: un evento por dosis del calendario en cada servicio que sigue en el plan (o que ya tuvo aplicaciones)
  const claves = d.sanidad.protocolo_cerdas.map(p => p[0]);
  for (const [num, s] of servicio) {
    const ap = d.sanidad.aplicaciones_cerdas[num] ?? [];
    const pt = Array.from(parto.entries()).find(([, p]) => p.servicio === num);
    const c = cerda.get(s.cerda)!;
    const sigue = !!pt || (s.resultado !== "Vacía" && s.resultado !== "Repitió celo" && !c.baja);
    for (const [i, clave] of claves.entries()) {
      const def = pc.get(clave)!, valor = ap[i] ?? null;
      if (!sigue && !valor) continue;
      if (def.disparador === "parto" && !pt) continue; // la dosis posparto la genera la app al cargar el parto
      const base = def.disparador === "servicio" ? s.fecha : pt![1].fecha;
      for (const item of def.itemIds) await evento({ item, clave, fecha: sumar(base, def.dia), sector: def.disparador === "servicio" ? "gestacion" : "maternidad",
        disparador: def.disparador === "servicio" ? `servicio-${s.id}-vacuna-${item.id}` : `parto-${pt![1].id}-vacuna-${item.id}`,
        dosis: 1, etiqueta: `Cerda ${s.cerda}`, animalId: c.id, farrowingId: def.disparador === "parto" ? pt![1].id : undefined, aplicado: valor });
    }
  }
  // Lechones: dosis por los lechones vivos de la camada ese día
  const clavesL = d.sanidad.protocolo_lechones.map(p => p[0]);
  for (const [num, p] of parto) {
    const ap = d.sanidad.aplicaciones_lechones[num] ?? [];
    for (const [i, clave] of clavesL.entries()) {
      const def = pl.get(clave)!, f = sumar(p.fecha, def.dia), n = vivosEn(num, f);
      if (n <= 0) continue;
      for (const item of def.itemIds) await evento({ item, clave, fecha: f, sector: "maternidad", disparador: `parto-${p.id}-vacuna-${item.id}`,
        dosis: n, etiqueta: `Camada ${num} (cerda ${p.cerda})`, farrowingId: p.id, aplicado: ap[i] ?? null });
    }
  }
  return r;
}

async function informe(org: string) {
  const [cerdas, activas, partos, sumas, lact, destetes, lotes, salidas, eventos] = await Promise.all([
    prisma.sow.count({ where: { tenantId: org } }),
    prisma.sow.count({ where: { tenantId: org, isActive: true } }),
    prisma.farrowingEvent.count({ where: { tenantId: org } }),
    prisma.farrowingEvent.aggregate({ where: { tenantId: org }, _sum: { totalBorn: true, bornAlive: true, bornDead: true } }),
    prisma.pigletDeath.aggregate({ where: { tenantId: org }, _sum: { quantity: true } }),
    prisma.weaningEvent.aggregate({ where: { tenantId: org }, _sum: { pigletsWeaned: true } }),
    prisma.nurseryBatch.findMany({ where: { tenantId: org }, orderBy: { batchCode: "asc" }, select: { batchCode: true, currentCount: true } }),
    prisma.batchSale.aggregate({ where: { tenantId: org }, _sum: { animalCount: true } }),
    prisma.eventoVacunacion.groupBy({ by: ["estado"], where: { tenantId: org }, _count: { _all: true } }),
  ]);
  const recria = (await prisma.animalEvent.findMany({ where: { tenantId: org, eventType: "DEATH", moduleSource: "RECRIA" }, select: { metadata: true } }))
    .reduce((t, e) => t + Number((e.metadata as { quantity?: number } | null)?.quantity ?? 0), 0);
  // Lechones con la madre: nacidos vivos + recibidos − donados − muertos de las camadas sin destetar
  const sinDestetar = await prisma.farrowingEvent.findMany({ where: { tenantId: org, weaning: null }, select: { bornAlive: true, deaths: { select: { quantity: true } }, movementsAsOrigin: { select: { quantity: true } }, movementsAsDestination: { select: { quantity: true } } } });
  const maternidad = sinDestetar.reduce((t, f) => t + f.bornAlive + f.movementsAsDestination.reduce((a, m) => a + m.quantity, 0) - f.movementsAsOrigin.reduce((a, m) => a + m.quantity, 0) - f.deaths.reduce((a, m) => a + m.quantity, 0), 0);
  const galpon = lotes.reduce((t, l) => t + l.currentCount, 0);
  const filas: [string, number, number][] = [
    ["Cerdas en el plantel", cerdas, 39], ["Madres activas", activas, 37], ["Partos", partos, 23],
    ["Nacidos totales", sumas._sum.totalBorn ?? 0, 276], ["Nacidos vivos", sumas._sum.bornAlive ?? 0, 263], ["Muertos al nacer", sumas._sum.bornDead ?? 0, 13],
    ["Muertos en lactancia", lact._sum.quantity ?? 0, 36], ["Destetados", destetes._sum.pigletsWeaned ?? 0, 215], ["Muertos en recría", recria, 5],
    ["Vendidos a Comercial", salidas._sum.animalCount ?? 0, 79], ["En maternidad hoy", maternidad, 6], ["En galpón de destete hoy", galpon, 131], ["Lechones en la granja", maternidad + galpon, 137],
  ];
  console.log("\nControl contra la planilla (DASHBOARD y STOCK_LECHONES al 15/10/2026):");
  for (const [n, v, e] of filas) console.log(`  ${v === e ? "✓" : "✗"} ${n.padEnd(28)} ${String(v).padStart(5)}   planilla ${e}`);
  console.log(`  Lotes: ${lotes.map(l => `${l.batchCode}=${l.currentCount}`).join(" · ")}   (planilla L-0001=14 · L-0002=48 · L-0003=21 · L-0004=48)`);
  console.log(`  Agenda sanitaria: ${eventos.map(e => `${e.estado} ${e._count._all}`).join(" · ")}`);
  return filas.every(([, v, e]) => v === e);
}

async function main() {
  const soloValidar = process.env.SOLO_VALIDAR;
  if (soloValidar) { const ok = await informe(soloValidar); process.exit(ok ? 0 : 1); }
  const ruta = process.env.DATOS, org = process.env.ORG ?? "", email = (process.env.PROPIETARIO ?? "").toLowerCase();
  if (!ruta || !org || !email) throw new Error("Faltan DATOS, ORG y PROPIETARIO");
  const datos = JSON.parse(readFileSync(ruta, "utf8")) as Datos;
  const t = await prisma.tenant.findUnique({ where: { id: org }, select: { farmName: true } });
  if (!t) throw new Error("No existe la organización");
  const u = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!u) throw new Error("No existe el usuario propietario");
  if (await prisma.sow.count({ where: { tenantId: org } })) throw new Error(`${t.farmName} ya tiene cerdas cargadas: no se importa encima`);
  console.log(`Importando ${datos.fuente} en «${t.farmName}»…`);
  const r = await prisma.$transaction(async tx => {
    await tx.$executeRaw`select set_config('app.actor_id', ${u.id}, true)`;
    return importar(tx, org, u.id, datos);
  }, { timeout: 600_000, maxWait: 20_000 });
  console.log("Cargado:", Object.entries(r).map(([k, v]) => `${k} ${v}`).join(" · "));
  const ok = await informe(org);
  if (!ok) process.exitCode = 1;
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
