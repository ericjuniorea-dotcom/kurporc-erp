"use server";
// Transferencias de animales entre módulos, siempre con aceptación del módulo que recibe.
// · Compras: Finanzas registra el gasto y los animales quedan «en camino» al módulo elegido; al recibirlos se crean
//   las reproductoras, los reproductores o el lote de lechones (con granja de origen, caravanas y pesos).
// · Internas: Gestación → Maternidad (orden automática N días antes del parto), destete → Iniciación y la
//   reproductora → Gestación, Iniciación → Engorde. Cualquiera con permiso en el módulo envía o recibe.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { getPermisos, puede, requirePermiso, ErrorPermiso, type Permisos } from "@/lib/permisos/servidor";
import { getSession } from "@/lib/auth/config";
import { crearMovimiento } from "@/app/acciones/finanzas";
import { generarOrdenesMaternidad, transferenciasDeModulo } from "@/lib/transferencias/servidor";
import { CATEGORIAS, DESTINOS_COMPRA, DESTINOS_DE_PANTALLA, MODULOS_TRANSFERENCIA, PERMISOS_MODULO, type ModuloTransferencia } from "@/lib/transferencias/tipos";
import { generarTareasNurseryBatch } from "@/lib/tasks/generate";
import { generarEventosNursery } from "@/lib/sanidad/generate-eventos";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };
function manejar(e: unknown): { ok: false; error: string } {
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "Ya existe un animal o lote con ese código." };
  console.error("[transferencias]", e);
  return { ok: false, error: "No se pudo completar. Probá de nuevo." };
}
const puedeEn = (p: Permisos, m: ModuloTransferencia) => m !== "COMPRA" && PERMISOS_MODULO[m].some(c => puede(p, c));
async function contexto() {
  const session = await getSession();
  const permisos = await getPermisos();
  if (!session || !permisos) throw new Error("•Tu sesión se cerró. Ingresá de nuevo.");
  return { session, permisos, org: permisos.organizacionId };
}
const refrescar = () => { for (const p of ["/gestacion", "/maternidad", "/recria", "/engorde", "/plantel", "/dashboard", "/finanzas/compra-animales"]) revalidatePath(p); };
const hoyISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(new Date());

/* ─── Panel de cada módulo ───────────────────────────────────── */
export async function panelTransferencias(pantalla: keyof typeof DESTINOS_DE_PANTALLA) {
  const { permisos, org } = await contexto();
  if (pantalla === "GESTACION" || pantalla === "MATERNIDAD") await generarOrdenesMaternidad(org).catch(e => console.error("[ordenes-maternidad]", e));
  const filas = await transferenciasDeModulo(org, pantalla, DESTINOS_DE_PANTALLA[pantalla]);
  return {
    filas,
    puedeEnviar: puedeEn(permisos, pantalla),
    puedeRecibir: DESTINOS_DE_PANTALLA[pantalla].some(d => puedeEn(permisos, d)),
  };
}

/** El módulo de origen confirma que el animal salió (orden → en camino). */
export async function enviarTransferencia(id: string, nota?: string): Promise<R> {
  try {
    const { session, permisos, org } = await contexto();
    const t = await prisma.transferenciaAnimal.findFirst({ where: { id, tenantId: org } });
    if (!t) throw new Error("•Esa transferencia no existe.");
    if (t.estado !== "ORDEN") throw new Error("•Esa transferencia ya fue enviada o resuelta.");
    if (!puedeEn(permisos, t.origen as ModuloTransferencia)) throw new Error(`•No tenés permiso en ${MODULOS_TRANSFERENCIA[t.origen as ModuloTransferencia]?.etiqueta ?? t.origen}.`);
    await prisma.transferenciaAnimal.update({ where: { id }, data: { estado: "EN_CAMINO", enviadaPor: session.user.id, enviadaEn: new Date(), nota: nota?.trim() || t.nota } });
    refrescar();
    return { ok: true };
  } catch (e) { return manejar(e); }
}

const recibirSchema = z.object({
  id: z.string().uuid(),
  cantidadRecibida: z.number().int().min(1, "¿Cuántos llegaron?").max(100000),
  pesoRecibidoKg: z.number().min(0).max(1_000_000).nullable().default(null),
  ubicacion: z.string().trim().max(120).optional().default(""),
  nota: z.string().trim().max(400).optional().default(""),
});

