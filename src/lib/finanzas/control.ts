// Control financiero (Fase 8, parte 4): controles del libro, estado financiero, indicadores y recomendaciones.
import "server-only";
import { cache } from "react";
import prisma from "@/lib/db/prisma";
import { cuentasConSaldo, pendientes } from "./datos";
import { datosAnio, sanidadAnio } from "./anio";
import { datosProyeccion } from "./plan-datos";
import { gs, hoyUTC, mesDe, nombreMes } from "./calculos";
import { DIETAS, NOMBRE_DIETA, hojaAlimentacion, hojaCostos, hojaFijosVariables, sumaB, sumaN } from "./hojas";
import { flujosRetorno, mesDeFecha, payback, puntoEquilibrio, resumenPrestamo, semaforoDesvio, sumarMeses, tir, van } from "./planificacion";

const DIA = 86_400_000;

// ── 8.28 · Controles del libro (todos tienen que dar 0) ───────────
export type Control = { codigo: number; nombre: string; valor: number; detalle?: string; queHacer: string; noAplica?: boolean };

export const controlesLibro = cache(async (org: string): Promise<Control[]> => {
  const hoy = hoyUTC();
  const anio = hoy.getUTCFullYear();
  const [catAjena, repetidos, sinProducto, sinMl, sanidad, ultimaSanidad, productos, ventas, ingresosVenta, cajas, dobles] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`select count(*)::bigint n from movimiento m join categoria_financiera c on c.id = m.categoria_id
      where m.organizacion_id = ${org} and c.organizacion_id is not null and c.organizacion_id <> m.organizacion_id`,
    prisma.$queryRaw<{ n: bigint }[]>`select coalesce(sum(cnt - 1), 0)::bigint n from (
      select count(*) cnt from movimiento where organizacion_id = ${org} and estado <> 'ANULADO'
      group by fecha, categoria_id, cantidad, monto_gs, concepto, coalesce(observacion, '') having count(*) > 1) x`,
    prisma.movimiento.count({ where: { organizacionId: org, estado: { not: "ANULADO" }, categoria: { nombre: "Sanidad" }, subcategoria: { in: ["Vacunas", "Medicamentos"] }, productoSanitarioId: null } }),
    prisma.movimiento.count({ where: { organizacionId: org, estado: { not: "ANULADO" }, productoSanitarioId: { not: null }, mlPorUnidad: null } }),
    sanidadAnio(org, anio),
    prisma.movimientoInventario.findFirst({ where: { tenantId: org }, orderBy: { fecha: "desc" }, select: { fecha: true } }),
    prisma.productoInventario.count({ where: { tenantId: org, categoria: { in: ["VACUNA", "MEDICAMENTO"] } } }),
    prisma.venta.aggregate({ where: { organizacionId: org, estado: "CONFIRMADA" }, _sum: { importeGs: true } }),
    prisma.movimiento.aggregate({ where: { organizacionId: org, origen: "VENTA", estado: { not: "ANULADO" } }, _sum: { montoGs: true } }),
    cuentasConSaldo(org),
    prisma.$queryRaw<{ n: bigint }[]>`select count(*)::bigint n from movimiento p join movimiento q
      on q.organizacion_id = p.organizacion_id and q.contraparte_id = p.contraparte_id and q.monto_gs = p.monto_gs and q.id <> p.id
      where p.organizacion_id = ${org} and p.estado in ('PENDIENTE', 'POR_COBRAR') and q.estado in ('PAGADO', 'COBRADO')
        and p.contraparte_id is not null and abs(p.fecha - q.fecha) <= 5`,
  ]);
  const noCierra = sanidad.filas.filter(f => f.estado === "Revisar: no cierra").length;
  const diasSanidad = ultimaSanidad ? Math.floor((hoy.getTime() - ultimaSanidad.fecha.getTime()) / DIA) : null;
  const difVentas = (ventas._sum.importeGs ?? 0n) - (ingresosVenta._sum.montoGs ?? 0n);
  const cuentasConDif = cajas.cuentas.filter(c => c.activa && c.declarado && c.declarado.diferenciaGs !== 0n);
  return [
    { codigo: 1, nombre: "Movimientos con una categoría inexistente", valor: Number(catAjena[0]?.n ?? 0), queHacer: "Corregí la categoría desde el libro (solo puede pasar en importaciones)." },
    { codigo: 2, nombre: "Movimientos repetidos (misma fecha, categoría, cantidad, monto, concepto y observación)", valor: Number(repetidos[0]?.n ?? 0), queHacer: "Revisá en Movimientos y anulá el que sobra, con motivo." },
    { codigo: 3, nombre: "Semanas de balanceado cerradas sin cargar", valor: 0, noAplica: true, queHacer: "No aplica: el balanceado se compra a proveedores (no hay fábrica)." },
    { codigo: 4, nombre: "Diferencia entre balanceado y el libro", valor: 0, noAplica: true, queHacer: "No aplica: el balanceado sale directo del libro." },
    { codigo: 5, nombre: "Compras de vacunas o medicamentos sin producto", valor: sinProducto, queHacer: "Anulá y volvé a cargar la compra eligiendo el producto del catálogo de Sanidad." },
    { codigo: 6, nombre: "Compras sanitarias sin ml por unidad", valor: sinMl, queHacer: "Volvé a cargar la compra con los ml por frasco: sin eso no hay precio por ml." },
    { codigo: 7, nombre: "Productos con stock que no cierra contra el conteo", valor: noCierra, queHacer: "Revisá en Sanidad valorizada: falta cargar una compra, un uso o un descarte." },
    { codigo: 8, nombre: "Registro de Sanidad con más de 10 días", valor: productos > 0 && (diasSanidad === null || diasSanidad > 10) ? 1 : 0, detalle: diasSanidad === null ? "Sin registros" : `Último registro hace ${diasSanidad} días`, queHacer: "Pedile a Sanidad que cargue las aplicaciones y el botiquín al día." },
    { codigo: 9, nombre: "Diferencia entre ventas e ingresos por ventas", valor: difVentas === 0n ? 0 : 1, detalle: difVentas === 0n ? undefined : gs(difVentas), queHacer: "Cada venta genera su ingreso: revisá ventas anuladas a mano en el libro." },
    { codigo: 10, nombre: "Cuentas con diferencia de conciliación de caja", valor: cuentasConDif.length, detalle: cuentasConDif.map(c => `${c.nombre}: ${gs(c.declarado!.diferenciaGs)}`).join(" · ") || undefined, queHacer: "Falta cargar (o sobra) algún cobro o pago en esa cuenta: comparalo con el extracto." },
    { codigo: 11, nombre: "Posibles dobles registros (pendiente igual a otro pagado del mismo proveedor ±5 días)", valor: Number(dobles[0]?.n ?? 0), queHacer: "Si es el mismo gasto, anulá el pendiente; si no, ignoralo." },
  ];
});

