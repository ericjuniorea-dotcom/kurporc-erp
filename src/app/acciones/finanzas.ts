"use server";
// Finanzas (Fase 8, parte 1): libro de movimientos, pagos y cobros, caja y bancos.
// La base valida lo esencial (triggers): automáticos, mes cerrado, no borrar, no pagar de más.
// Acá van los permisos, la organización y la auditoría.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { ErrorPermiso, puede, requirePermiso, type Permisos } from "@/lib/permisos/servidor";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";
import { cifrar } from "@/lib/seguridad/cifrado";
import { fechaISO, gs } from "@/lib/finanzas/calculos";

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function manejar(e: unknown): { ok: false; error: string } {
  if (e instanceof ErrorPermiso) return { ok: false, error: "No tenés permiso para hacer esto." };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Datos inválidos" };
  const msg = e instanceof Error ? e.message : "";
  if (msg.startsWith("•")) return { ok: false, error: msg.slice(1) };
  // Mensajes de los triggers de la base (en castellano, pensados para mostrarse)
  const m = /(El mes \d+ está cerrado[^\n"]*|El mes del pago está cerrado|El pago supera el saldo[^\n"]*|Un movimiento anulado no se modifica|No se registran pagos sobre un movimiento anulado|La categoría no corresponde al tipo de movimiento|Categoría inexistente para esta organización)/.exec(msg);
  if (m) return { ok: false, error: m[1] };
  console.error("[finanzas]", e);
  return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
}

async function ctx(actorId: string, organizacionId: string) {
  const h = await headers();
  return { actorId, organizacionId, ip: ipDe(h), userAgent: userAgentDe(h) };
}

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const montoTxt = z.string().trim().regex(/^\d{1,15}$/, "El monto tiene que ser un número entero en guaraníes, sin puntos").refine(v => BigInt(v) > 0n, "El monto tiene que ser mayor a cero");
const medio = z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "DEBITO_AUTOMATICO", "TARJETA", "CREDITO_PROVEEDOR"]);

const movimientoSchema = z.object({
  fecha,
  tipo: z.enum(["INGRESO", "GASTO", "INVERSION", "FINANCIAMIENTO"]),
  concepto: z.string().trim().min(2, "Escribí el concepto").max(200),
  categoriaId: z.string().uuid("Elegí una categoría"),
  subcategoria: z.string().trim().max(80).optional().default(""),
  cantidad: z.string().trim().regex(/^(\d{1,11}([.,]\d{1,3})?)?$/, "Cantidad inválida").optional().default(""),
  unidadMedida: z.string().trim().max(20).optional().default(""),
  contraparte: z.string().trim().max(120).optional().default(""),
  medioPago: medio.nullable().default(null),
  cuentaFondosId: z.string().uuid().nullable().default(null),
  montoGs: montoTxt,
  pagado: z.boolean(),                 // ¿ya se pagó/cobró? (crea el pago con la fecha)
  fechaPago: fecha.optional(),
  fechaVencimiento: fecha.optional().or(z.literal("")),
  unidadId: z.string().uuid().nullable().default(null),
  facturaNumero: z.string().trim().max(40).optional().default(""),
  observacion: z.string().trim().max(500).optional().default(""),
  productoSanitarioId: z.string().max(40).optional().default(""),
  mlPorUnidad: z.string().trim().regex(/^(\d{1,6}([.,]\d{1,2})?)?$/, "ml por unidad inválido").optional().default(""),
}).strict();

const dec = (v: string) => (v ? v.replace(",", ".") : null);

async function unidadPorDefecto(org: string, unidadDefault: string, permisos: Permisos) {
  const unidades = await prisma.unidadNegocio.findMany({ where: { organizacionId: org, activa: true }, select: { id: true, tipo: true } });
  const permitidas = unidades.filter(u => permisos.unidades === "TODAS" || permisos.unidades.includes(u.id));
  return (permitidas.find(u => u.tipo === unidadDefault) ?? permitidas.find(u => u.tipo === "GRANJA") ?? permitidas[0])?.id ?? null;
}