/** El módulo de destino acepta: recién acá los animales entran a su módulo (se crean o cambian de lugar). */
export async function recibirTransferencia(datos: z.input<typeof recibirSchema>): Promise<R> {
  try {
    const { session, permisos, org } = await contexto();
    const d = recibirSchema.parse(datos);
    const t = await prisma.transferenciaAnimal.findFirst({ where: { id: d.id, tenantId: org } });
    if (!t) throw new Error("•Esa transferencia no existe.");
    if (t.estado !== "EN_CAMINO" && !(t.estado === "ORDEN" && puedeEn(permisos, t.origen as ModuloTransferencia))) throw new Error("•Esa transferencia ya fue resuelta o todavía no la enviaron.");
    const destino = t.destino as ModuloTransferencia;
    if (!puedeEn(permisos, destino)) throw new Error(`•No tenés permiso para recibir en ${MODULOS_TRANSFERENCIA[destino]?.etiqueta ?? destino}.`);
    if (d.cantidadRecibida > t.cantidad) throw new Error(`•Llegaron más (${d.cantidadRecibida}) de los que se enviaron (${t.cantidad}). Revisalo con quien los envió.`);
    const usuario = session.user.id;
    const ubic = d.ubicacion || t.ubicacion || "";
    const diferencia = d.cantidadRecibida < t.cantidad ? `Se enviaron ${t.cantidad} y llegaron ${d.cantidadRecibida}.` : "";
    const nota = [diferencia, d.nota].filter(Boolean).join(" ") || null;
    const animales = (t.animales ?? []) as { caravana: string; sexo?: string; pesoKg?: number | null; genetica?: string; nacimiento?: string }[];
    let resultado: Prisma.InputJsonValue = {};
    let nursery: { id: string; code: string; fecha: Date; n: number } | null = null;

    await conActor(usuario, async tx => {
      if (t.origen === "COMPRA" && t.categoria === "REPRODUCTORAS") {
        // Una reproductora por caravana (las que no llegaron se sacan de la lista)
        const llegan = animales.slice(0, d.cantidadRecibida);
        const ult = await tx.sow.findFirst({ where: { tenantId: org, erpCode: { startsWith: "HEM-GRN-" } }, orderBy: { createdAt: "desc" }, select: { erpCode: true } });
        let n = Number(ult?.erpCode?.match(/HEM-GRN-(\d+)/)?.[1] ?? 0);
        const ids: string[] = [];
        for (const a of llegan) {
          n++;
          const erpCode = `HEM-GRN-${String(n).padStart(4, "0")}`;
          const nac = a.nacimiento ? new Date(`${a.nacimiento}T00:00:00Z`) : null;
          const edad = nac ? (Date.now() - nac.getTime()) / 86_400_000 : 0;
          const estado = destino === "CUARENTENA" ? "QUARANTINE" : (Number(a.pesoKg ?? 0) >= 130 && edad >= 210 ? "REPLACEMENT_READY" : "REPLACEMENT_DEVELOPING");
          const s = await tx.sow.create({ data: {
            tenantId: org, identCode: a.caravana || erpCode, caravanaCode: a.caravana || null, erpCode, geneticLine: a.genetica || null, birthDate: nac,
            entryWeightKg: a.pesoKg ?? null, sourceProvider: t.proveedor, purchasePriceGs: t.costoTotalGs ? Number(t.costoTotalGs) / Math.max(1, t.cantidad) : null,
            galponAssigned: ubic || null, plantelState: estado,
            animalEvents: { create: { tenantId: org, eventType: "ENTRY", eventDate: new Date(), newState: estado, moduleSource: "PLANTEL", userId: usuario,
              description: `Compra a ${t.proveedor ?? "otra granja"} · recibida en ${MODULOS_TRANSFERENCIA[destino].etiqueta}${ubic ? ` (${ubic})` : ""}` } },
          }, select: { id: true } });
          ids.push(s.id);
        }
        resultado = { reproductoras: ids };
      } else if (t.origen === "COMPRA" && t.categoria === "REPRODUCTORES") {
        const llegan = animales.slice(0, d.cantidadRecibida);
        const ult = await tx.boar.findFirst({ where: { tenantId: org, erpCode: { startsWith: "REP-GRN-" } }, orderBy: { createdAt: "desc" }, select: { erpCode: true } });
        let n = Number(ult?.erpCode?.match(/REP-GRN-(\d+)/)?.[1] ?? 0);
        const ids: string[] = [];
        for (const a of llegan) {
          n++;
          const erpCode = `REP-GRN-${String(n).padStart(4, "0")}`;
          const b = await tx.boar.create({ data: {
            tenantId: org, identCode: a.caravana || erpCode, caravanaCode: a.caravana || null, erpCode, geneticLine: a.genetica || null,
            birthDate: a.nacimiento ? new Date(`${a.nacimiento}T00:00:00Z`) : null, entryDate: new Date(), entryWeightKg: a.pesoKg ?? null,
            sourceProvider: t.proveedor, purchasePriceGs: t.costoTotalGs ? Number(t.costoTotalGs) / Math.max(1, t.cantidad) : null,
            galponAssigned: ubic || null, plantelState: destino === "CUARENTENA" ? "QUARANTINE" : "ACTIVE",
          }, select: { id: true } });
          ids.push(b.id);
        }
        resultado = { reproductores: ids };
      } else if (t.origen === "COMPRA" && t.categoria === "LECHONES" && destino === "INICIACION") {
        const fecha = new Date(`${hoyISO()}T00:00:00Z`);
        const peso = d.pesoRecibidoKg ?? (t.pesoTotalKg ? Number(t.pesoTotalKg) * d.cantidadRecibida / t.cantidad : null);
        const code = `CPR-${hoyISO().replace(/-/g, "")}-${t.id.slice(0, 4).toUpperCase()}`;
        const lote = await tx.nurseryBatch.create({ data: {
          tenantId: org, batchCode: code, phase: "PHASE_1", entryDate: fecha, currentCount: d.cantidadRecibida,
          currentWeightKg: peso, avgWeightKg: peso ? peso / d.cantidadRecibida : null,
        }, select: { id: true } });
        nursery = { id: lote.id, code, fecha, n: d.cantidadRecibida };
        resultado = { loteIniciacion: lote.id, codigo: code };
      } else if (t.origen === "COMPRA" && t.categoria === "LECHONES" && destino === "ENGORDE") {
        const peso = d.pesoRecibidoKg ?? (t.pesoTotalKg ? Number(t.pesoTotalKg) * d.cantidadRecibida / t.cantidad : 0);
        const code = `CPR-${hoyISO().replace(/-/g, "")}-${t.id.slice(0, 4).toUpperCase()}`;
        const lote = await tx.growingBatch.create({ data: {
          tenantId: org, batchCode: code, sitio: ubic || null, procedencia: "COMPRA_EXTERNA", entryDate: new Date(`${hoyISO()}T00:00:00Z`),
          currentCount: d.cantidadRecibida, entryWeightKg: peso, avgAgeAtEntryDays: t.edadDias, targetWeightKg: 120,
          costoIngresoGs: t.costoTotalGs, observations: `Compra a ${t.proveedor ?? "otra granja"}`, status: "ACTIVE", employeeId: usuario,
        }, select: { id: true } });
        resultado = { loteEngorde: lote.id, codigo: code };
      } else if (t.origen === "GESTACION" && destino === "MATERNIDAD" && t.sowId) {
        // La reproductora entra a la sala de partos: queda «en paridera» hasta que se registre el parto
        const s = await tx.sow.findFirst({ where: { id: t.sowId, tenantId: org }, select: { plantelState: true } });
        if (!s) throw new Error("•Esa reproductora ya no está en el plantel.");
        await tx.sow.update({ where: { id: t.sowId }, data: { plantelState: "FARROWING", ...(ubic ? { galponAssigned: ubic } : {}) } });
        await tx.animalEvent.create({ data: { tenantId: org, sowId: t.sowId, eventType: "STATE_CHANGE", eventDate: new Date(), previousState: s.plantelState, newState: "FARROWING",
          moduleSource: "MATERNIDAD", userId: usuario, description: `Recibida en Maternidad${ubic ? ` (${ubic})` : ""} desde Gestación` } });
      } else if (destino === "GESTACION" && t.sowId && ubic) {
        // Reproductora destetada que vuelve a Gestación: se anota dónde quedó
        await tx.sow.update({ where: { id: t.sowId }, data: { galponAssigned: ubic } });
      } else if (destino === "ENGORDE" && t.growingBatchId && ubic) {
        await tx.growingBatch.update({ where: { id: t.growingBatchId }, data: { sitio: ubic } });
      }
      await tx.transferenciaAnimal.update({ where: { id: t.id }, data: {
        estado: "RECIBIDA", cantidadRecibida: d.cantidadRecibida, pesoRecibidoKg: d.pesoRecibidoKg, ubicacion: ubic || null, nota,
        resueltaPor: usuario, resueltaEn: new Date(), resultado,
        ...(t.estado === "ORDEN" ? { enviadaPor: usuario, enviadaEn: new Date() } : {}),
      } });
    });
    // Lote de Iniciación comprado: mismas tareas y vacunas que un lote propio
    if (nursery) {
      const x = nursery as { id: string; code: string; fecha: Date; n: number };
      generarTareasNurseryBatch(org, x.id, x.code, x.fecha).catch(() => {});
      generarEventosNursery(org, x.id, x.code, x.fecha, x.n).catch(() => {});
    }
    refrescar();
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function rechazarTransferencia(id: string, motivo: string): Promise<R> {
  try {
    const { session, permisos, org } = await contexto();
    const texto = motivo.trim();
    if (texto.length < 3) throw new Error("•Contá por qué no la recibís.");
    const t = await prisma.transferenciaAnimal.findFirst({ where: { id, tenantId: org } });
    if (!t) throw new Error("•Esa transferencia no existe.");
    if (t.estado !== "EN_CAMINO" && t.estado !== "ORDEN") throw new Error("•Esa transferencia ya fue resuelta.");
    const modulo = (t.estado === "ORDEN" ? t.origen : t.destino) as ModuloTransferencia;
    if (!puedeEn(permisos, modulo)) throw new Error("•No tenés permiso en ese módulo.");
    await prisma.transferenciaAnimal.update({ where: { id }, data: { estado: "RECHAZADA", resueltaPor: session.user.id, resueltaEn: new Date(), nota: texto } });
    refrescar();
    return { ok: true };
  } catch (e) { return manejar(e); }
}

/* ─── Compra de animales (Finanzas) ──────────────────────────── */
const animal = z.object({
  caravana: z.string().trim().max(40).default(""),
  sexo: z.enum(["H", "M", ""]).optional().default(""),
  pesoKg: z.number().min(0).max(2000).nullable().optional().default(null),
  genetica: z.string().trim().max(60).optional().default(""),
  nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).default(""),
});
const compraSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  categoria: z.enum(["LECHONES", "REPRODUCTORAS", "REPRODUCTORES"]),
  // Reposición (reemplaza a una que sale) = gasto de Gestación; ampliación del plantel = inversión
  motivo: z.enum(["REPOSICION", "AMPLIACION"]).optional().default("REPOSICION"),
  destino: z.enum(["INICIACION", "ENGORDE", "GESTACION", "CUARENTENA", "PLANTEL"]),
  proveedor: z.string().trim().min(2, "Escribí de qué granja vienen").max(120),
  cantidad: z.number().int().min(1, "¿Cuántos animales compraste?").max(5000),
  pesoTotalKg: z.number().min(0).max(1_000_000).nullable().default(null),
  edadDias: z.number().int().min(0).max(2000).nullable().default(null),
  montoGs: z.string().trim().regex(/^\d{1,15}$/, "El monto va en guaraníes, sin puntos"),
  pagado: z.boolean(),
  medioPago: z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "DEBITO_AUTOMATICO", "TARJETA", "CREDITO_PROVEEDOR"]).nullable().default(null),
  cuentaFondosId: z.string().uuid().nullable().default(null),
  facturaNumero: z.string().trim().max(40).optional().default(""),
  ubicacion: z.string().trim().max(120).optional().default(""),
  observacion: z.string().trim().max(400).optional().default(""),
  animales: z.array(animal).max(5000).default([]),
});

