// Datos de planificación (Fase 8, parte 3): presupuesto, cuotas de préstamos y proyección de caja.
import "server-only";
import prisma from "@/lib/db/prisma";
import { cuentasConSaldo, pendientes } from "./datos";
import { hoyUTC, mesDe, mesDePago } from "./calculos";
import { mesDeFecha, preguntasProyeccion, proyectar, sumarMeses } from "./planificacion";

/** Unidad de negocio para una categoría (GRANJA → la primera granja; COMUN → la común). */
export async function unidadParaCategoria(org: string, unidadDefault: string) {
  const unidades = await prisma.unidadNegocio.findMany({ where: { organizacionId: org, activa: true }, orderBy: { codigo: "asc" }, select: { id: true, tipo: true, granjaId: true } });
  return unidades.find(u => u.tipo === unidadDefault) ?? unidades.find(u => u.tipo === "GRANJA") ?? unidades[0] ?? null;
}

const materializadas = new Map<string, number>();
/**
 * Cada cuota que vence genera su movimiento "Pago de cuota de préstamo" (pendiente; si es débito
 * automático, pagado en la fecha). Se corre al entrar a Finanzas, como máximo cada 10 minutos por organización.
 */
export async function materializarCuotas(org: string, actorId: string) {
  if ((materializadas.get(org) ?? 0) > Date.now() - 10 * 60_000) return;
  materializadas.set(org, Date.now());
  const hoy = hoyUTC();
  const cuotas = await prisma.cuotaPrestamo.findMany({
    where: { movimientoId: null, vencimiento: { lte: hoy }, prestamo: { organizacionId: org, estado: "VIGENTE" } },
    include: { prestamo: true }, orderBy: { vencimiento: "asc" }, take: 200,
  });
  if (!cuotas.length) return;
  const cat = await prisma.categoriaFinanciera.findFirst({ where: { nombre: "Pago de cuota de préstamo", organizacionId: null } });
  if (!cat) return;
  for (const c of cuotas) {
    try {
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`select set_config('app.actor_id', ${actorId}, true)`;
        const p = c.prestamo;
        const m = await tx.movimiento.create({
          data: {
            organizacionId: org, unidadId: p.unidadId, fecha: c.vencimiento, fechaVencimiento: c.vencimiento, tipo: "FINANCIAMIENTO",
            concepto: `Cuota ${c.numero}/${p.numeroCuotas} · ${p.concepto}`, categoriaId: cat.id, subcategoria: "Capital + interés",
            contraparteId: p.acreedorId, montoGs: c.montoGs, estado: "PENDIENTE", origen: "CUOTA_PRESTAMO", origenId: c.id,
            medioPago: p.debitoAutomatico ? "DEBITO_AUTOMATICO" : null, cuentaFondosId: p.cuentaDebitoId, creadoPor: actorId,
          },
        });
        if (p.debitoAutomatico) {
          await tx.pagoMovimiento.create({ data: { movimientoId: m.id, fechaPago: c.vencimiento, montoGs: c.montoGs, cuentaFondosId: p.cuentaDebitoId, medioPago: "DEBITO_AUTOMATICO", creadoPor: actorId } });
        }
        await tx.cuotaPrestamo.update({ where: { id: c.id }, data: { movimientoId: m.id } });
      });
    } catch (e) {
      // Un mes cerrado u otra regla de la base: la cuota queda para revisar a mano
      console.error("[cuotas]", c.id, e instanceof Error ? e.message : e);
    }
  }
}

/** Préstamos con sus cuotas y si cada una está pagada (su movimiento quedó PAGADO). */
export async function prestamosDe(org: string) {
  const prestamos = await prisma.prestamo.findMany({ where: { organizacionId: org }, orderBy: { primerVencimiento: "asc" }, include: { cuotas: { orderBy: { numero: "asc" } } } });
  const movIds = prestamos.flatMap(p => p.cuotas.map(c => c.movimientoId).filter((x): x is string => !!x));
  const movs = movIds.length ? await prisma.movimiento.findMany({ where: { id: { in: movIds } }, select: { id: true, estado: true } }) : [];
  const estado = new Map(movs.map(m => [m.id, m.estado]));
  const acreedores = await prisma.contraparte.findMany({ where: { id: { in: prestamos.map(p => p.acreedorId) } }, select: { id: true, nombre: true } });
  const nombre = new Map(acreedores.map(a => [a.id, a.nombre]));
  return prestamos.map(p => ({
    ...p, acreedor: nombre.get(p.acreedorId) ?? "—",
    cuotas: p.cuotas.map(c => ({ ...c, pagada: !!c.movimientoId && estado.get(c.movimientoId) === "PAGADO" })),
  }));
}

