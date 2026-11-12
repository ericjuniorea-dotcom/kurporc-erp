/**
 * Recarga completa de los datos productivos y sanitarios de una granja desde el paquete de importación
 * (kurporc_granja_AAAA-MM-DD.json, LEEME_CLAUDE_CODE.md). Finanzas no se toca: las salidas se enlazan
 * a las ventas que ya están en Finanzas por número de remito.
 *
 *   DATOS=ruta.json ORG=<id> PROPIETARIO=<correo> npm run db:importar-paquete              (en seco: no escribe)
 *   DATOS=ruta.json ORG=<id> PROPIETARIO=<correo> ESCRIBIR=SI npm run db:importar-paquete  (escribe)
 *
 * Todo corre en una transacción: borra lo productivo de la granja, carga el paquete, verifica los
 * totales de control (sección 6 del LEEME) y la auditoría de consistencia, y recién ahí confirma.
 * En seco hace exactamente lo mismo y deshace al final. Si un total no coincide o la auditoría
 * encuentra un error, no escribe nada.
 * El archivo de datos tiene información de la granja y sus clientes: no va al repositorio.
 */
import { readFileSync } from "node:fs";
import { PrismaClient, type Prisma, type SowPlantelState, type PigletDeathCause, type BodyConditionScore } from "@prisma/client";
import { auditarGranja, stockCamada } from "../src/lib/auditoria/granja";

const prisma = new PrismaClient();
type Tx = Prisma.TransactionClient;
// eslint-disable-next-line
type J = Record<string, any>; // filas del JSON del paquete (estructura documentada en su LEEME)

const D = (s: string) => new Date(`${s}T12:00:00Z`); // mediodía UTC: el mismo día en Paraguay
const dias = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);
const MARCA = "importacion-paquete";
class Deshacer extends Error {}