export async function registrarCompraAnimales(datos: z.input<typeof compraSchema>): Promise<R<{ id: string; aviso?: string }>> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.movimientos.crear");
    const d = compraSchema.parse(datos);
    const org = permisos.organizacionId;
    if (!DESTINOS_COMPRA[d.categoria].includes(d.destino)) throw new Error("•Ese destino no corresponde a lo que compraste.");
    const conCaravana = d.animales.filter(a => a.caravana);
    if (d.categoria !== "LECHONES") {
      // Reproductoras y machos: uno por uno, con su caravana
      if (d.animales.length !== d.cantidad || conCaravana.length !== d.cantidad) throw new Error(`•Cargá la caravana de cada uno de los ${d.cantidad} animales.`);
    }
    const caravanas = conCaravana.map(a => a.caravana.toUpperCase());
    if (new Set(caravanas).size !== caravanas.length) throw new Error("•Hay caravanas repetidas en la lista.");
    if (d.categoria !== "LECHONES" && caravanas.length) {
      const modelo = d.categoria === "REPRODUCTORAS" ? prisma.sow : prisma.boar;
      const existentes = await (modelo as typeof prisma.sow).findMany({ where: { tenantId: org, OR: [{ caravanaCode: { in: conCaravana.map(a => a.caravana), mode: "insensitive" } }, { identCode: { in: conCaravana.map(a => a.caravana), mode: "insensitive" } }] }, select: { identCode: true, caravanaCode: true } });
      if (existentes.length) throw new Error(`•Ya hay animales con esa caravana en tu plantel: ${existentes.map(e => e.caravanaCode || e.identCode).slice(0, 5).join(", ")}.`);
    }
    const nombreCat = d.categoria === "LECHONES" ? "Compra de lechones para engorde" : d.motivo === "REPOSICION" ? "Reposición de reproductoras" : "Matrices y reproductores";
    const cat = await prisma.categoriaFinanciera.findFirst({ where: { nombre: nombreCat, OR: [{ organizacionId: null }, { organizacionId: org }] }, select: { id: true, tipo: true } });
    if (!cat) throw new Error(`•Falta la categoría «${nombreCat}» en Finanzas.`);

    const unidades = CATEGORIAS[d.categoria].unidad;
    const mov = await crearMovimiento({
      fecha: d.fecha, tipo: cat.tipo as "GASTO" | "INVERSION", concepto: `Compra de ${d.cantidad} ${unidades} · ${d.proveedor}`, categoriaId: cat.id,
      cantidad: String(d.cantidad), unidadMedida: "cabezas", contraparte: d.proveedor, medioPago: d.medioPago, cuentaFondosId: d.cuentaFondosId,
      montoGs: d.montoGs, pagado: d.pagado, fechaPago: d.fecha, facturaNumero: d.facturaNumero, observacion: d.observacion,
    });
    if (!mov.ok) return mov;

    const t = await prisma.transferenciaAnimal.create({ data: {
      tenantId: org, origen: "COMPRA", destino: d.destino, categoria: d.categoria, estado: "EN_CAMINO",
      motivo: `Compra de ${d.cantidad} ${unidades} a ${d.proveedor}`, cantidad: d.cantidad,
      pesoTotalKg: d.pesoTotalKg, edadDias: d.edadDias, proveedor: d.proveedor, movimientoId: mov.id, costoTotalGs: BigInt(d.montoGs),
      animales: d.animales.length ? d.animales : undefined, ubicacion: d.ubicacion || null, creadaPor: session.user.id,
      enviadaPor: session.user.id, enviadaEn: new Date(),
    }, select: { id: true } });
    refrescar();
    return { ok: true, id: t.id, aviso: mov.aviso };
  } catch (e) { return manejar(e); }
}