export async function crearMovimiento(datos: z.input<typeof movimientoSchema>): Promise<R<{ id: string; aviso?: string }>> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.movimientos.crear");
    const d = movimientoSchema.parse(datos);
    const org = permisos.organizacionId;
    const cat = await prisma.categoriaFinanciera.findFirst({ where: { id: d.categoriaId, OR: [{ organizacionId: null }, { organizacionId: org }] } });
    if (!cat) throw new Error("•Esa categoría no existe.");
    if (cat.tipo !== d.tipo) throw new Error("•La categoría no corresponde al tipo elegido.");
    const esCobro = cat.signo > 0;
    if (d.pagado && !puede(permisos, esCobro ? "finanzas.cobrar.registrar_cobro" : "finanzas.pagar.registrar_pago")) {
      throw new Error(`•No tenés permiso para registrar ${esCobro ? "cobros" : "pagos"}: cargalo como ${esCobro ? "por cobrar" : "pendiente"}.`);
    }

    let unidadId = d.unidadId;
    if (unidadId) {
      const u = await prisma.unidadNegocio.findFirst({ where: { id: unidadId, organizacionId: org } });
      if (!u || !puede(permisos, "finanzas.movimientos.crear", { unidadId })) throw new Error("•No podés cargar en esa unidad de negocio.");
    } else {
      unidadId = await unidadPorDefecto(org, cat.unidadDefault, permisos);
      if (!unidadId) throw new Error("•Tu organización no tiene unidades de negocio.");
    }
    const unidad = await prisma.unidadNegocio.findUnique({ where: { id: unidadId }, select: { granjaId: true } });

    if (d.cuentaFondosId && !(await prisma.cuentaFondos.findFirst({ where: { id: d.cuentaFondosId, organizacionId: org } }))) {
      throw new Error("•Esa cuenta no es de tu organización.");
    }
    const monto = BigInt(d.montoGs);
    const limite = (await prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org }, select: { limiteAprobacionPagoGs: true } }))?.limiteAprobacionPagoGs;
    if (d.pagado && !esCobro && limite !== null && limite !== undefined && monto > limite && !puede(permisos, "finanzas.pagar.aprobar")) {
      throw new Error(`•Los pagos de más de ${gs(limite)} necesitan aprobación: cargalo como pendiente.`);
    }

    // Aviso de precio atípico (no bloquea): ±20 % del promedio de los últimos 3 meses en la categoría
    let aviso: string | undefined;
    const cantidad = dec(d.cantidad);
    if (cantidad && Number(cantidad) > 0) {
      const desde = new Date(fechaISO(d.fecha).getTime() - 92 * 86_400_000);
      const prev = await prisma.movimiento.aggregate({
        where: { organizacionId: org, categoriaId: cat.id, estado: { not: "ANULADO" }, fecha: { gte: desde }, cantidad: { gt: 0 } },
        _sum: { montoGs: true, cantidad: true },
      });
      const prom = prev._sum.cantidad && Number(prev._sum.cantidad) > 0 ? Number(prev._sum.montoGs ?? 0n) / Number(prev._sum.cantidad) : null;
      const precio = Number(monto) / Number(cantidad);
      if (prom && Math.abs(precio - prom) / prom > 0.2) {
        aviso = `Ojo: el precio unitario (${gs(Math.round(precio))}) se aleja más de 20 % del promedio de los últimos 3 meses (${gs(Math.round(prom))}). Revisá que esté bien.`;
      }
    }

    // Contraparte por nombre (se crea si no existe)
    let contraparteId: string | null = null;
    if (d.contraparte) {
      const tipoCp = esCobro ? "CLIENTE" : d.tipo === "FINANCIAMIENTO" ? "ACREEDOR" : "PROVEEDOR";
      const cp = await prisma.contraparte.upsert({
        where: { organizacionId_nombre: { organizacionId: org, nombre: d.contraparte } },
        create: { organizacionId: org, nombre: d.contraparte, tipo: tipoCp }, update: {},
      });
      contraparteId = cp.id;
    }

    const esSanidad = cat.nombre === "Sanidad" && /vacuna|medicamento/i.test(d.subcategoria);
    const id = await conActor(session.user.id, async tx => {
      const m = await tx.movimiento.create({
        data: {
          organizacionId: org, unidadId: unidadId!, granjaId: unidad?.granjaId ?? null,
          fecha: fechaISO(d.fecha), fechaVencimiento: d.fechaVencimiento ? fechaISO(d.fechaVencimiento) : null,
          tipo: d.tipo, concepto: d.concepto, categoriaId: cat.id, subcategoria: d.subcategoria || null,
          cantidad, unidadMedida: d.unidadMedida || null, contraparteId, medioPago: d.medioPago,
          cuentaFondosId: d.cuentaFondosId, montoGs: monto, estado: esCobro ? "POR_COBRAR" : "PENDIENTE",
          observacion: d.observacion || null, facturaNumero: d.facturaNumero || null,
          productoSanitarioId: esSanidad && d.productoSanitarioId ? d.productoSanitarioId : null,
          mlPorUnidad: esSanidad ? dec(d.mlPorUnidad) : null,
          creadoPor: session.user.id,
        },
        select: { id: true },
      });
      if (d.pagado) {
        await tx.pagoMovimiento.create({
          data: { movimientoId: m.id, fechaPago: fechaISO(d.fechaPago || d.fecha), montoGs: monto, cuentaFondosId: d.cuentaFondosId, medioPago: d.medioPago, creadoPor: session.user.id },
        });
      }
      return m.id;
    });
    revalidatePath("/finanzas", "layout");
    return { ok: true, id, aviso };
  } catch (e) { return manejar(e); }
}