function semanaIso(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia);
  const ini = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - ini.getTime()) / 86_400_000 + 1) / 7)).padStart(2, "0")}`;
}
const ESTADO: Record<string, SowPlantelState> = {
  "Gestante confirmada": "PREGNANT", "Servida - pendiente de diagnóstico": "MATED", "SIN DIAGNÓSTICO - atrasado": "MATED",
  "Vacía - disponible": "EMPTY", "Parida - en lactancia": "LACTATING", "BAJA": "DEAD",
};
const CAUSA: Record<string, PigletDeathCause> = { "Otra": "OTHER", "Neumonía": "DISEASE", "Diarrea": "DIARRHEA", "Aplastamiento": "CRUSHING", "Débil al nacer": "WEAKNESS", "Malformación": "CONGENITAL" };
const CATEGORIA: Record<string, "VACUNA" | "MEDICAMENTO" | "SUPLEMENTO"> = { "Vacuna": "VACUNA", "Medicamento": "MEDICAMENTO", "Suplemento": "SUPLEMENTO", "Antiparasitario": "MEDICAMENTO" };

/** Borra todo lo productivo y sanitario de la granja (no Finanzas, no el stock de productos). */
async function borrar(tx: Tx, org: string) {
  const w = { tenantId: org };
  const sows = (await tx.sow.findMany({ where: w, select: { id: true } })).map(s => s.id);
  const partos = (await tx.farrowingEvent.findMany({ where: w, select: { id: true } })).map(s => s.id);
  const lotes = (await tx.nurseryBatch.findMany({ where: w, select: { id: true } })).map(s => s.id);
  if (await tx.growingBatch.count({ where: { tenantId: org, nurseryBatchId: { in: lotes } } })) throw new Error("Hay lotes de engorde que salieron de los lotes de recría: no se borra (revisar a mano).");
  const n: Record<string, number> = {};
  const c = async (k: string, p: Promise<{ count: number }>) => { n[k] = (await p).count; };
  await tx.venta.updateMany({ where: { organizacionId: org, loteDesteteId: { not: null } }, data: { loteDesteteId: null } });
  await c("aplicaciones", tx.aplicacionVacuna.deleteMany({ where: w }));
  await c("eventosVacunacion", tx.eventoVacunacion.deleteMany({ where: w }));
  await c("protocoloItems", tx.protocoloItem.deleteMany({ where: w }));
  await c("protocolos", tx.protocoloSanitario.deleteMany({ where: w }));
  await c("carnet", tx.configVacuna.deleteMany({ where: { tenantId: org, momentoAplicacion: { startsWith: "Día " } } }));
  await c("tareas", tx.task.deleteMany({ where: { tenantId: org, OR: [{ animalId: { in: sows } }, { farrowingId: { in: partos } }, { nurseryBatchId: { in: lotes } }, { disparador: { startsWith: MARCA } }] } }));
  await c("eventosAnimal", tx.animalEvent.deleteMany({ where: w }));
  await c("necropsias", tx.necropsia.deleteMany({ where: w }));
  await c("tratamientos", tx.curativeTreatment.deleteMany({ where: w }));
  await c("carencias", tx.withdrawalPeriod.deleteMany({ where: { tenantId: org, growingBatchId: null } }));
  await c("tareasSanidad", tx.healthTask.deleteMany({ where: w }));
  await c("procedimientos", tx.procedimientoMaternidad.deleteMany({ where: w }));
  await c("ajustesStock", tx.stockAdjustmentRequest.deleteMany({ where: w }));
  await c("donaciones", tx.fosterDonation.deleteMany({ where: { fosterEvent: { tenantId: org } } }));
  await c("adopcionesViejas", tx.fosterEvent.deleteMany({ where: w }));
  await c("alimento", tx.feedRecord.deleteMany({ where: { tenantId: org, growingBatchId: null } }));
  await c("muertesLechon", tx.pigletDeath.deleteMany({ where: w }));
  await c("lechones", tx.piglet.deleteMany({ where: w }));
  await c("adopciones", tx.pigletMovement.deleteMany({ where: w }));
  await c("destetes", tx.weaningEvent.deleteMany({ where: w }));
  await c("cambiosFase", tx.phaseChange.deleteMany({ where: w }));
  await c("pesajes", tx.weightRecord.deleteMany({ where: { tenantId: org, growingBatchId: null } }));
  await c("ventasLote", tx.batchSale.deleteMany({ where: { tenantId: org, growingBatchId: null } }));
  await c("lotes", tx.nurseryBatch.deleteMany({ where: w }));
  await c("partos", tx.farrowingEvent.deleteMany({ where: w }));
  await c("diagnosticos", tx.pregnancyCheck.deleteMany({ where: w }));
  await c("repeticiones", tx.heatRepeat.deleteMany({ where: w }));
  await c("abortos", tx.abortionEvent.deleteMany({ where: w }));
  await c("bajas", tx.sowDiscard.deleteMany({ where: w }));
  await c("servicios", tx.serviceEvent.deleteMany({ where: w }));
  await c("tandas", tx.serviceBatch.deleteMany({ where: w }));
  await c("dosis", tx.semenDose.deleteMany({ where: w }));
  await c("verracos", tx.boar.deleteMany({ where: w }));
  await c("cerdas", tx.sow.deleteMany({ where: w }));
  return n;
}

async function importar(tx: Tx, org: string, actor: string, d: J) {
  const r: Record<string, number> = {};
  const mas = (k: string, v = 1) => { r[k] = (r[k] ?? 0) + v; };

  // ── Plantel (las bajas quedan con su historia, fuera del plantel activo) ──
  const cerda = new Map<string, { id: string; baja: Date | null; activa: boolean }>();
  for (const p of d.plantel as J[]) {
    const activa = p.estado_alta === "ACTIVA";
    const sinServicio = (p.servicios_totales ?? 0) === 0;
    let estado: SowPlantelState = activa ? (ESTADO[p.estado_reproductivo_12_11] ?? "EMPTY") : "DEAD";
    if (activa && String(p.estado_reproductivo_12_11).startsWith("Vacía")) estado = sinServicio ? "REPLACEMENT_READY" : "EMPTY";
    const nota = [p.nota, p.proxima_accion && p.proxima_accion !== "-" ? `Próxima acción: ${p.proxima_accion}${p.fecha_proxima_accion ? ` (${p.fecha_proxima_accion})` : ""}` : null].filter(Boolean).join(" · ") || null;
    const x = await tx.sow.create({ data: {
      tenantId: org, identCode: p.codigo, caravanaCode: p.codigo, tattooCode: p.arete, breed: p.genetica, geneticLine: p.genetica,
      birthDate: p.fecha_nacimiento ? D(p.fecha_nacimiento) : null, entryDate: D(p.fecha_ingreso), sourceProvider: p.origen,
      currentParityCount: p.partos_totales ?? 0, isActive: activa, plantelState: estado, plantelNotes: nota,
    } });
    cerda.set(p.codigo, { id: x.id, baja: p.fecha_baja ? D(p.fecha_baja) : null, activa }); mas("cerdas");
    await tx.animalEvent.create({ data: { tenantId: org, sowId: x.id, eventType: "ENTRY", eventDate: D(p.fecha_ingreso), description: `Ingreso al plantel (${p.genetica}, origen ${p.origen})`, moduleSource: "PLANTEL", userId: actor } });
    if (!activa) {
      await tx.sowDiscard.create({ data: { tenantId: org, sowId: x.id, discardDate: D(p.fecha_baja), reason: p.motivo_baja ?? "", destination: "Muerte", categoria: "Muerte", motivoPrincipal: p.motivo_baja, tipoDescarte: "Muerte", numeroParto: p.partos_totales ?? 0, numeroServicios: p.servicios_totales ?? 0, observaciones: p.nota } });
      await tx.animalEvent.create({ data: { tenantId: org, sowId: x.id, eventType: "DEATH", eventDate: D(p.fecha_baja), description: `Muerte: ${p.motivo_baja}`, newState: "DEAD", moduleSource: "PLANTEL", userId: actor } });
      mas("bajas");
    }
  }
  const cerdaDe = (c: string) => { const x = cerda.get(String(c)); if (!x) throw new Error(`La cerda ${c} no está en el plantel`); return x; };

  // ── Servicios (por banda o por semana), diagnósticos, repeticiones y abortos ──
  // Los reproductores son dosis de IA, no animales del plantel: quedan en la nota del servicio.
  const tanda = new Map<string, string>();
  const servicio = new Map<string, { id: string; fecha: Date; cerda: string }>();
  for (const s of d.servicios as J[]) {
    const c = cerdaDe(s.cerda), f = D(s.fecha_servicio), clave = s.banda ?? semanaIso(f);
    if (!tanda.has(clave)) tanda.set(clave, (await tx.serviceBatch.create({ data: { tenantId: org, weekLabel: semanaIso(f), code: s.banda, notes: s.banda ? `Banda ${s.banda}` : null } })).id);
    const reps = [s.reproductor_1, s.reproductor_2].filter(Boolean);
    const cambio = s.resultado_planilla !== s.resultado_corregido ? ` · Planilla: «${s.resultado_planilla ?? "—"}», corregido: «${s.resultado_corregido}»` : "";
    const x = await tx.serviceEvent.create({ data: {
      tenantId: org, sowId: c.id, serviceBatchId: tanda.get(clave)!, serviceDate: f, serviceType: "AI", employeeId: actor,
      notes: `${s.codigo} · ${s.dosis ?? "?"} dosis IA · ${reps.join(" + ") || "reproductor sin cargar"}${s.banda ? ` · banda ${s.banda}` : ""}${cambio}${s.nota ? ` · ${s.nota}` : ""}`,
    } });
    servicio.set(s.codigo, { id: x.id, fecha: f, cerda: String(s.cerda) }); mas("servicios");
    const res = s.resultado_corregido, fd = s.fecha_diagnostico ? D(s.fecha_diagnostico) : null;
    const metodo = s.metodo_diagnostico === "Ecografía" ? "ULTRASOUND" : "VISUAL";
    if (res === "Preñada" && fd) { await tx.pregnancyCheck.create({ data: { tenantId: org, sowId: c.id, serviceEventId: x.id, checkDate: fd, method: metodo, result: "PREGNANT", notes: s.metodo_diagnostico } }); mas("diagnosticos"); }
    else if (res === "Vacía" && fd) { await tx.pregnancyCheck.create({ data: { tenantId: org, sowId: c.id, serviceEventId: x.id, checkDate: fd, method: metodo, result: "NOT_PREGNANT", notes: s.metodo_diagnostico } }); mas("diagnosticos"); }
    else if (res === "Repitió celo" && fd) { await tx.heatRepeat.create({ data: { tenantId: org, sowId: c.id, serviceEventId: x.id, repeatDate: fd, cause: s.metodo_diagnostico ?? "Repetición de celo" } }); mas("repeticiones"); }
    else if (res === "Aborto") {
      // La planilla tenía una ecografía de preñez: se conserva; la fecha del aborto queda a confirmar
      if (fd) { await tx.pregnancyCheck.create({ data: { tenantId: org, sowId: c.id, serviceEventId: x.id, checkDate: fd, method: metodo, result: "PREGNANT", notes: `${s.metodo_diagnostico} (antes del aborto)` } }); mas("diagnosticos"); }
      const siguiente = (d.servicios as J[]).filter(z => String(z.cerda) === String(s.cerda) && z.fecha_servicio > s.fecha_servicio).sort((a, b) => a.fecha_servicio.localeCompare(b.fecha_servicio))[0];
      await tx.abortionEvent.create({ data: { tenantId: org, sowId: c.id, serviceEventId: x.id, abortionDate: siguiente ? D(siguiente.fecha_servicio) : fd ?? f,
        cause: "A CONFIRMAR: fecha del aborto entre el 19/09 y el 06/10/2026 (informado por el titular el 12/11). Se registra a la fecha del nuevo servicio.", vetDiagnosis: s.nota } });
      mas("abortos");
    } else if (res === "Repitió celo o aborto (a confirmar)") {
      const siguiente = (d.servicios as J[]).filter(z => String(z.cerda) === String(s.cerda) && z.fecha_servicio > s.fecha_servicio).sort((a, b) => a.fecha_servicio.localeCompare(b.fecha_servicio))[0];
      await tx.heatRepeat.create({ data: { tenantId: org, sowId: c.id, serviceEventId: x.id, repeatDate: siguiente ? D(siguiente.fecha_servicio) : fd ?? f,
        cause: `A CONFIRMAR: repitió celo o abortó. La planilla decía «Preñada» por observación de celo${s.fecha_diagnostico ? ` el ${s.fecha_diagnostico}` : ""} y se volvió a servir${siguiente ? ` el ${siguiente.fecha_servicio} (${siguiente.codigo})` : ""}.` } });
      mas("repeticiones");
    }
  }

  // ── Partos ──
  const parto = new Map<string, { id: string; fecha: Date; vivos: number; cerda: string; aCargo: number }>();
  for (const p of d.partos as J[]) {
    const s = servicio.get(p.servicio); if (!s) throw new Error(`${p.codigo}: no existe el servicio ${p.servicio}`);
    const f = D(p.fecha_parto), peso = p.peso_camada_kg ?? 0;
    const x = await tx.farrowingEvent.create({ data: {
      tenantId: org, sowId: cerdaDe(p.cerda).id, serviceEventId: s.id, farrowingType: p.tipo_parto === "Distócico" ? "DYSTOCIA" : "NORMAL", startDatetime: f,
      gestationDays: p.dias_gestacion ?? dias(s.fecha, f), bornAlive: p.nacidos_vivos, bornDead: p.nacidos_muertos, mummified: 0, totalBorn: p.nacidos_totales,
      totalLitterWeightKg: peso, avgPigletWeightKg: peso && p.nacidos_vivos ? Math.round((peso / p.nacidos_vivos) * 1000) / 1000 : null, employeeId: actor,
      notes: [p.codigo, p.reproductor ? `Reproductor ${p.reproductor}` : null, p.peso_estimado ? "Peso de camada estimado" : null, p.estado_camada === "Cerrada" ? "Camada cerrada" : null, p.observacion].filter(Boolean).join(" · "),
    } });
    parto.set(p.codigo, { id: x.id, fecha: f, vivos: p.nacidos_vivos, cerda: String(p.cerda), aCargo: p.lechones_a_cargo ?? p.nacidos_vivos }); mas("partos");
    await tx.animalEvent.create({ data: { tenantId: org, sowId: cerdaDe(p.cerda).id, eventType: "FARROWING", eventDate: f, description: `Parto ${p.codigo}: ${p.nacidos_vivos} vivos, ${p.nacidos_muertos} muertos${p.tipo_parto === "Distócico" ? " (distócico)" : ""}`, moduleSource: "MATERNIDAD", userId: actor, metadata: { farrowingId: x.id } } });
  }
  const partoDe = (c: string) => { const x = parto.get(c); if (!x) throw new Error(`No existe el parto ${c}`); return x; };

  // ── Adopciones (los lechones de la cerda 74 conservan su trazabilidad en la cerda que los recibió) ──
  for (const a of d.adopciones as J[]) {
    await tx.pigletMovement.create({ data: { tenantId: org, originId: partoDe(a.parto_dona).id, destinationId: partoDe(a.parto_recibe).id, movementDate: D(a.fecha), quantity: a.cantidad, employeeId: actor } }); mas("adopciones");
  }

  // ── Mortandad en lactancia (las de recría van con su lote; la de las cerdas, con su baja) ──
  for (const m of (d.mortandad as J[]).filter(x => x.categoria === "Lechón en lactancia")) {
    const p = partoDe(m.parto), f = D(m.fecha);
    await tx.pigletDeath.create({ data: { tenantId: org, farrowingId: p.id, deathDatetime: f, quantity: m.cantidad, ageAtDeathDays: m.edad_dias ?? dias(p.fecha, f), cause: CAUSA[m.causa ?? "Otra"] ?? "OTHER", employeeId: actor } });
    mas("muertesLactancia", m.cantidad);
  }
  // Lechones a cargo de una camada en una fecha (vivos + recibidos − donados − muertos hasta ese día)
  const aCargoEn = async (partoId: string, f: Date) => {
    const x = await tx.farrowingEvent.findUniqueOrThrow({ where: { id: partoId }, select: { bornAlive: true, deaths: { where: { deathDatetime: { lte: f } }, select: { quantity: true } }, movementsAsOrigin: { where: { movementDate: { lte: f } }, select: { quantity: true } }, movementsAsDestination: { where: { movementDate: { lte: f } }, select: { quantity: true } } } });
    return stockCamada(x);
  };

  // ── Lotes del galpón y destetes ──
  const lote = new Map<string, { id: string; fecha: Date }>();
  for (const l of d.lotes_lechones as J[]) {
    const stock = l.stock_hoy_estimado ?? 0;
    const x = await tx.nurseryBatch.create({ data: { tenantId: org, batchCode: l.lote, phase: "PHASE_1", entryDate: D(l.fecha_destete), currentCount: stock, isActive: stock > 0 } });
    lote.set(l.lote, { id: x.id, fecha: D(l.fecha_destete) }); mas("lotes");
  }
  for (const w of d.destetes as J[]) {
    const p = partoDe(w.parto), f = D(w.fecha_destete), l = lote.get(w.lote); if (!l) throw new Error(`Destete de ${w.parto}: no existe el lote ${w.lote}`);
    const disponibles = await aCargoEn(p.id, f);
    const cc = String(w.condicion_corporal ?? "").match(/^(\d)/)?.[1];
    await tx.weaningEvent.create({ data: {
      tenantId: org, farrowingId: p.id, weaningDate: f, lactationDays: w.dias_lactancia ?? dias(p.fecha, f), pigletsAvailable: Math.max(0, disponibles), pigletsWeaned: w.destetados,
      totalLitterWeightKg: w.peso_total_kg ?? 0, avgPigletWeightKg: w.peso_total_kg && w.destetados ? Math.round((w.peso_total_kg / w.destetados) * 1000) / 1000 : 0,
      nurseryBatchId: l.id, sowDestination: "GESTATION", bodyConditionScore: cc ? (`SCORE_${cc}` as BodyConditionScore) : null, employeeId: actor,
      notes: [`Lote ${w.lote}`, disponibles !== w.destetados ? `A cargo ${disponibles}, destetados ${w.destetados}: ${disponibles - w.destetados} sin registrar` : null, w.observacion].filter(Boolean).join(" · "),
    } });
    await tx.animalEvent.create({ data: { tenantId: org, sowId: cerdaDe(p.cerda).id, eventType: "WEANING", eventDate: f, description: `Destete de ${w.destetados} lechones al lote ${w.lote}`, moduleSource: "MATERNIDAD", userId: actor } });
    mas("destetes"); mas("destetados", w.destetados);
  }
  // Lote de destino de cada camada (para muertes en recría y vacunas de lechones)
  const loteDeParto = new Map<string, string>((d.destetes as J[]).map(w => [w.parto, w.lote]));

  // ── Mortandad en recría ──
  for (const m of (d.mortandad as J[]).filter(x => x.categoria === "Lechón en recría")) {
    const codigo = m.lote ?? (m.parto ? loteDeParto.get(m.parto) : null); const l = codigo ? lote.get(codigo) : null;
    if (!l) throw new Error(`Muerte en recría n.º ${m.numero}: no se sabe de qué lote es`);
    await tx.animalEvent.create({ data: { tenantId: org, eventType: "DEATH", eventDate: D(m.fecha), moduleSource: "RECRIA", userId: actor,
      description: `Muerte en lote ${codigo}: ${m.cantidad} animal${m.cantidad > 1 ? "es" : ""} — ${m.causa ?? "sin causa registrada"}`,
      metadata: { batchId: l.id, batchCode: codigo, quantity: m.cantidad, cause: CAUSA[m.causa ?? "Otra"] ?? "OTHER", ageAtDeath: m.edad_dias, notes: m.observacion ?? (m.causa ? null : "Falta la causa"), numero: m.numero } } });
    mas("muertesRecria", m.cantidad);
  }

  // ── Salidas: una por lote de origen; se enlazan a la venta de Finanzas por remito (no se crea otro ingreso) ──
  for (const s of d.salidas as J[]) {
    for (const parte of s.lotes as J[]) {
      const l = lote.get(parte.lote); if (!l) throw new Error(`${s.codigo}: no existe el lote ${parte.lote}`);
      const prop = parte.cantidad / s.cantidad;
      const kg = s.kg_total ? Math.round(s.kg_total * prop * 1000) / 1000 : 0;
      await tx.batchSale.create({ data: { tenantId: org, nurseryBatchId: l.id, saleDate: D(s.fecha), animalCount: parte.cantidad, totalWeightKg: kg, pricePerKg: s.precio_por_kg ?? 0,
        totalAmount: Math.round(s.importe_gs * prop), buyerName: s.cliente, transferGuide: s.remito ?? `${s.codigo} · sin remito (a confirmar)`, employeeId: actor } });
      mas("salidas"); mas("vendidos", parte.cantidad);
    }
    if (s.remito) {
      const v = await tx.venta.findFirst({ where: { organizacionId: org, remitoFactura: s.remito, estado: "CONFIRMADA" } });
      if (v) { await tx.venta.update({ where: { id: v.id }, data: { loteDesteteId: lote.get(s.lotes[0].lote)!.id } }); mas("ventasEnlazadas"); }
    } else mas("salidasSinVentaEnFinanzas");
  }

  // ── Sanidad: productos, protocolo, carnet y todo el calendario ──
  const producto = new Map<string, string>();
  for (const p of d.productos_sanitarios as J[]) {
    const prev = await tx.productoInventario.findFirst({ where: { tenantId: org, nombre: p.producto } });
    const datos = { enfermedad: p.objetivo ?? "—", sectorDestino: p.se_usa_en === "Lechones" ? "lechon" : "cerda", categoria: CATEGORIA[p.tipo] ?? "VACUNA", viaAplicacion: p.via ?? "IM",
      observaciones: [p.laboratorio ? `Laboratorio: ${p.laboratorio}` : null, p.conservacion ? `Conservación: ${p.conservacion}` : null, p.presentacion_ml ? `Presentación: ${p.presentacion_ml} ml` : "Presentación (ml por frasco) sin cargar"].filter(Boolean).join(" · "),
      isActive: p.en_uso !== "NO" };
    const x = prev ? await tx.productoInventario.update({ where: { id: prev.id }, data: datos }) : await tx.productoInventario.create({ data: { tenantId: org, nombre: p.producto, unidadMedida: "ML", ...datos } });
    producto.set(p.producto, x.id); mas("productos");
  }
  const disparadorDe = (ref: string) => (ref === "Servicio" ? "servicio" : "parto");
  const protos = new Map<string, string>();
  for (const [cat, nombre, fase, tipoAnimal] of [["Cerdas", "Calendario de cerdas", "gestacion", "cerda"], ["Lechones", "Calendario de lechones", "maternidad", "lechon"]] as const) {
    protos.set(cat, (await tx.protocoloSanitario.create({ data: { tenantId: org, nombre, fase, tipoAnimal, descripcion: "Protocolo KUR-SAN-PRO-01, importado del paquete de la planilla de Sanidad" } })).id);
  }
  const item = new Map<string, string>(); // `${categoria}|${aplicacion}|${producto}` → protocoloItem
  for (const p of d.protocolo_sanitario as J[]) {
    for (const [pn, ml] of [[p.producto_1, p.ml_producto_1], [p.producto_2, p.ml_producto_2]] as [string | null, number | null][]) {
      if (!pn) continue; const vac = producto.get(pn); if (!vac) throw new Error(`Protocolo «${p.aplicacion}»: el producto ${pn} no está en la lista`);
      const it = await tx.protocoloItem.create({ data: { tenantId: org, protocoloId: protos.get(p.categoria)!, vacunaId: vac, diaCiclo: p.dia, disparador: disparadorDe(p.referencia), esObligatorio: true, descripcion: `${p.aplicacion}${ml ? ` · ${ml} ml` : ""}${p.objetivo ? ` · ${p.objetivo}` : ""}` } });
      item.set(`${p.categoria}|${p.aplicacion}|${pn}`, it.id); mas("protocoloItems");
      if (p.categoria === "Cerdas") {
        const info = (d.productos_sanitarios as J[]).find(x => x.producto === pn) ?? {};
        await tx.configVacuna.create({ data: {
          tenantId: org, modulo: p.referencia === "Servicio" ? "GESTACION" : "MATERNIDAD", nombreVacuna: p.aplicacion === pn ? pn : `${p.aplicacion} — ${pn}`, marcaComercial: pn,
          laboratorio: info.laboratorio ?? "—", principioActivo: "—", enfermedadObjetivo: info.objetivo ?? p.objetivo ?? "—", viaAplicacion: String(p.via ?? "IM").toUpperCase(), dosisMl: ml ?? 2,
          momentoAplicacion: p.referencia === "Servicio" ? `Día ${p.dia} desde el servicio` : `Día ${p.dia} posparto`, paisProcedencia: "—", tempConservacion: info.conservacion ?? "Heladera 2 a 8 °C",
          obligatoria: false, paridad: "AMBAS", diaGestacion: p.referencia === "Servicio" ? p.dia : null, ordenDosis: /2ª/.test(p.aplicacion) ? 2 : 1,
          grupoMezclaId: p.producto_2 ? p.aplicacion : null, sujeto: p.referencia === "Parto" ? "HEMBRA" : null, diaReferencia: p.referencia === "Parto" ? p.dia : null,
        } });
      }
    }
  }

  const loteStock = new Map<string, number>((d.lotes_lechones as J[]).map(l => [l.lote, l.stock_hoy_estimado ?? 0]));
  for (const a of d.aplicaciones_sanitarias as J[]) {
    mas("calendario");
    if (a.clasificacion === "NO CORRESPONDE" || a.estado === "ANULADA" || a.estado === "NO CORRESPONDE") { mas("noCorresponde"); continue; }
    const esCerda = a.tipo_animal === "Cerda";
    const c = a.cerda ? cerda.get(String(a.cerda)) : null;
    if (esCerda && c && !c.activa && a.estado !== "APLICADA") { mas("noCorresponde"); continue; } // regla 3: una baja sale del calendario
    const pt = a.parto ? parto.get(a.parto) : null;
    const loteCod = !esCerda && /^L-\d{4}/.test(a.ubicacion_lechones ?? "") ? String(a.ubicacion_lechones).match(/^L-\d{4}/)![0] : null;
    const l = loteCod ? lote.get(loteCod) : null;
    const fechaProg = D(a.fecha_programada), aplicada = a.estado === "APLICADA";
    const fechaReal = aplicada ? D(a.fecha_real ?? a.fecha_programada) : null;
    const pendiente = ["PRÓXIMA", "PROGRAMADA"].includes(a.estado) || (a.estado === "NO APLICADA" && ["APLICAR YA", "ATRASADA"].includes(a.clasificacion));
    const perdida = a.clasificacion === "PERDIDA";
    const urgente = a.clasificacion === "APLICAR YA" || a.clasificacion === "ATRASADA";
    const animales = a.animales_hoy ?? (loteCod ? loteStock.get(loteCod) : null) ?? 1;
    const etiqueta = esCerda ? `Cerda ${a.cerda}` : l ? `Lechones · lote ${loteCod} (camada ${a.cerda})` : `Lechones · camada ${a.cerda}`;
    const sector = esCerda ? (a.referencia === "Servicio" ? "gestacion" : "maternidad") : l ? "iniciacion" : "maternidad";
    if (aplicada) mas("aplicadas");
    if (perdida) mas("perdidas");

    if (!(a.productos as J[]).length) {
      // Manejo sin producto: se registra como tarea (hecha, pendiente o urgente); la perdida no genera tarea
      if (perdida) continue;
      await tx.task.create({ data: {
        tenantId: org, tipo: "manejo-sanitario", sector, alcance: esCerda ? "animal" : l ? "lote" : "camada", titulo: `${a.aplicacion} · ${etiqueta}`,
        descripcion: [a.motivo, `Programada el ${a.fecha_programada}`, a.fecha_real_estimada ? "Hecha según la planilla, sin fecha real: se tomó la programada" : null].filter(Boolean).join(" · "),
        prioridad: urgente ? "urgente" : "programada", fechaVencimiento: urgente ? D(a.vence_ventana ?? a.fecha_programada) : fechaProg, fechaCompletada: aplicada ? fechaReal : null,
        animalId: esCerda ? c?.id : null, farrowingId: !esCerda && !l ? pt?.id : null, nurseryBatchId: l?.id ?? null, targetLabel: etiqueta,
        responsableNombre: "Jefatura de Sanidad", generadaPor: "sistema", disparador: `${MARCA}-${a.id}`,
      } });
      mas(aplicada ? "manejosHechos" : "manejosPendientes");
      continue;
    }
    for (const prod of a.productos as J[]) {
      const vac = producto.get(prod.producto); if (!vac) throw new Error(`${a.id}: el producto ${prod.producto} no está en la lista`);
      const cat = esCerda ? "Cerdas" : "Lechones";
      const ev = await tx.eventoVacunacion.create({ data: {
        tenantId: org, protocoloItemId: item.get(`${cat}|${a.aplicacion}|${prod.producto}`) ?? null, vacunaId: vac, sector, fecha: fechaProg,
        animalId: esCerda ? c?.id ?? null : null, farrowingId: (esCerda && a.referencia === "Parto") || (!esCerda && !l) ? pt?.id ?? null : null, nurseryBatchId: l?.id ?? null,
        targetLabel: etiqueta, dosisNecesarias: animales, estado: aplicada ? "aplicado" : perdida ? "omitido" : urgente ? "retrasado" : "pendiente",
        disparador: `${MARCA}-${a.id}-${prod.producto}`, sectorAlAplicar: aplicada ? sector : null,
      } });
      mas("eventosVacuna");
      if (aplicada && fechaReal) {
        await tx.aplicacionVacuna.create({ data: { tenantId: org, eventoId: ev.id, vacunaId: vac, dosisAplicadas: animales, fechaAplicacion: fechaReal, responsable: "Planilla de Sanidad",
          observaciones: [a.fecha_real_estimada ? "Marcada como aplicada sin fecha real: se tomó la fecha programada" : null, prod.ml_por_animal ? `${prod.ml_por_animal} ml por animal` : null].filter(Boolean).join(" · ") || null } });
        if (esCerda && c) await tx.animalEvent.create({ data: { tenantId: org, sowId: c.id, eventType: "VACCINATION", eventDate: fechaReal, moduleSource: "SANIDAD", userId: actor,
          metadata: { nombreVacuna: prod.producto, aplicacion: a.aplicacion, responsable: "Planilla de Sanidad", ml: prod.ml_por_animal, estimada: !!a.fecha_real_estimada } } });
      }
    }
    if (urgente && pendiente) {
      await tx.task.create({ data: {
        tenantId: org, tipo: "vacuna-atrasada", sector, alcance: esCerda ? "animal" : l ? "lote" : "camada",
        titulo: `${a.clasificacion === "APLICAR YA" ? "Aplicar ya" : "Atrasada"}: ${a.aplicacion} · ${etiqueta}`,
        descripcion: `${a.motivo ?? ""} Programada el ${a.fecha_programada}. ${(a.productos as J[]).map(p => `${p.producto} ${p.ml_por_animal} ml`).join(" + ")} × ${animales}.`.trim(),
        instrucciones: a.clasificacion === "ATRASADA" ? "Aplicación vencida: decide el veterinario si se aplica tarde." : `Aplicar antes del ${a.vence_ventana ?? "fin de la ventana"}.`,
        prioridad: "urgente", fechaVencimiento: D(a.vence_ventana ?? a.fecha_programada),
        animalId: esCerda ? c?.id : null, farrowingId: !esCerda && !l ? pt?.id : null, nurseryBatchId: l?.id ?? null, targetLabel: etiqueta,
        responsableNombre: "Jefatura de Sanidad", generadaPor: "sistema", disparador: `${MARCA}-${a.id}-tarea`,
      } });
      mas("tareasVacunas");
    }
  }

  // ── Correcciones pendientes: tareas de revisión (no se corrigen datos por cuenta propia) ──
  const PRIORIDAD: Record<string, string> = { Alta: "urgente", Media: "hoy", Baja: "programada" };
  for (const [i, k] of (d.correcciones_pendientes as J[]).entries()) {
    const sector = /PARTOS|MORTANDAD/.test(k.registro) ? "maternidad" : /SALIDAS|DESTETES/.test(k.registro) ? "iniciacion" : /SANIDAD|PARAMETROS/.test(k.registro) ? "granja" : "gestacion";
    await tx.task.create({ data: {
      tenantId: org, tipo: "revision-datos", sector, alcance: "granja", titulo: `Revisar (${k.prioridad}): ${k.registro}`, descripcion: k.problema, instrucciones: k.accion,
      prioridad: PRIORIDAD[k.prioridad] ?? "programada", fechaVencimiento: D(d.meta.fecha_corte_produccion), responsableNombre: k.tipo === "Sanidad" ? "Jefatura de Sanidad" : "Jefatura de Producción",
      generadaPor: "sistema", disparador: `${MARCA}-correccion-${i + 1}`,
    } });
    mas("tareasRevision");
  }
  return r;
}

/** Totales de control (sección 6 del LEEME) calculados desde lo cargado. */
async function control(tx: Tx, org: string, d: J, r: Record<string, number>) {
  const [cerdas, activas, servicios, partos, sumas, lact, destetes, lotes, ventas] = await Promise.all([
    tx.sow.count({ where: { tenantId: org } }), tx.sow.count({ where: { tenantId: org, isActive: true } }),
    tx.serviceEvent.count({ where: { tenantId: org } }), tx.farrowingEvent.count({ where: { tenantId: org } }),
    tx.farrowingEvent.aggregate({ where: { tenantId: org }, _sum: { totalBorn: true, bornAlive: true, bornDead: true } }),
    tx.pigletDeath.aggregate({ where: { tenantId: org }, _sum: { quantity: true } }),
    tx.weaningEvent.aggregate({ where: { tenantId: org }, _sum: { pigletsWeaned: true } }),
    tx.nurseryBatch.findMany({ where: { tenantId: org }, select: { currentCount: true } }),
    tx.batchSale.aggregate({ where: { tenantId: org }, _sum: { animalCount: true, totalAmount: true } }),
  ]);
  // En maternidad: camadas sin destetar, con la cerda activa y con lechones a cargo
  const abiertas = await tx.farrowingEvent.findMany({ where: { tenantId: org, weaning: null, sow: { isActive: true } }, select: { bornAlive: true, deaths: { select: { quantity: true } }, movementsAsOrigin: { select: { quantity: true } }, movementsAsDestination: { select: { quantity: true } } } });
  const maternidad = abiertas.map(stockCamada).filter(x => x > 0).reduce((s, x) => s + x, 0);
  const galpon = lotes.reduce((s, l) => s + l.currentCount, 0);
  const k = d.control;
  const filas: [string, number, number][] = [
    ["Cerdas cargadas", cerdas, k.cerdas_cargadas], ["Cerdas activas", activas, k.cerdas_activas], ["Cerdas de baja", cerdas - activas, k.cerdas_baja],
    ["Servicios", servicios, k.servicios], ["Partos", partos, k.partos],
    ["Nacidos totales", sumas._sum.totalBorn ?? 0, k.nacidos_totales], ["Nacidos vivos", sumas._sum.bornAlive ?? 0, k.nacidos_vivos], ["Nacidos muertos", sumas._sum.bornDead ?? 0, k.nacidos_muertos],
    ["Destetados", destetes._sum.pigletsWeaned ?? 0, k.destetados], ["Muertos en lactancia", lact._sum.quantity ?? 0, k.muertos_lactancia], ["Muertos en recría", r.muertesRecria ?? 0, k.muertos_recria],
    ["Lechones vendidos", ventas._sum.animalCount ?? 0, k.lechones_vendidos], ["Importe de ventas (Gs)", Number(ventas._sum.totalAmount ?? 0), k.importe_ventas_gs],
    ["Lechones en maternidad", maternidad, k.lechones_en_maternidad], ["Lechones en el galpón", galpon, k.lechones_en_galpon], ["Lechones en la granja", maternidad + galpon, k.lechones_en_granja],
    ["Aplicaciones del calendario", r.calendario ?? 0, (d.aplicaciones_sanitarias as J[]).length], ["Aplicadas", r.aplicadas ?? 0, 247],
  ];
  const sinRegistrar = (sumas._sum.totalBorn ?? 0) - (sumas._sum.bornDead ?? 0) - (lact._sum.quantity ?? 0) - (r.muertesRecria ?? 0) - (ventas._sum.animalCount ?? 0) - galpon - maternidad;
  filas.push(["Lechones sin registrar (cuadre)", sinRegistrar, k.lechones_sin_registrar]);
  console.log("\nTotales de control (sección 6 del LEEME):");
  for (const [n, v, e] of filas) console.log(`  ${v === e ? "✓" : "✗"} ${n.padEnd(32)} ${String(v).padStart(10)}   esperado ${e}`);
  return filas.every(([, v, e]) => v === e);
}

async function main() {
  const ruta = process.env.DATOS, org = process.env.ORG ?? "", email = (process.env.PROPIETARIO ?? "").toLowerCase();
  const escribir = process.env.ESCRIBIR === "SI";
  if (!ruta || !org || !email) throw new Error("Faltan DATOS, ORG y PROPIETARIO");
  const d = JSON.parse(readFileSync(ruta, "utf8")) as J;
  const t = await prisma.tenant.findUnique({ where: { id: org }, select: { farmName: true } });
  if (!t) throw new Error("No existe la organización");
  const u = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!u) throw new Error("No existe el usuario propietario");
  console.log(`${escribir ? "ESCRIBIENDO" : "EN SECO (no se escribe nada)"} · paquete del ${d.meta.generado} en «${t.farmName}»`);
  let resultado = "";
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`select set_config('app.actor_id', ${u.id}, true)`;
      const borrado = await borrar(tx, org);
      console.log("\nSe borra (datos productivos y sanitarios anteriores):\n  " + Object.entries(borrado).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(" · "));
      const r = await importar(tx, org, u.id, d);
      console.log("\nSe carga:\n  " + Object.entries(r).map(([k, v]) => `${k} ${v}`).join(" · "));
      const ok = await control(tx, org, d, r);
      const hallazgos = await auditarGranja(tx, org, D(d.meta.fecha_corte_produccion));
      const errores = hallazgos.filter(x => x.severidad === "ERROR"), avisos = hallazgos.filter(x => x.severidad === "AVISO");
      console.log(`\nAuditoría de consistencia: ${errores.length} errores · ${avisos.length} avisos (datos de la planilla a corregir, ya están en las tareas de revisión)`);
      for (const x of errores) console.log(`  ✗ ${x.regla}: ${x.detalle}`);
      for (const x of avisos) console.log(`  · ${x.regla}: ${x.detalle}`);
      if (!ok || errores.length) { resultado = "Los totales o la auditoría no cierran: no se escribió nada."; throw new Deshacer(); }
      if (!escribir) { resultado = "Corrida en seco OK: todo cierra. No se escribió nada. Para escribir: ESCRIBIR=SI."; throw new Deshacer(); }
      resultado = "Importación escrita y verificada.";
    }, { timeout: 900_000, maxWait: 20_000 });
  } catch (e) {
    if (!(e instanceof Deshacer)) throw e;
  }
  console.log(`\n${resultado}`);
  if (!resultado.startsWith("Importación") && !resultado.startsWith("Corrida")) process.exitCode = 1;
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