// ── 8.21 · Estado financiero actual ───────────────────────────────
export const estadoFinanciero = cache(async (org: string) => {
  const hoy = hoyUTC();
  const anio = hoy.getUTCFullYear(), mes = mesDe(hoy);
  const [cajas, cxp, cxc, proy, d, san, pagos, inversiones] = await Promise.all([
    cuentasConSaldo(org), pendientes(org, false), pendientes(org, true), datosProyeccion(org), datosAnio(org, anio), sanidadAnio(org, anio),
    prisma.pagoMovimiento.findMany({ where: { movimiento: { organizacionId: org, estado: { not: "ANULADO" }, esInterno: false } }, select: { montoGs: true, movimiento: { select: { tipo: true, signo: true, categoria: { select: { nombre: true } } } } } }),
    prisma.movimiento.findMany({ where: { organizacionId: org, tipo: "INVERSION", estado: { not: "ANULADO" } }, select: { montoGs: true, fecha: true } }),
  ]);
  const activas = cajas.cuentas.filter(c => c.activa);
  const caja = activas.filter(c => c.tipo === "CAJA" || c.tipo === "CAJA_CHICA" || c.tipo === "OTRA").reduce((s, c) => s + c.saldoGs, 0n) + cajas.sinAsignarGs;
  const bancos = activas.filter(c => c.tipo === "BANCO" || c.tipo === "COOPERATIVA");
  const porCobrar = cxc.reduce((s, m) => s + m.saldoGs, 0n);
  const porPagar = cxp.filter(m => m.origen !== "CUOTA_PRESTAMO").reduce((s, m) => s + m.saldoGs, 0n);
  const prestamos = proy.prestamos.filter(p => p.estado === "VIGENTE").reduce((s, p) => s + resumenPrestamo(p, p.cuotas, hoy).saldo, 0n);
  const totalBancos = bancos.reduce((s, c) => s + c.saldoGs, 0n);
  const disponibles = caja + totalBancos + porCobrar;
  const cuotaMes = proy.prestamos.reduce((s, p) => s + p.cuotas.filter(c => !c.pagada && mesDeFecha(c.vencimiento) <= mes).reduce((t, c) => t + c.montoGs, 0n), 0n);
  const cuotas3 = proy.prestamos.reduce((s, p) => s + p.cuotas.filter(c => !c.pagada && mesDeFecha(c.vencimiento) <= sumarMeses(mes, 3)).reduce((t, c) => t + c.montoGs, 0n), 0n);
  const costos = hojaCostos(d.movs, d.inversiones, d.prod, d.matricesPorMes, d.params, anio, san.usadoPorMes, mesDe(hoyUTC()));
  const ingresosAnio = d.movs.filter(m => m.tipo === "INGRESO" && !m.esInterno).reduce((s, m) => s + m.montoGs, 0n);
  const balanceado = sumaB(costos.subAlim);
  // ¿De dónde salió la plata? (todo por lo efectivamente cobrado y pagado)
  const sumaP = (f: (p: (typeof pagos)[number]) => boolean) => pagos.filter(f).reduce((s, p) => s + p.montoGs, 0n);
  const prestamosRecibidos = sumaP(p => p.movimiento.categoria.nombre === "Préstamo recibido");
  const aportes = sumaP(p => p.movimiento.categoria.nombre === "Aporte de capital");
  const cobrados = sumaP(p => p.movimiento.tipo === "INGRESO");
  const egresosPagados = sumaP(p => p.movimiento.tipo === "GASTO" || p.movimiento.tipo === "INVERSION");
  const cuotasPagadas = sumaP(p => p.movimiento.categoria.nombre === "Pago de cuota de préstamo");
  const otrosFin = sumaP(p => p.movimiento.categoria.nombre === "Intereses y comisiones" || p.movimiento.categoria.nombre === "Retiro del titular");
  const saldosIniciales = cajas.cuentas.reduce((s, c) => s + c.saldoInicialGs, 0n);
  const segunMovimientos = saldosIniciales + prestamosRecibidos + aportes + cobrados - egresosPagados - cuotasPagadas - otrosFin;
  const declarados = activas.filter(c => c.declarado);
  const declarado = declarados.length === activas.length && activas.length > 0 ? declarados.reduce((s, c) => s + c.declarado!.saldoGs, 0n) : null;
  const invHist = inversiones.filter(i => i.fecha.getTime() <= hoy.getTime()).reduce((s, i) => s + i.montoGs, 0n);
  const invTotal = inversiones.reduce((s, i) => s + i.montoGs, 0n);
  return {
    activos: { caja, bancos: bancos.map(b => ({ nombre: b.nombre, saldoGs: b.saldoGs })), porCobrar, total: disponibles },
    obligaciones: { porPagar, prestamos, total: porPagar + prestamos },
    posicion: {
      capitalTrabajo: caja + totalBancos + porCobrar - porPagar,
      posicionNeta: disponibles - (porPagar + prestamos),
      comprometido: porPagar + cuotas3,
      cajaDisponible: caja + totalBancos - porPagar - cuotaMes,
    },
    resultado: { ingresos: ingresosAnio, costo: sumaB(costos.conAmort), resultado: ingresosAnio - sumaB(costos.conAmort), balanceado, restoGranja: sumaB(costos.conAmort) - balanceado },
    inversiones: { historica: invHist, nueva: invTotal - invHist, total: invTotal },
    conciliacion: { saldosIniciales, prestamosRecibidos, aportes, cobrados, egresosPagados, cuotasPagadas, otrosFin, segunMovimientos, declarado, diferencia: declarado === null ? null : declarado - segunMovimientos },
    cuotaMes, cajaMasBancos: caja + totalBancos,
  };
});