export async function anularMovimiento(id: string, motivo: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.movimientos.anular");
    const texto = motivo.trim();
    if (texto.length < 5) throw new Error("•Escribí el motivo (al menos 5 letras).");
    const m = await prisma.movimiento.findFirst({ where: { id, organizacionId: permisos.organizacionId }, select: { estado: true, origen: true, concepto: true, montoGs: true, mes: true } });
    if (!m) throw new Error("•Ese movimiento no existe.");
    if (m.estado === "ANULADO") throw new Error("•Ya estaba anulado.");
    if (m.origen !== "MANUAL" && m.origen !== "IMPORTACION") throw new Error("•Este movimiento se generó solo (venta, cuota…): anulalo desde su origen.");
    await conActor(session.user.id, tx => tx.movimiento.update({
      where: { id }, data: { estado: "ANULADO", motivoAnulacion: texto, anuladoPor: session.user.id, anuladoEn: new Date() },
    }));
    await registrarAuditoria("MOVIMIENTO_ANULADO", "movimiento", id, { motivo: texto, concepto: m.concepto, montoGs: m.montoGs.toString(), mes: m.mes }, await ctx(session.user.id, permisos.organizacionId));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

const pagoSchema = z.object({
  movimientoId: z.string().uuid(),
  montoGs: montoTxt,
  fechaPago: fecha,
  cuentaFondosId: z.string().uuid().nullable().default(null),
  medioPago: medio.nullable().default(null),
}).strict();

export async function registrarPago(datos: z.input<typeof pagoSchema>): Promise<R> {
  try {
    const d = pagoSchema.parse(datos);
    const { session, permisos } = await requirePermiso("finanzas.movimientos.ver");
    const org = permisos.organizacionId;
    const m = await prisma.movimiento.findFirst({ where: { id: d.movimientoId, organizacionId: org }, select: { signo: true, unidadId: true } });
    if (!m) throw new Error("•Ese movimiento no existe.");
    const esCobro = m.signo > 0;
    if (!puede(permisos, esCobro ? "finanzas.cobrar.registrar_cobro" : "finanzas.pagar.registrar_pago", { unidadId: m.unidadId })) throw new ErrorPermiso("pago");
    const monto = BigInt(d.montoGs);
    if (!esCobro) {
      const limite = (await prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org }, select: { limiteAprobacionPagoGs: true } }))?.limiteAprobacionPagoGs;
      if (limite !== null && limite !== undefined && monto > limite && !puede(permisos, "finanzas.pagar.aprobar")) {
        throw new Error(`•Los pagos de más de ${gs(limite)} los aprueba quien tiene el permiso «Aprobar pagos».`);
      }
    }
    if (d.cuentaFondosId && !(await prisma.cuentaFondos.findFirst({ where: { id: d.cuentaFondosId, organizacionId: org } }))) {
      throw new Error("•Esa cuenta no es de tu organización.");
    }
    await conActor(session.user.id, tx => tx.pagoMovimiento.create({
      data: { movimientoId: d.movimientoId, fechaPago: fechaISO(d.fechaPago), montoGs: monto, cuentaFondosId: d.cuentaFondosId, medioPago: d.medioPago, creadoPor: session.user.id },
    }));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

const cuentaSchema = z.object({
  nombre: z.string().trim().min(2, "Poné un nombre").max(60),
  tipo: z.enum(["CAJA", "CAJA_CHICA", "BANCO", "COOPERATIVA", "OTRA"]),
  numero: z.string().trim().max(40).optional().default(""),
  saldoInicialGs: z.string().trim().regex(/^-?\d{0,15}$/, "Saldo inválido").default("0"),
  fechaSaldoInicial: fecha.optional().or(z.literal("")),
  montoAsignadoGs: z.string().trim().regex(/^\d{0,15}$/).optional().default(""),
}).strict();