/** Compras de animales para la pantalla de Finanzas: en qué quedó cada una (recibida, por recibir, rechazada). */
export async function comprasAnimales() {
  const { permisos } = await requirePermiso("finanzas.movimientos.ver");
  const filas = await prisma.transferenciaAnimal.findMany({ where: { tenantId: permisos.organizacionId, origen: "COMPRA" }, orderBy: { createdAt: "desc" }, take: 100 });
  const ids = Array.from(new Set(filas.flatMap(f => [f.creadaPor, f.resueltaPor]).filter((x): x is string => !!x)));
  const nombre = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map(u => [u.id, u.name]));
  return filas.map(f => ({
    id: f.id, fecha: f.createdAt.toISOString(), categoria: f.categoria, destino: MODULOS_TRANSFERENCIA[f.destino as ModuloTransferencia]?.etiqueta ?? f.destino,
    proveedor: f.proveedor, cantidad: f.cantidad, cantidadRecibida: f.cantidadRecibida, pesoTotalKg: f.pesoTotalKg ? Number(f.pesoTotalKg) : null,
    costoGs: f.costoTotalGs ? Number(f.costoTotalGs) : null, estado: f.estado, nota: f.nota,
    cargo: f.creadaPor ? nombre.get(f.creadaPor) ?? null : null, recibio: f.resueltaPor ? nombre.get(f.resueltaPor) ?? null : null,
  }));
}