// ── 8.22 · Indicadores ────────────────────────────────────────────
export type Indicador = { nombre: string; calculo: string; valor: string; meta?: string; estado?: "ok" | "atencion" | "mal" };

export const indicadores = cache(async (org: string) => {
  const hoy = hoyUTC();
  const anio = hoy.getUTCFullYear(), mes = mesDe(hoy), i = (mes % 100) - 1;
  const [e, d, san, proy, cxc, cxp, params, capital] = await Promise.all([
    estadoFinanciero(org), datosAnio(org, anio), sanidadAnio(org, anio), datosProyeccion(org), pendientes(org, true), pendientes(org, false),
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.movimiento.aggregate({ where: { organizacionId: org, estado: { not: "ANULADO" }, categoria: { nombre: "Aporte de capital" } }, _sum: { montoGs: true } }),
  ]);
  const c = hojaCostos(d.movs, d.inversiones, d.prod, d.matricesPorMes, d.params, anio, san.usadoPorMes, mesDe(hoyUTC()));
  const fv = hojaFijosVariables(d.movs, mes);
  const ingMes = d.movs.filter(m => m.tipo === "INGRESO" && m.mes === mes && !m.esInterno).reduce((s, m) => s + m.montoGs, 0n);
  const gasMes = d.movs.filter(m => m.tipo === "GASTO" && m.mes === mes && !m.esInterno).reduce((s, m) => s + m.montoGs, 0n);
  const ingAnio = d.movs.filter(m => m.tipo === "INGRESO" && !m.esInterno).reduce((s, m) => s + m.montoGs, 0n);
  const gasAnio = sumaB(fv.total);
  const entregados = d.prod[i]?.entregados ?? 0;
  const pe = puntoEquilibrio(Number(fv.fijos[i]), Number(fv.variables[i]), entregados, Number(params?.precioReferenciaLechonGs ?? 435000n));
  const egresoProm = gasAnio > 0n ? Number(gasAnio) / Math.max(1, mes % 100) : 0;
  const cobertura = egresoProm > 0 ? Number(e.cajaMasBancos) / (egresoProm / 30) : null;
  const vencidoCxc = cxc.filter(m => m.fechaVencimiento && m.fechaVencimiento < hoy).reduce((s, m) => s + m.saldoGs, 0n);
  const vencidoCxp = cxp.filter(m => m.fechaVencimiento && m.fechaVencimiento < hoy).reduce((s, m) => s + m.saldoGs, 0n);
  const liquidez = e.obligaciones.porPagar > 0n ? (Number(e.cajaMasBancos) + Number(e.activos.porCobrar)) / Number(e.obligaciones.porPagar) : null;
  // Retorno: año 1 = 12 primeros meses proyectados de (ventas + otros − gasto operativo − cuotas), sin aportes
  const anio1 = proy.sinAportes.slice(0, 12).reduce((s, m) => s + Number(m.ventas + m.otrosIngresos - m.gastoOperativo - m.cuotas), 0);
  const flujos = flujosRetorno(Number(e.inversiones.total), anio1, Number(params?.crecimientoFlujoAnual ?? 0.1));
  const tasa = Number(params?.tasaDescuentoVan ?? 0.12);
  const t = tir(flujos), pb = payback(flujos);
  const meta = params?.metaCoberturaDias ?? 30, alerta = params?.alertaCoberturaDias ?? 20;
  const p = (x: number | null) => (x === null ? "—" : `${(x * 100).toLocaleString("es-PY", { maximumFractionDigits: 1 })} %`);
  const signo = (v: bigint | number): Indicador["estado"] => (Number(v) >= 0 ? "ok" : "mal");
  const partAlim = c.unit.participacionAlimento[i];

  const operacion: Indicador[] = [
    { nombre: `Ingresos de ${nombreMes(mes)}`, calculo: "Ingresos del mes (devengado)", valor: gs(ingMes) },
    { nombre: `Egresos de ${nombreMes(mes)}`, calculo: "Gastos del mes (devengado)", valor: gs(gasMes) },
    { nombre: `Ingresos del año`, calculo: "Suma de ingresos de enero a hoy", valor: gs(ingAnio) },
    { nombre: "Egresos del año", calculo: "Suma de gastos de enero a hoy", valor: gs(gasAnio) },
    { nombre: "Resultado operativo del año", calculo: "Ingresos − gastos del año", valor: gs(ingAnio - gasAnio), meta: "Positivo", estado: signo(ingAnio - gasAnio) },
    { nombre: "Balanceado comprado en el año", calculo: "Categorías de alimentación", valor: gs(sumaB(c.subAlim)) },
    { nombre: "Gastos fijos / variables del año", calculo: "Según la naturaleza de cada categoría", valor: `${gs(sumaB(fv.fijos))} / ${gs(sumaB(fv.variables))}` },
  ];
  const produccion: Indicador[] = [
    { nombre: "Lechones entregados / destetados del mes", calculo: "Ventas y destetes registrados", valor: `${entregados} / ${d.prod[i]?.destetados ?? 0}` },
    { nombre: "Costo total del mes", calculo: "Con amortización", valor: gs(c.conAmort[i]) },
    { nombre: "Costo por lechón entregado", calculo: "Costo del mes ÷ entregados", valor: c.unit.costoPorEntregado[i] === null ? "Sin ventas en el mes" : gs(Math.round(c.unit.costoPorEntregado[i]!)) },
    { nombre: "Precio promedio por lechón", calculo: "Ingreso por lechones ÷ entregados", valor: c.unit.precioPromedio[i] === null ? "—" : gs(Math.round(c.unit.precioPromedio[i]!)) },
    { nombre: "Margen por lechón", calculo: "Precio − costo", valor: c.unit.margenPorLechon[i] === null ? "—" : gs(Math.round(c.unit.margenPorLechon[i]!)), meta: "Positivo y creciente", estado: c.unit.margenPorLechon[i] === null ? undefined : signo(c.unit.margenPorLechon[i]!) },
    { nombre: "Costo por matriz al mes", calculo: "Costo del mes ÷ matrices activas", valor: c.unit.costoPorMatriz[i] === null ? "—" : gs(Math.round(c.unit.costoPorMatriz[i]!)) },
    { nombre: "Alimento por matriz al mes", calculo: "Alimento del mes ÷ matrices", valor: c.unit.alimentoPorMatriz[i] === null ? "—" : gs(Math.round(c.unit.alimentoPorMatriz[i]!)) },
    { nombre: "Participación del alimento en el costo", calculo: "Alimento ÷ costo total", valor: p(partAlim), meta: "65 % a 75 %", estado: partAlim === null ? undefined : partAlim >= 0.65 && partAlim <= 0.75 ? "ok" : "atencion" },
    { nombre: "Punto de equilibrio", calculo: "Gasto fijo ÷ (precio de referencia − gasto variable por lechón)", valor: pe.valor === null ? pe.mensaje! : `${Math.ceil(pe.valor)} lechones por mes`, estado: pe.valor !== null && entregados >= pe.valor ? "ok" : pe.valor !== null ? "atencion" : undefined },
  ];
  const caja: Indicador[] = [
    { nombre: "Caja + bancos", calculo: "Saldo calculado de las cuentas", valor: gs(e.cajaMasBancos) },
    { nombre: "Caja realmente disponible", calculo: "Caja + bancos − por pagar − cuota del mes", valor: gs(e.posicion.cajaDisponible), estado: signo(e.posicion.cajaDisponible) },
    { nombre: "Cobertura de caja", calculo: "Saldo ÷ (egreso promedio mensual ÷ 30)", valor: cobertura === null ? "—" : `${Math.round(cobertura)} días`, meta: `≥ ${meta} días (alerta < ${alerta})`, estado: cobertura === null ? undefined : cobertura >= meta ? "ok" : cobertura < alerta ? "mal" : "atencion" },
    { nombre: "Capital de trabajo", calculo: "Disponible + por cobrar − por pagar", valor: gs(e.posicion.capitalTrabajo), meta: "Positivo", estado: signo(e.posicion.capitalTrabajo) },
    { nombre: "Liquidez corriente", calculo: "(Caja + bancos + por cobrar) ÷ por pagar", valor: liquidez === null ? "Sin deudas con proveedores" : liquidez.toLocaleString("es-PY", { maximumFractionDigits: 2 }), meta: "≥ 1,0", estado: liquidez === null ? "ok" : liquidez >= 1 ? "ok" : "mal" },
    { nombre: "Deuda financiera pendiente", calculo: "Cuotas que faltan pagar", valor: gs(e.obligaciones.prestamos) },
    { nombre: "Cuota mensual", calculo: "Cuotas de este mes (y atrasadas)", valor: gs(e.cuotaMes) },
    { nombre: "Endeudamiento sobre la inversión", calculo: "Deuda ÷ inversión acumulada", valor: e.inversiones.total > 0n ? p(Number(e.obligaciones.prestamos) / Number(e.inversiones.total)) : "—" },
    { nombre: "Cuentas por pagar vencidas", calculo: "Saldo vencido", valor: gs(vencidoCxp), meta: "₲ 0", estado: vencidoCxp === 0n ? "ok" : "mal" },
    { nombre: "Cuentas por cobrar vencidas", calculo: "Saldo vencido", valor: gs(vencidoCxc), meta: "₲ 0", estado: vencidoCxc === 0n ? "ok" : "mal" },
    { nombre: "Inversión acumulada", calculo: "Todas las inversiones", valor: gs(e.inversiones.total) },
    { nombre: "Capital propio aportado", calculo: "Movimientos «Aporte de capital»", valor: gs(capital._sum.montoGs ?? 0n) },
  ];
  const retorno: Indicador[] = [
    { nombre: "Flujo del año 1 (proyectado, sin aportes)", calculo: "Ventas + otros − gasto operativo − cuotas de los próximos 12 meses", valor: gs(Math.round(anio1)) },
    { nombre: "ROI a 5 años", calculo: "Σ flujos años 1 a 5 ÷ inversión", valor: e.inversiones.total > 0n ? p(flujos.slice(1).reduce((s, x) => s + x, 0) / Number(e.inversiones.total)) : "—" },
    { nombre: `VAN al ${p(tasa)}`, calculo: "Valor actual de los flujos menos la inversión", valor: gs(Math.round(van(flujos, tasa))), estado: van(flujos, tasa) >= 0 ? "ok" : "mal" },
    { nombre: "TIR", calculo: "Tasa que hace VAN = 0", valor: t === null ? "No calculable: los flujos no cambian de signo" : p(t) },
    { nombre: "Payback", calculo: "Años hasta recuperar la inversión", valor: pb === null ? "No se recupera dentro de los 5 años" : `${pb.toLocaleString("es-PY", { maximumFractionDigits: 1 })} años` },
  ];
  return { operacion, produccion, caja, retorno, flujos, notaTir: anio1 < 0 };
});