/** Todo lo que necesita la proyección de caja (8.15), desde el mes siguiente al corte. */
export async function datosProyeccion(org: string, meses = 15) {
  const corte = hoyUTC();
  const desde = sumarMeses(mesDe(corte), 1);
  const hasta = sumarMeses(desde, meses - 1);
  const [params, presup, aportes, prestamos, cxp, cajas] = await Promise.all([
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.presupuesto.findMany({ where: { organizacionId: org, mes: { gte: desde, lte: hasta } }, select: { mes: true, montoGs: true, categoriaId: true } }),
    prisma.aporteCapitalPrevisto.findMany({ where: { organizacionId: org }, orderBy: { mes: "asc" } }),
    prestamosDe(org),
    pendientes(org, false),
    cuentasConSaldo(org),
  ]);
  const cats = await prisma.categoriaFinanciera.findMany({ where: { id: { in: Array.from(new Set(presup.map(p => p.categoriaId))) } }, select: { id: true, tipo: true } });
  const tipo = new Map(cats.map(c => [c.id, c.tipo]));
  const acum = (m: Map<number, bigint>, k: number, v: bigint) => m.set(k, (m.get(k) ?? 0n) + v);
  const gastoOperativo = new Map<number, bigint>(), inversion = new Map<number, bigint>(), cuotas = new Map<number, bigint>(), porPagar = new Map<number, bigint>(), aportesMes = new Map<number, bigint>();
  for (const p of presup) {
    const t = tipo.get(p.categoriaId);
    if (t === "GASTO") acum(gastoOperativo, p.mes, p.montoGs);
    else if (t === "INVERSION") acum(inversion, p.mes, p.montoGs);
  }
  for (const a of aportes) if (a.mes >= desde && a.mes <= hasta) acum(aportesMes, a.mes, a.montoGs);
  // Cuotas no pagadas: las vencidas se proyectan al mes que viene
  for (const p of prestamos) for (const c of p.cuotas) if (!c.pagada) acum(cuotas, Math.max(mesDeFecha(c.vencimiento), desde), c.montoGs);
  // Cuentas por pagar (sin las cuotas, que ya están en el calendario) por mes de pago
  for (const m of cxp) {
    if (m.origen === "CUOTA_PRESTAMO") continue;
    acum(porPagar, mesDePago(m.fechaVencimiento, corte) ?? desde, m.saldoGs);
  }
  const cajaHoy = cajas.cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldoGs, 0n) + cajas.sinAsignarGs;
  const ventasMes = BigInt(params?.lechonesAVenderMes ?? 0) * (params?.precioEsperadoLechonGs ?? 0n);
  const base = {
    desde, meses, saldoInicial: cajaHoy, ventasMes: () => ventasMes, otrosIngresosMes: params?.otrosIngresosMesGs ?? 0n,
    gastoOperativo, inversion, cuotas, porPagar, colchonMeses: Number(params?.colchonMesesEgreso ?? 1),
  };
  const proyeccion = proyectar({ ...base, aportes: aportesMes });
  const sinAportes = proyectar({ ...base, aportes: new Map() });
  const totalAportes = Array.from(aportesMes.values()).reduce((s, v) => s + v, 0n);
  return {
    corte, desde, cajaHoy, proyeccion, sinAportes, aportes, params, prestamos,
    preguntas: preguntasProyeccion(proyeccion, cajaHoy, totalAportes),
    // Para "¿Entra en la caja?" (8.18): flujo operativo mensual promedio proyectado, sin aportes y sin las cuotas actuales
    flujoOperativoPromedio: sinAportes.length ? sinAportes.reduce((s, m) => s + m.flujo + m.cuotas, 0n) / BigInt(sinAportes.length) : 0n,
    cuotaActual: cuotas.get(desde) ?? 0n,
  };
}