export async function crearCuenta(datos: z.input<typeof cuentaSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.caja_bancos.editar_cuentas");
    const d = cuentaSchema.parse(datos);
    const org = permisos.organizacionId;
    if (await prisma.cuentaFondos.findFirst({ where: { organizacionId: org, nombre: { equals: d.nombre, mode: "insensitive" } } })) throw new Error("•Ya hay una cuenta con ese nombre.");
    await conActor(session.user.id, tx => tx.cuentaFondos.create({
      data: {
        organizacionId: org, nombre: d.nombre, tipo: d.tipo, numeroCifrado: d.numero ? cifrar(d.numero) : null,
        saldoInicialGs: BigInt(d.saldoInicialGs || "0"), fechaSaldoInicial: d.fechaSaldoInicial ? fechaISO(d.fechaSaldoInicial) : null,
        montoAsignadoGs: d.montoAsignadoGs ? BigInt(d.montoAsignadoGs) : null,
      },
    }));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function cambiarEstadoCuenta(id: string, activa: boolean): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.caja_bancos.editar_cuentas");
    const c = await prisma.cuentaFondos.findFirst({ where: { id, organizacionId: permisos.organizacionId } });
    if (!c) throw new Error("•Esa cuenta no existe.");
    await conActor(session.user.id, tx => tx.cuentaFondos.update({ where: { id }, data: { activa } }));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

const saldoSchema = z.object({
  cuentaFondosId: z.string().uuid(),
  fecha,
  saldoGs: z.string().trim().regex(/^-?\d{1,15}$/, "Saldo inválido"),
  observacion: z.string().trim().max(200).optional().default(""),
}).strict();

/** Conteo de caja o extracto bancario a una fecha (8.4). */
export async function declararSaldo(datos: z.input<typeof saldoSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.caja_bancos.declarar_saldo");
    const d = saldoSchema.parse(datos);
    const org = permisos.organizacionId;
    if (!(await prisma.cuentaFondos.findFirst({ where: { id: d.cuentaFondosId, organizacionId: org } }))) throw new Error("•Esa cuenta no existe.");
    const f = fechaISO(d.fecha);
    if (f.getTime() > Date.now() + 86_400_000) throw new Error("•No se declara un saldo a futuro.");
    await conActor(session.user.id, tx => tx.saldoDeclarado.create({
      data: { organizacionId: org, cuentaFondosId: d.cuentaFondosId, fecha: f, saldoGs: BigInt(d.saldoGs), observacion: d.observacion || null, declaradoPor: session.user.id },
    }));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}


// ── Ventas (8.5) ─────────────────────────────────────────────────────
const ventaSchema = z.object({
  fechaSalida: fecha,
  tipoVenta: z.enum(["LECHONES", "MATRIZ_DESCARTE", "REPRODUCTOR", "DOSIS_SEMINALES", "CERDO_TERMINADO", "OTRO"]),
  loteDesteteId: z.string().max(40).optional().default(""),
  loteEngordeId: z.string().max(40).optional().default(""),
  cantidad: z.coerce.number().int("La cantidad es un número entero").min(1, "Cargá la cantidad").max(100000),
  kgTotales: z.string().trim().regex(/^\d{1,7}([.,]\d{1,2})?$/, "Kg inválidos"),
  modoPrecio: z.enum(["POR_KG", "POR_CABEZA"]),
  precioGs: z.string().trim().regex(/^\d{1,12}$/, "Precio inválido (en guaraníes, sin puntos)"),
  destino: z.enum(["ENGORDE", "CONSUMO", "CARNEADO", "REPRODUCCION", "FRIGORIFICO"]),
  cliente: z.string().trim().min(2, "Escribí el cliente").max(120),
  recibePor: z.string().trim().max(80).optional().default(""),
  remitoFactura: z.string().trim().max(40).optional().default(""),
  guiaTraslado: z.string().trim().max(40).optional().default(""),
  fechaVencimientoCobro: fecha.optional().or(z.literal("")),
  cobrada: z.boolean(),
  fechaCobro: fecha.optional().or(z.literal("")),
  cuentaFondosId: z.string().uuid().nullable().default(null),
  medioPago: medio.nullable().default(null),
}).strict();

export async function crearVenta(datos: z.input<typeof ventaSchema>): Promise<R<{ importe: string }>> {
  try {
    const { session, permisos } = await requirePermiso("ventas.ventas.crear");
    const d = ventaSchema.parse(datos);
    const org = permisos.organizacionId;
    if (d.cobrada && !puede(permisos, "finanzas.cobrar.registrar_cobro")) throw new Error("•No tenés permiso para registrar cobros: cargala como por cobrar.");
    if (d.cuentaFondosId && !(await prisma.cuentaFondos.findFirst({ where: { id: d.cuentaFondosId, organizacionId: org } }))) throw new Error("•Esa cuenta no es de tu organización.");
    const { registrarVenta, ErrorVenta } = await import("@/lib/finanzas/ventas");
    try {
      const r = await conActor(session.user.id, tx => registrarVenta(tx, {
        organizacionId: org, creadoPor: session.user.id, fechaSalida: fechaISO(d.fechaSalida), tipoVenta: d.tipoVenta,
        cantidad: d.cantidad, kgTotales: Number(d.kgTotales.replace(",", ".")), modoPrecio: d.modoPrecio, precioGs: BigInt(d.precioGs),
        destino: d.destino, cliente: d.cliente, loteDesteteId: d.loteDesteteId || null, loteEngordeId: d.loteEngordeId || null,
        recibePor: d.recibePor || null, remitoFactura: d.remitoFactura || null, guiaTraslado: d.guiaTraslado || null,
        fechaVencimientoCobro: d.fechaVencimientoCobro ? fechaISO(d.fechaVencimientoCobro) : null,
        cobro: d.cobrada ? { fecha: fechaISO(d.fechaCobro || d.fechaSalida), cuentaFondosId: d.cuentaFondosId, medioPago: d.medioPago } : null,
      }));
      revalidatePath("/finanzas", "layout");
      return { ok: true, importe: r.importe.toString() };
    } catch (e) {
      if (e instanceof ErrorVenta) throw new Error(`•${e.message}`);
      throw e;
    }
  } catch (e) { return manejar(e); }
}

export async function anularVenta(id: string, motivo: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("ventas.ventas.anular");
    const texto = motivo.trim();
    if (texto.length < 5) throw new Error("•Escribí el motivo (al menos 5 letras).");
    const v = await prisma.venta.findFirst({ where: { id, organizacionId: permisos.organizacionId } });
    if (!v) throw new Error("•Esa venta no existe.");
    if (v.estado === "ANULADA") throw new Error("•Ya estaba anulada.");
    await conActor(session.user.id, async tx => {
      await tx.venta.update({ where: { id }, data: { estado: "ANULADA" } });
      await tx.movimiento.update({ where: { id: v.movimientoId }, data: { estado: "ANULADO", motivoAnulacion: `Venta anulada: ${texto}`, anuladoPor: session.user.id, anuladoEn: new Date() } });
      // Los animales vuelven al lote
      if (v.loteDesteteId) await tx.nurseryBatch.update({ where: { id: v.loteDesteteId }, data: { currentCount: { increment: v.cantidad }, isActive: true } });
      if (v.loteEngordeId) await tx.growingBatch.update({ where: { id: v.loteEngordeId }, data: { currentCount: { increment: v.cantidad } } });
    });
    await registrarAuditoria("MOVIMIENTO_ANULADO", "venta", id, { motivo: texto, importeGs: v.importeGs.toString() }, await ctx(session.user.id, permisos.organizacionId));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Parámetros (hoja PARÁMETROS) ─────────────────────────────────────
export async function guardarParametros(valores: Record<string, string>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.parametros.editar");
    const { PARAMETROS, convertirParametro } = await import("@/lib/finanzas/parametros");
    const data: Record<string, unknown> = {};
    for (const d of PARAMETROS) {
      if (!(d.clave in valores)) continue;
      try { data[d.clave] = convertirParametro(d, String(valores[d.clave] ?? "")); }
      catch (e) { throw new Error(`•${(e as Error).message}`); }
    }
    if (typeof data.alertaCoberturaDias === "number" && typeof data.metaCoberturaDias === "number" && data.alertaCoberturaDias > data.metaCoberturaDias) {
      throw new Error("•La alerta de cobertura tiene que ser menor o igual a la meta.");
    }
    const org = permisos.organizacionId;
    await conActor(session.user.id, tx => tx.parametrosFinancieros.upsert({ where: { organizacionId: org }, create: { organizacionId: org, ...data }, update: data }));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}