// ── 8.25 · Recomendaciones automáticas ────────────────────────────
export type Rec = { codigo: string; problema: string; situacion: string; mejora: string; impacto: string; prioridad: "ALTA" | "MEDIA" | "BAJA"; accion: string };

export async function calcularRecomendaciones(org: string, mes: number): Promise<Rec[]> {
  const anio = Math.floor(mes / 100), i = (mes % 100) - 1;
  const [ctrl, d, san, proy, params, aportesDesglosar, vencidosSinPagar, presCargas, presSueldos] = await Promise.all([
    controlesLibro(org), datosAnio(org, anio), sanidadAnio(org, anio), datosProyeccion(org),
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.movimiento.count({ where: { organizacionId: org, estado: { not: "ANULADO" }, categoria: { nombre: "Aporte de capital" }, OR: [{ observacion: { contains: "DESGLOSAR", mode: "insensitive" } }, { concepto: { contains: "DESGLOSAR", mode: "insensitive" } }, { observacion: { contains: "POR DIFERENCIA", mode: "insensitive" } }] } }),
    prisma.movimiento.count({ where: { organizacionId: org, estado: { in: ["PENDIENTE", "POR_COBRAR"] }, fechaVencimiento: { lt: new Date(hoyUTC().getTime() - 10 * DIA) } } }),
    prisma.presupuesto.count({ where: { organizacionId: org, mes: { gte: anio * 100 + 1, lte: anio * 100 + 12 }, categoriaId: { in: (await prisma.categoriaFinanciera.findMany({ where: { organizacionId: null, nombre: "Cargas sociales (IPS y aguinaldo)" }, select: { id: true } })).map(c => c.id) } } }),
    prisma.movimiento.count({ where: { organizacionId: org, estado: { not: "ANULADO" }, mes: { gte: anio * 100 + 1, lte: mes }, categoria: { nombre: { in: ["Personal producción", "Personal administración"] } } } }),
  ]);
  const out: Rec[] = [];
  const c = hojaCostos(d.movs, d.inversiones, d.prod, d.matricesPorMes, d.params, anio, san.usadoPorMes, mesDe(hoyUTC()));
  const alim = hojaAlimentacion(d.movs, d.prod, d.matricesPorMes);
  if (aportesDesglosar > 0) out.push({ codigo: "REC-01", prioridad: "ALTA", problema: "Capital propio cargado como una sola cifra", situacion: `${aportesDesglosar} aporte(s) cargados como una cifra global («a desglosar» o calculados por diferencia).`, mejora: "Documentar cada aporte con fecha, monto y comprobante, como si fuera un préstamo.", impacto: "Saber cuánto puso el titular y cuándo, y poder medir el retorno real.", accion: "Anulá la cifra global y cargá cada aporte por separado en Movimientos." });
  const dobles = ctrl.find(x => x.codigo === 11)?.valor ?? 0;
  if (dobles > 0) out.push({ codigo: "REC-02", prioridad: "ALTA", problema: "Posible doble registro", situacion: `${dobles} pendiente(s) coinciden con un pago del mismo proveedor y monto en ±5 días.`, mejora: "Un gasto se carga una sola vez y después se registra su pago.", impacto: "Las cuentas por pagar y la proyección dejan de inflarse.", accion: "Revisá Por pagar y anulá los duplicados." });
  if (vencidosSinPagar > 0) out.push({ codigo: "REC-03", prioridad: "ALTA", problema: "Pagos o cobros sin registrar", situacion: `${vencidosSinPagar} movimiento(s) vencidos hace más de 10 días siguen pendientes.`, mejora: "Registrar cada pago o cobro el día que ocurre.", impacto: "La caja calculada coincide con la real y la proyección es confiable.", accion: "Entrá a Por pagar / Por cobrar y registrá lo que ya se pagó o cobró." });
  const faltaPrecio = DIETAS.filter(dd => alim.kg[dd].slice(0, i).some(k => k > 0) && alim.kg[dd][i] === 0 && alim.gs[dd][i] === 0n);
  const sinKg = DIETAS.filter(dd => alim.gs[dd][i] > 0n && alim.kg[dd][i] === 0);
  if (sinKg.length) out.push({ codigo: "REC-05", prioridad: "ALTA", problema: "Falta el precio por kilo de alguna dieta", situacion: `Compras sin kilos en ${nombreMes(mes)}: ${sinKg.map(x => NOMBRE_DIETA[x]).join(", ")}.`, mejora: "Cargar siempre la cantidad en kg en las compras de balanceado.", impacto: "Precio por kilo, costo por lechón y proyección correctos.", accion: "Anulá y volvé a cargar esas compras con los kilos." });
  else if (faltaPrecio.length) out.push({ codigo: "REC-05", prioridad: "MEDIA", problema: "Mes sin compras de alguna dieta", situacion: `Sin compras en ${nombreMes(mes)}: ${faltaPrecio.map(x => NOMBRE_DIETA[x]).join(", ")} (se usa el precio del mes anterior).`, mejora: "Confirmar que no se compró o cargar la compra.", impacto: "El costo de alimento del mes queda completo.", accion: "Revisá las facturas de balanceado del mes." });
  const mejorVenta = d.prod.reduce((m, x) => (x.ingresosLechonesGs > m ? x.ingresosLechonesGs : m), 0n);
  const cuota = proy.cuotaActual;
  if (mejorVenta > 0n && Number(cuota) > Number(mejorVenta) * 0.4) out.push({ codigo: "REC-06", prioridad: "ALTA", problema: "La cuota de préstamos es muy alta para las ventas", situacion: `Cuota mensual ${gs(cuota)} = ${Math.round(Number(cuota) * 100 / Number(mejorVenta))} % del mejor mes de ventas (${gs(mejorVenta)}).`, mejora: "Refinanciar a más plazo o a menor tasa (ver el ranking en Deudas).", impacto: "Menos riesgo de quedar sin caja en un mes flojo.", accion: "Hablá con el banco del préstamo de mayor tasa." });
  const part = c.unit.participacionAlimento[i];
  if (part !== null && part < 0.65) out.push({ codigo: "REC-07", prioridad: "ALTA", problema: "La estructura fija es grande para la cantidad de animales", situacion: `El alimento es el ${Math.round(part * 100)} % del costo de ${nombreMes(mes)} (referencia 65 % a 75 %).`, mejora: "Crecer en madres con la misma estructura o achicar gastos fijos.", impacto: "Baja el costo por lechón.", accion: "Revisá Fijos y variables y el costo por matriz." });
  if ((params?.imputacionSanidad ?? "USO") === "COMPRA") out.push({ codigo: "REC-08", prioridad: "MEDIA", problema: "La sanidad entra al costo cuando se compra", situacion: "Un mes con compra grande de vacunas parece caro y el siguiente barato.", mejora: "Imputar la sanidad por uso (cuando se aplica).", impacto: "Costo por lechón más estable y real.", accion: "Cambialo en Parámetros → La sanidad entra al costo." });
  if (presSueldos > 0 && presCargas === 0) out.push({ codigo: "REC-09", prioridad: "MEDIA", problema: "Sueldos sin provisión de aguinaldo e IPS", situacion: `Hay sueldos cargados en ${anio} y ninguna carga social presupuestada.`, mejora: "Provisionar el aguinaldo (1/12) y el IPS patronal cada mes.", impacto: "Diciembre deja de ser una sorpresa en la caja.", accion: "En Presupuesto, tocá «Calcular cargas sociales»." });
  const atipicos = await contarAtipicos(org, mes);
  if (atipicos > 0) out.push({ codigo: "REC-11", prioridad: "MEDIA", problema: "Precios unitarios atípicos", situacion: `${atipicos} compra(s) de ${nombreMes(mes)} con precio más de 20 % lejos del promedio de su categoría.`, mejora: "Revisar que la cantidad y el monto estén bien cargados.", impacto: "Costos e indicadores sin errores de carga.", accion: "Revisá los movimientos del mes con cantidad." });
  const pr = d.prod[i];
  const metaMort = 0.1;
  if (pr && pr.nacidosVivos > 0 && pr.muertosLactancia / pr.nacidosVivos > metaMort) out.push({ codigo: "REC-12", prioridad: "MEDIA", problema: "Mortalidad predestete alta", situacion: `${Math.round(pr.muertosLactancia * 1000 / pr.nacidosVivos) / 10} % en ${nombreMes(mes)} (meta ≤ ${metaMort * 100} %).`, mejora: "Revisar las causas de muerte en Maternidad con el veterinario.", impacto: "Más lechones para vender con el mismo costo.", accion: "Mirá las muertes por causa en Maternidad." });
  const critico = proy.proyeccion.find(m => m.alerta !== "OK");
  if (critico) out.push({ codigo: "REC-14", prioridad: "ALTA", problema: critico.alerta === "SIN CAJA" ? "La proyección se queda sin caja" : "La proyección queda ajustada", situacion: `${nombreMes(critico.mes)}: saldo proyectado ${gs(critico.saldoFinal)} con egresos de ${gs(critico.egresos)}.`, mejora: "Mover vencimientos, pedir un aporte o financiar con anticipación.", impacto: "Evitar atrasos con proveedores y bancos.", accion: "Revisá la Proyección y cargá un aporte previsto o reprogramá pagos." });
  return out;
}

