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

// ── Deudas y financiamiento (8.19) ───────────────────────────────────
const prestamoSchema = z.object({
  acreedor: z.string().trim().min(2, "Escribí el acreedor").max(120),
  concepto: z.string().trim().min(2, "Escribí el concepto").max(160),
  montoRecibidoGs: montoTxt,
  cuotaMensualGs: montoTxt,
  numeroCuotas: z.coerce.number().int().min(1, "Al menos 1 cuota").max(600),
  primerVencimiento: fecha,
  debitoAutomatico: z.boolean(),
  cuentaDebitoId: z.string().uuid().nullable().default(null),
  registrarIngreso: z.boolean(),             // cargar el "Préstamo recibido" en el libro
  fechaRecibido: fecha.optional().or(z.literal("")),
  cuotasYaPagadas: z.coerce.number().int().min(0).max(600).default(0),
  observacion: z.string().trim().max(300).optional().default(""),
}).strict();

export async function crearPrestamo(datos: z.input<typeof prestamoSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.deudas.crear");
    const d = prestamoSchema.parse(datos);
    const org = permisos.organizacionId;
    if (d.cuotasYaPagadas > d.numeroCuotas) throw new Error("•Hay más cuotas pagadas que cuotas.");
    if (d.cuentaDebitoId && !(await prisma.cuentaFondos.findFirst({ where: { id: d.cuentaDebitoId, organizacionId: org } }))) throw new Error("•Esa cuenta no es de tu organización.");
    const { unidadParaCategoria } = await import("@/lib/finanzas/plan-datos");
    const { vencimientos } = await import("@/lib/finanzas/planificacion");
    const unidad = await unidadParaCategoria(org, "COMUN");
    if (!unidad) throw new Error("•Tu organización no tiene unidades de negocio.");
    const [catRecibido, catCuota] = await Promise.all([
      prisma.categoriaFinanciera.findFirst({ where: { nombre: "Préstamo recibido", organizacionId: null } }),
      prisma.categoriaFinanciera.findFirst({ where: { nombre: "Pago de cuota de préstamo", organizacionId: null } }),
    ]);
    if (!catRecibido || !catCuota) throw new Error("•Faltan las categorías de financiamiento.");
    const fechas = vencimientos(fechaISO(d.primerVencimiento), d.numeroCuotas);
    const cuota = BigInt(d.cuotaMensualGs);
    await conActor(session.user.id, async tx => {
      const acreedor = await tx.contraparte.upsert({
        where: { organizacionId_nombre: { organizacionId: org, nombre: d.acreedor } },
        create: { organizacionId: org, nombre: d.acreedor, tipo: "ACREEDOR" }, update: {},
      });
      const p = await tx.prestamo.create({
        data: {
          organizacionId: org, unidadId: unidad.id, acreedorId: acreedor.id, concepto: d.concepto, montoRecibidoGs: BigInt(d.montoRecibidoGs),
          cuotaMensualGs: cuota, numeroCuotas: d.numeroCuotas, primerVencimiento: fechas[0], debitoAutomatico: d.debitoAutomatico,
          cuentaDebitoId: d.cuentaDebitoId, observacion: d.observacion || null, creadoPor: session.user.id,
        },
      });
      for (let i = 0; i < fechas.length; i++) {
        const c = await tx.cuotaPrestamo.create({ data: { prestamoId: p.id, numero: i + 1, vencimiento: fechas[i], montoGs: cuota } });
        // Préstamo que ya venía pagándose: las primeras cuotas quedan pagadas en su vencimiento
        if (i < d.cuotasYaPagadas) {
          const m = await tx.movimiento.create({
            data: {
              organizacionId: org, unidadId: unidad.id, fecha: fechas[i], tipo: "FINANCIAMIENTO", concepto: `Cuota ${i + 1}/${d.numeroCuotas} · ${d.concepto}`,
              categoriaId: catCuota.id, contraparteId: acreedor.id, montoGs: cuota, estado: "PENDIENTE", origen: "CUOTA_PRESTAMO", origenId: c.id,
              cuentaFondosId: d.cuentaDebitoId, creadoPor: session.user.id,
            },
          });
          await tx.pagoMovimiento.create({ data: { movimientoId: m.id, fechaPago: fechas[i], montoGs: cuota, cuentaFondosId: d.cuentaDebitoId, creadoPor: session.user.id } });
          await tx.cuotaPrestamo.update({ where: { id: c.id }, data: { movimientoId: m.id } });
        }
      }
      if (d.registrarIngreso) {
        const f = fechaISO(d.fechaRecibido || d.primerVencimiento);
        const m = await tx.movimiento.create({
          data: {
            organizacionId: org, unidadId: unidad.id, fecha: f, tipo: "FINANCIAMIENTO", concepto: `Préstamo recibido · ${d.concepto}`,
            categoriaId: catRecibido.id, contraparteId: acreedor.id, montoGs: BigInt(d.montoRecibidoGs), estado: "POR_COBRAR",
            cuentaFondosId: d.cuentaDebitoId, creadoPor: session.user.id,
          },
        });
        await tx.pagoMovimiento.create({ data: { movimientoId: m.id, fechaPago: f, montoGs: BigInt(d.montoRecibidoGs), cuentaFondosId: d.cuentaDebitoId, creadoPor: session.user.id } });
      }
    });
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Presupuesto (8.13) ───────────────────────────────────────────────
const cambioPresupuesto = z.object({ categoriaId: z.string().uuid(), mes: z.number().int().min(200001).max(210012), montoGs: z.string().regex(/^\d{0,15}$/) });

async function escribirPresupuesto(org: string, actorId: string, cambios: { categoriaId: string; mes: number; montoGs: bigint }[]) {
  const { unidadParaCategoria } = await import("@/lib/finanzas/plan-datos");
  const cats = await prisma.categoriaFinanciera.findMany({ where: { id: { in: Array.from(new Set(cambios.map(c => c.categoriaId))) }, OR: [{ organizacionId: null }, { organizacionId: org }] }, select: { id: true, unidadDefault: true, tipo: true } });
  const cat = new Map(cats.map(c => [c.id, c]));
  const unidades = new Map<string, string>();
  for (const c of cats) {
    if (c.tipo !== "GASTO" && c.tipo !== "INVERSION") throw new Error("•Solo se presupuestan gastos e inversiones.");
    if (!unidades.has(c.unidadDefault)) { const u = await unidadParaCategoria(org, c.unidadDefault); if (!u) throw new Error("•Sin unidades de negocio."); unidades.set(c.unidadDefault, u.id); }
  }
  await conActor(actorId, async tx => {
    for (const c of cambios) {
      const k = cat.get(c.categoriaId);
      if (!k) throw new Error("•Categoría inválida.");
      const unidadId = unidades.get(k.unidadDefault)!;
      const where = { organizacionId_unidadId_categoriaId_mes: { organizacionId: org, unidadId, categoriaId: c.categoriaId, mes: c.mes } };
      if (c.montoGs === 0n) await tx.presupuesto.deleteMany({ where: { organizacionId: org, unidadId, categoriaId: c.categoriaId, mes: c.mes } });
      else await tx.presupuesto.upsert({ where, create: { organizacionId: org, unidadId, categoriaId: c.categoriaId, mes: c.mes, montoGs: c.montoGs }, update: { montoGs: c.montoGs } });
    }
  });
}

export async function guardarPresupuesto(cambios: z.input<typeof cambioPresupuesto>[]): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.presupuesto.editar");
    const lista = z.array(cambioPresupuesto).max(2000).parse(cambios);
    await escribirPresupuesto(permisos.organizacionId, session.user.id, lista.map(c => ({ ...c, montoGs: BigInt(c.montoGs || "0") })));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

/** Herramientas del presupuesto: copiar el año anterior, promedio real de 6 meses, cargas sociales. */
export async function herramientaPresupuesto(d: { accion: "copiar_anio_anterior" | "promedio_real" | "cargas_sociales"; anio: number; categoriaId?: string; desdeMes?: number }): Promise<R<{ cambios: number }>> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.presupuesto.editar");
    const org = permisos.organizacionId;
    const anio = z.number().int().min(2000).max(2100).parse(d.anio);
    const meses = Array.from({ length: 12 }, (_, i) => anio * 100 + i + 1);
    const cambios: { categoriaId: string; mes: number; montoGs: bigint }[] = [];
    if (d.accion === "copiar_anio_anterior") {
      const previo = await prisma.presupuesto.findMany({ where: { organizacionId: org, mes: { gte: (anio - 1) * 100 + 1, lte: (anio - 1) * 100 + 12 } } });
      if (!previo.length) throw new Error(`•No hay presupuesto de ${anio - 1} para copiar.`);
      for (const p of previo) cambios.push({ categoriaId: p.categoriaId, mes: p.mes + 100, montoGs: p.montoGs });
    } else if (d.accion === "promedio_real") {
      // Promedio real de los últimos 6 meses cerrados de cada categoría (mejora N° 10)
      const { hoyUTC, mesDe } = await import("@/lib/finanzas/calculos");
      const { sumarMeses } = await import("@/lib/finanzas/planificacion");
      const hasta = sumarMeses(mesDe(hoyUTC()), -1), desde = sumarMeses(hasta, -5);
      const reales = await prisma.movimiento.groupBy({
        by: ["categoriaId"], where: { organizacionId: org, estado: { not: "ANULADO" }, tipo: "GASTO", mes: { gte: desde, lte: hasta }, ...(d.categoriaId ? { categoriaId: d.categoriaId } : {}) },
        _sum: { montoGs: true },
      });
      for (const r of reales) {
        const prom = (r._sum.montoGs ?? 0n) / 6n;
        if (prom > 0n) for (const mes of meses) cambios.push({ categoriaId: r.categoriaId, mes, montoGs: prom });
      }
      if (!cambios.length) throw new Error("•No hay gastos reales en los últimos 6 meses.");
    } else {
      // Cargas sociales: aguinaldo (1/12 de los sueldos) + IPS patronal sobre los sueldos presupuestados (mejora N° 9)
      const params = await prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } });
      const sueldos = await prisma.categoriaFinanciera.findMany({ where: { organizacionId: null, nombre: { in: ["Personal producción", "Personal administración"] } }, select: { id: true } });
      const cargas = await prisma.categoriaFinanciera.findFirst({ where: { organizacionId: null, nombre: "Cargas sociales (IPS y aguinaldo)" } });
      if (!cargas) throw new Error("•Falta la categoría de cargas sociales.");
      const desde = d.desdeMes ?? anio * 100 + 1;
      const pres = await prisma.presupuesto.groupBy({ by: ["mes"], where: { organizacionId: org, categoriaId: { in: sueldos.map(s => s.id) }, mes: { gte: desde, lte: anio * 100 + 12 } }, _sum: { montoGs: true } });
      const tasa = Number(params?.tasaIpsPatronal ?? 0.165);
      for (const p of pres) {
        const s = p._sum.montoGs ?? 0n;
        const monto = (params?.provisionarAguinaldo === false ? 0n : s / 12n) + BigInt(Math.round(Number(s) * tasa));
        if (monto > 0n) cambios.push({ categoriaId: cargas.id, mes: p.mes, montoGs: monto });
      }
      if (!cambios.length) throw new Error("•Primero presupuestá los sueldos (Personal producción y administración).");
    }
    await escribirPresupuesto(org, session.user.id, cambios);
    revalidatePath("/finanzas", "layout");
    return { ok: true, cambios: cambios.length };
  } catch (e) { return manejar(e); }
}