async function contarAtipicos(org: string, mes: number) {
  const movs = await prisma.movimiento.findMany({ where: { organizacionId: org, estado: { not: "ANULADO" }, mes, cantidad: { gt: 0 }, tipo: "GASTO" }, select: { categoriaId: true, precioUnitarioGs: true, fecha: true } });
  let n = 0;
  for (const m of movs) {
    const prev = await prisma.movimiento.aggregate({ where: { organizacionId: org, categoriaId: m.categoriaId, estado: { not: "ANULADO" }, cantidad: { gt: 0 }, fecha: { gte: new Date(m.fecha.getTime() - 92 * DIA), lt: m.fecha } }, _sum: { montoGs: true, cantidad: true } });
    const prom = prev._sum.cantidad && Number(prev._sum.cantidad) > 0 ? Number(prev._sum.montoGs ?? 0n) / Number(prev._sum.cantidad) : null;
    if (prom && m.precioUnitarioGs && Math.abs(Number(m.precioUnitarioGs) - prom) / prom > 0.2) n++;
  }
  return n;
}

export { sumaN, semaforoDesvio };

// ── 8.27 · Cierre de mes ──────────────────────────────────────────
export type PasoCierre = { clave: string; nombre: string; ok: boolean; detalle: string; manual?: boolean };

export async function evaluarCierre(org: string, mes: number, manual: Record<string, boolean> = {}): Promise<PasoCierre[]> {
  const inicio = new Date(Date.UTC(Math.floor(mes / 100), (mes % 100) - 1, 1));
  const anio = Math.floor(mes / 100);
  const [ctrl, cajas, params, pres, real, causas] = await Promise.all([
    controlesLibro(org), cuentasConSaldo(org),
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.presupuesto.groupBy({ by: ["categoriaId"], where: { organizacionId: org, mes: { gte: anio * 100 + 1, lte: mes } }, _sum: { montoGs: true } }),
    prisma.movimiento.groupBy({ by: ["categoriaId"], where: { organizacionId: org, estado: { not: "ANULADO" }, esInterno: false, tipo: { in: ["GASTO", "INVERSION"] }, mes: { gte: anio * 100 + 1, lte: mes } }, _sum: { montoGs: true } }),
    prisma.causaDesvio.findMany({ where: { organizacionId: org, mes }, select: { categoriaId: true } }),
  ]);
  const fallan = ctrl.filter(c => !c.noAplica && c.valor !== 0);
  const sanidad = ctrl.find(c => c.codigo === 8)!;
  const activas = cajas.cuentas.filter(c => c.activa);
  const sinDeclarar = activas.filter(c => !c.declarado || c.declarado.fecha.getTime() < inicio.getTime());
  const conDif = activas.filter(c => c.declarado && c.declarado.diferenciaGs !== 0n);
  const meta = Number(params?.metaDesvio ?? 0.05), alerta = Number(params?.alertaDesvio ?? 0.1);
  const conCausa = new Set(causas.map(c => c.categoriaId));
  const explicar = pres.filter(p => {
    const r = real.find(x => x.categoriaId === p.categoriaId)?._sum.montoGs ?? 0n;
    return semaforoDesvio(p._sum.montoGs ?? 0n, r, meta, alerta).semaforo === "EXPLICAR" && !conCausa.has(p.categoriaId);
  }).length;
  return [
    { clave: "controles", nombre: "Todos los controles del libro en cero", ok: fallan.length === 0, detalle: fallan.length ? `Fallan: ${fallan.map(f => `${f.codigo}`).join(", ")}` : "OK" },
    { clave: "produccion", nombre: "Datos de producción del mes revisados por la Jefatura de Producción", ok: !!manual.produccion, detalle: "Confirmación manual", manual: true },
    { clave: "sanidad", nombre: "Registro de Sanidad con 10 días o menos", ok: sanidad.valor === 0, detalle: sanidad.detalle ?? "OK" },
    { clave: "balanceado", nombre: "Compras de balanceado del mes cargadas (con kilos)", ok: !!manual.balanceado, detalle: "Confirmación manual", manual: true },
    { clave: "conciliacion", nombre: "Saldo de caja contado y extractos declarados, sin diferencia", ok: activas.length > 0 && sinDeclarar.length === 0 && conDif.length === 0, detalle: activas.length === 0 ? "No hay cuentas" : sinDeclarar.length ? `Falta declarar: ${sinDeclarar.map(c => c.nombre).join(", ")}` : conDif.length ? `Con diferencia: ${conDif.map(c => c.nombre).join(", ")}` : "OK" },
    { clave: "causas", nombre: "Causa escrita para cada desvío a explicar", ok: explicar === 0, detalle: explicar ? `${explicar} desvío(s) sin causa` : "OK" },
    { clave: "pendientes", nombre: "Pendientes del mes con el estado correcto", ok: !!manual.pendientes, detalle: "Confirmación manual", manual: true },
  ];
}