/** Causa escrita al lado del desvío (8.14). */
export async function guardarCausa(categoriaId: string, mes: number, causa: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.presupuesto_real.escribir_causa");
    const texto = causa.trim().slice(0, 500);
    const org = permisos.organizacionId;
    z.string().uuid().parse(categoriaId);
    z.number().int().min(200001).max(210012).parse(mes);
    await conActor(session.user.id, async tx => {
      if (!texto) await tx.causaDesvio.deleteMany({ where: { organizacionId: org, categoriaId, mes } });
      else await tx.causaDesvio.upsert({
        where: { organizacionId_categoriaId_mes: { organizacionId: org, categoriaId, mes } },
        create: { organizacionId: org, categoriaId, mes, causa: texto, autorId: session.user.id }, update: { causa: texto, autorId: session.user.id },
      });
    });
    revalidatePath("/finanzas/presupuesto-vs-real");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Aportes de capital previstos (8.20) ──────────────────────────────
export async function crearAporte(d: { mes: number; montoGs: string; descripcion: string }): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.proyeccion.editar_supuestos");
    const mes = z.number().int().min(200001).max(210012).parse(d.mes);
    const monto = montoTxt.parse(d.montoGs);
    await conActor(session.user.id, tx => tx.aporteCapitalPrevisto.create({ data: { organizacionId: permisos.organizacionId, mes, montoGs: BigInt(monto), descripcion: d.descripcion.trim().slice(0, 200) || null } }));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function borrarAporte(id: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.proyeccion.editar_supuestos");
    await conActor(session.user.id, tx => tx.aporteCapitalPrevisto.deleteMany({ where: { id, organizacionId: permisos.organizacionId } }));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Evaluación de nueva inversión (8.18) ─────────────────────────────
const evaluacionSchema = z.object({
  fechaPrevista: fecha,
  concepto: z.string().trim().min(2, "Escribí el concepto").max(160),
  categoriaId: z.string().uuid("Elegí una categoría"),
  cantidad: z.string().trim().regex(/^\d{1,8}([.,]\d{1,2})?$/, "Cantidad inválida"),
  montoTotalGs: montoTxt,
  formaPago: z.enum(["CONTADO", "FINANCIADO", "MIXTO"]),
  financiamientoGs: z.string().trim().regex(/^\d{0,15}$/).default("0"),
  plazoMeses: z.coerce.number().int().min(0).max(600).default(0),
  tasaAnual: z.string().trim().regex(/^(\d{1,3}([.,]\d{1,2})?)?$/, "Tasa inválida").default(""),
}).strict();

export async function crearEvaluacion(datos: z.input<typeof evaluacionSchema>): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.inversiones.evaluar");
    const d = evaluacionSchema.parse(datos);
    const cat = await prisma.categoriaFinanciera.findFirst({ where: { id: d.categoriaId, tipo: "INVERSION", OR: [{ organizacionId: null }, { organizacionId: permisos.organizacionId }] } });
    if (!cat) throw new Error("•Elegí una categoría de inversión.");
    const fin = BigInt(d.financiamientoGs || "0");
    if (fin > BigInt(d.montoTotalGs)) throw new Error("•El financiamiento no puede superar el monto.");
    if (d.formaPago !== "CONTADO" && (fin === 0n || d.plazoMeses === 0)) throw new Error("•Cargá el monto financiado y el plazo.");
    await conActor(session.user.id, tx => tx.evaluacionInversion.create({
      data: {
        organizacionId: permisos.organizacionId, fechaPrevista: fechaISO(d.fechaPrevista), concepto: d.concepto, categoriaId: cat.id,
        cantidad: d.cantidad.replace(",", "."), montoTotalGs: BigInt(d.montoTotalGs), formaPago: d.formaPago,
        financiamientoGs: d.formaPago === "CONTADO" ? 0n : fin, plazoMeses: d.formaPago === "CONTADO" ? 0 : d.plazoMeses,
        tasaAnual: d.tasaAnual ? Number(d.tasaAnual.replace(",", ".")) / 100 : null,
      },
    }));
    revalidatePath("/finanzas/nueva-inversion");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

/** Aprobar = entra al presupuesto del mes previsto; Ejecutar = pasa al libro como pendiente; Descartar. */
export async function cambiarEstadoEvaluacion(id: string, estado: "APROBADA" | "DESCARTADA" | "EJECUTADA"): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso(estado === "EJECUTADA" ? "finanzas.inversiones.crear" : "finanzas.inversiones.evaluar");
    const org = permisos.organizacionId;
    const ev = await prisma.evaluacionInversion.findFirst({ where: { id, organizacionId: org } });
    if (!ev) throw new Error("•Esa evaluación no existe.");
    if (ev.estado === "EJECUTADA" || ev.estado === "DESCARTADA") throw new Error("•Esa evaluación ya está cerrada.");
    const { mesDe } = await import("@/lib/finanzas/calculos");
    if (estado === "APROBADA") {
      const mes = mesDe(ev.fechaPrevista);
      const previo = await prisma.presupuesto.aggregate({ where: { organizacionId: org, categoriaId: ev.categoriaId, mes }, _sum: { montoGs: true } });
      await escribirPresupuesto(org, session.user.id, [{ categoriaId: ev.categoriaId, mes, montoGs: (previo._sum.montoGs ?? 0n) + ev.montoTotalGs }]);
    }
    if (estado === "EJECUTADA") {
      const cat = await prisma.categoriaFinanciera.findUnique({ where: { id: ev.categoriaId } });
      const { unidadParaCategoria } = await import("@/lib/finanzas/plan-datos");
      const u = await unidadParaCategoria(org, cat?.unidadDefault ?? "GRANJA");
      if (!u) throw new Error("•Sin unidades de negocio.");
      await conActor(session.user.id, tx => tx.movimiento.create({
        data: {
          organizacionId: org, unidadId: u.id, granjaId: u.granjaId, fecha: ev.fechaPrevista, fechaVencimiento: ev.fechaPrevista, tipo: "INVERSION",
          concepto: ev.concepto, categoriaId: ev.categoriaId, cantidad: ev.cantidad, montoGs: ev.montoTotalGs, estado: "PENDIENTE", creadoPor: session.user.id,
          observacion: "Desde la evaluación de nueva inversión",
        },
      }));
    }
    await conActor(session.user.id, tx => tx.evaluacionInversion.update({ where: { id }, data: { estado } }));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

// ── Cierre de mes (8.27) y recomendaciones (8.25) ────────────────────
async function guardarRecomendaciones(org: string, mes: number) {
  const { calcularRecomendaciones } = await import("@/lib/finanzas/control");
  const recs = await calcularRecomendaciones(org, mes);
  for (const r of recs) {
    await prisma.recomendacion.upsert({
      where: { organizacionId_codigo_mes: { organizacionId: org, codigo: r.codigo, mes } },
      create: { organizacionId: org, mes, ...r },
      update: { problema: r.problema, situacion: r.situacion, mejora: r.mejora, impacto: r.impacto, prioridad: r.prioridad, accion: r.accion, generadaEn: new Date() },
    });
  }
  return recs.length;
}

export async function cerrarMes(mes: number, manual: { produccion: boolean; balanceado: boolean; pendientes: boolean }): Promise<R<{ recomendaciones: number }>> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.cierre.cerrar");
    const org = permisos.organizacionId;
    z.number().int().min(200001).max(210012).parse(mes);
    const { evaluarCierre, estadoFinanciero, indicadores } = await import("@/lib/finanzas/control");
    const pasos = await evaluarCierre(org, mes, manual);
    const faltan = pasos.filter(p => !p.ok);
    if (faltan.length) throw new Error(`•Falta completar: ${faltan.map(p => p.nombre.toLowerCase()).join("; ")}.`);
    const [e, ind] = await Promise.all([estadoFinanciero(org), indicadores(org)]);
    const snapshot = JSON.parse(JSON.stringify({ estado: e, indicadores: { operacion: ind.operacion, produccion: ind.produccion, caja: ind.caja, retorno: ind.retorno }, pasos }, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    const checklist = Object.fromEntries(pasos.map(p => [p.clave, p.ok]));
    const existente = await prisma.cierreMes.findFirst({ where: { organizacionId: org, unidadId: null, mes } });
    if (existente?.estado === "CERRADO") throw new Error("•Ese mes ya está cerrado.");
    await conActor(session.user.id, async tx => {
      if (existente) await tx.cierreMes.update({ where: { id: existente.id }, data: { estado: "CERRADO", checklist, snapshot, cerradoPor: session.user.id, cerradoEn: new Date() } });
      else await tx.cierreMes.create({ data: { organizacionId: org, mes, estado: "CERRADO", checklist, snapshot, cerradoPor: session.user.id, cerradoEn: new Date() } });
    });
    const recs = await guardarRecomendaciones(org, mes);
    // Aviso a quienes ven el tablero financiero
    const miembros = await prisma.miembro.findMany({ where: { organizacionId: org, estado: "ACTIVO" }, select: { userId: true, esPropietario: true, rol: { select: { permisos: { where: { permisoClave: "finanzas.tablero.ver" }, select: { permisoClave: true } } } } } });
    const destinatarios = miembros.filter(m => m.esPropietario || (m.rol?.permisos.length ?? 0) > 0).map(m => m.userId);
    const { nombreMes } = await import("@/lib/finanzas/calculos");
    if (destinatarios.length) await prisma.notificacion.createMany({ data: destinatarios.map(userId => ({ userId, organizacionId: org, tipo: "MES_CERRADO", titulo: `Se cerró ${nombreMes(mes)}`, cuerpo: `${recs} recomendación(es) nuevas.`, enlace: "/finanzas/recomendaciones" })) });
    await registrarAuditoria("MES_CERRADO", "cierre_mes", String(mes), { mes, recomendaciones: recs }, await ctx(session.user.id, org));
    revalidatePath("/finanzas", "layout");
    return { ok: true, recomendaciones: recs };
  } catch (e) { return manejar(e); }
}

export async function reabrirMes(mes: number, motivo: string): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.cierre.reabrir");
    const org = permisos.organizacionId;
    const texto = motivo.trim();
    if (texto.length < 5) throw new Error("•Escribí el motivo (al menos 5 letras).");
    const c = await prisma.cierreMes.findFirst({ where: { organizacionId: org, unidadId: null, mes, estado: "CERRADO" } });
    if (!c) throw new Error("•Ese mes no está cerrado.");
    await conActor(session.user.id, tx => tx.cierreMes.update({ where: { id: c.id }, data: { estado: "ABIERTO", motivoReapertura: texto } }));
    await registrarAuditoria("MES_REABIERTO", "cierre_mes", String(mes), { mes, motivo: texto }, await ctx(session.user.id, org));
    revalidatePath("/finanzas", "layout");
    return { ok: true };
  } catch (e) { return manejar(e); }
}

export async function generarRecomendaciones(mes: number): Promise<R<{ cantidad: number }>> {
  try {
    const { permisos } = await requirePermiso("finanzas.recomendaciones.gestionar");
    z.number().int().min(200001).max(210012).parse(mes);
    const n = await guardarRecomendaciones(permisos.organizacionId, mes);
    revalidatePath("/finanzas/recomendaciones");
    return { ok: true, cantidad: n };
  } catch (e) { return manejar(e); }
}

export async function cambiarEstadoRecomendacion(id: string, estado: "ABIERTA" | "EN_CURSO" | "RESUELTA" | "DESCARTADA"): Promise<R> {
  try {
    const { session, permisos } = await requirePermiso("finanzas.recomendaciones.gestionar");
    z.enum(["ABIERTA", "EN_CURSO", "RESUELTA", "DESCARTADA"]).parse(estado);
    const r = await prisma.recomendacion.findFirst({ where: { id, organizacionId: permisos.organizacionId } });
    if (!r) throw new Error("•Esa recomendación no existe.");
    await conActor(session.user.id, tx => tx.recomendacion.update({ where: { id }, data: { estado } }));
    revalidatePath("/finanzas/recomendaciones");
    return { ok: true };
  } catch (e) { return manejar(e); }
}
