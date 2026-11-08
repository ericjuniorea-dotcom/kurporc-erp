/**
 * Prueba de la Fase 8: cálculos puros de Finanzas (tramos, estados, mes de pago, saldos, formato).
 *   npm run prueba:finanzas
 */
import { estadoCuentaDe, fechaISO, finDeMes, gs, hoyUTC, mesDe, mesDePago, pct, saldoCuenta, tramoDe } from "@/lib/finanzas/calculos";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }

const corte = fechaISO("2026-09-30");
check(mesDe(fechaISO("2026-09-15")) === 202609, "mes AAAAMM de una fecha");
check(finDeMes(corte, 1).toISOString().slice(0, 10) === "2026-10-31", "fin del mes siguiente");

// Tramos (8.6 / 8.7) con fecha de corte 30/09/2026
check(tramoDe(fechaISO("2026-09-29"), corte, 10n) === "Vencido", "tramo: vencido");
check(tramoDe(fechaISO("2026-10-07"), corte, 10n) === "Esta semana", "tramo: esta semana (≤ corte + 7)");
check(tramoDe(fechaISO("2026-10-20"), corte, 10n) === "Próximo mes", "tramo: próximo mes");
check(tramoDe(fechaISO("2026-12-31"), corte, 10n) === "Próximos 3 meses", "tramo: próximos 3 meses");
check(tramoDe(fechaISO("2027-02-01"), corte, 10n) === "Más adelante", "tramo: más adelante");
check(tramoDe(null, corte, 10n) === "Sin fecha", "tramo: sin fecha");
check(tramoDe(fechaISO("2026-09-01"), corte, 0n) === "–", "tramo: pagado = –");
const corte2 = fechaISO("2026-09-10");
check(tramoDe(fechaISO("2026-09-25"), corte2, 10n) === "Este mes", "tramo: este mes");

// Estados
check(estadoCuentaDe(0n, 0n, null, corte, false) === "FALTA IMPORTE", "estado: falta importe");
check(estadoCuentaDe(100n, 0n, null, corte, true) === "COBRADO", "estado: cobrado");
check(estadoCuentaDe(100n, 0n, null, corte, false) === "PAGADO", "estado: pagado");
check(estadoCuentaDe(100n, 50n, null, corte, false) === "SIN VENCIMIENTO", "estado: sin vencimiento");
check(estadoCuentaDe(100n, 50n, fechaISO("2026-09-01"), corte, false) === "VENCIDO", "estado: vencido");
check(estadoCuentaDe(100n, 50n, fechaISO("2026-10-15"), corte, false) === "PENDIENTE", "estado: pendiente");

// Mes de pago: nunca antes del mes siguiente al corte
check(mesDePago(fechaISO("2026-08-15"), corte) === 202610, "mes de pago: lo vencido va al mes que viene");
check(mesDePago(fechaISO("2026-12-05"), corte) === 202612, "mes de pago: el del vencimiento si es posterior");

// Saldo de una cuenta: saldo inicial + cobros − pagos desde la fecha del saldo inicial
const cuenta = { saldoInicialGs: 1_000_000n, fechaSaldoInicial: fechaISO("2026-09-01") };
const pagos = [
  { montoGs: 500_000n, signo: 1, fechaPago: fechaISO("2026-09-05") },
  { montoGs: 200_000n, signo: -1, fechaPago: fechaISO("2026-09-10") },
  { montoGs: 999_999n, signo: -1, fechaPago: fechaISO("2026-08-31") }, // antes del saldo inicial: no cuenta
];
check(saldoCuenta(cuenta, pagos) === 1_300_000n, "saldo de cuenta");
check(saldoCuenta(cuenta, pagos, fechaISO("2026-09-06")) === 1_500_000n, "saldo de cuenta a una fecha");

check(gs(3_500_000n) === "₲ 3.500.000" && gs(-1500n) === "−₲ 1.500" && gs(null) === "—", "formato en guaraníes");
check(pct(25n, 100n) === 25 && pct(1n, 0n) === null, "porcentaje sin dividir por cero");
check(hoyUTC(new Date("2026-11-09T02:00:00Z"), "America/Asuncion").toISOString().slice(0, 10) === "2026-11-08", "la fecha de corte usa la hora local de la organización");
console.log("\nOK — cálculos de Finanzas verificados");

// ── Parte 2: hojas ────────────────────────────────────────────────
import { amortizacionMensual, filaSanidad, hojaAlimentacion, hojaCostos, hojaFijosVariables, type MovHoja, type ParamsHojas, type ProdMes } from "@/lib/finanzas/hojas";
import { convertirParametro, PARAMETROS } from "@/lib/finanzas/parametros";

const cat = (nombre: string, extra: Partial<MovHoja["categoria"]> = {}): MovHoja["categoria"] => ({ id: nombre, nombre, naturaleza: "VARIABLE", area: "Producción", grupoCosto: null, dieta: null, vidaUtil: null, ...extra });
const mov = (mes: number, tipo: MovHoja["tipo"], monto: bigint, c: MovHoja["categoria"], cantidad: number | null = null): MovHoja =>
  ({ mes, tipo, montoGs: monto, cantidad, fecha: new Date(Date.UTC(Math.floor(mes / 100), (mes % 100) - 1, 15)), esInterno: false, categoria: c });
const gest = cat("Balanceado de gestación", { grupoCosto: "ALIMENTACION", dieta: "GESTACION" });
const vilo = cat("Vilo Baby", { grupoCosto: "ALIMENTACION", dieta: "VILO_BABY" });
const energia = cat("Energía", { naturaleza: "FIJO", grupoCosto: "OTROS_DIRECTOS" });
const admin = cat("Personal administración", { naturaleza: "FIJO", grupoCosto: "ESTRUCTURA" });
const obra = cat("Obra civil", { vidaUtil: "OBRA" });
const movs: MovHoja[] = [
  mov(202601, "GASTO", 3_500_000n, gest, 1000), mov(202603, "GASTO", 4_000_000n, gest, 1000), mov(202601, "GASTO", 800_000n, vilo, 100),
  mov(202601, "GASTO", 500_000n, energia), mov(202601, "GASTO", 2_000_000n, admin), mov(202601, "INGRESO", 9_000_000n, cat("Venta de lechones")),
];
const prod: ProdMes[] = Array.from({ length: 12 }, (_, i) => ({ servicios: 0, partos: 0, nacidosTotales: 0, nacidosVivos: 0, muertosAlNacer: 0, destetados: i === 0 ? 40 : 0, muertosLactancia: 0, entregados: i === 0 ? 20 : 0, kgEntregados: i === 0 ? 500 : 0, ingresosLechonesGs: i === 0 ? 9_000_000n : 0n }));
const matrices = Array(12).fill(10);
const al = hojaAlimentacion(movs, prod, matrices);
check(al.precio.GESTACION[0] === 3500 && al.precio.GESTACION[1] === 3500 && al.precio.GESTACION[2] === 4000, "alimentación: precio por kilo y mes sin compras repite el anterior");
check(al.totalGs[0] === 4_300_000n && al.indicadores.porMatriz[0] === 430_000, "alimentación: total y alimento por matriz");
check(al.indicadores.porDestetado[0] === 20_000, "alimentación: alimento de lechones por destetado");
const P: ParamsHojas = { vidaObraAnios: 20, vidaEquiposAnios: 10, modoAmortizacion: "POR_ACTIVO", amortizarMatrices: false, vidaMatrizMeses: 36, valorDescarteMatrizGs: 2_000_000n, imputacionSanidad: "COMPRA" };
const inv = [mov(202603, "INVERSION", 240_000_000n, obra)];
const am = amortizacionMensual(inv, P, 2026);
check(am[2] === 0n && am[3] === 1_000_000n && am[11] === 1_000_000n, "amortización por activo: desde el mes siguiente (240 M ÷ 240 meses)");
const amP = amortizacionMensual(inv, { ...P, modoAmortizacion: "PLANILLA" }, 2026);
check(amP[0] === 1_000_000n, "amortización como la planilla: desde enero");
const co = hojaCostos(movs, inv, prod, matrices, P, 2026);
check(co.sinAmort[0] === 6_800_000n && co.unit.costoPorEntregado[0] === 340_000, "costos: total del mes y costo por lechón entregado");
check(co.unit.precioPromedio[0] === 450_000 && co.unit.margenPorLechon[0] === 110_000, "costos: precio promedio y margen por lechón");
check(co.unit.costoPorEntregado[1] === null, "costos: mes sin ventas = sin costo por lechón");
const fv = hojaFijosVariables(movs, 202603);
check(fv.fijos[0] === 2_500_000n && fv.variables[0] === 4_300_000n && fv.detalle[0].promedioMensual === 2_500_000n, "fijos y variables, y promedio mensual hasta el corte");
const s1 = filaSanidad({ id: "v", nombre: "Vacuna", tipo: "VACUNA", unidadMedida: "DOSIS", dosisMl: 2, compradoUnidades: 10, compradoMl: 500, compradoGs: 1_000_000n, precioListaPorMl: null, usadoCantidad: 100, stockCantidad: 150, conteoCantidad: null });
check(s1.precioMl === 2000 && s1.usadoMl === 200 && s1.costoUsadoGs === 400_000n && s1.estado === "Sin conteo: stock teórico", "sanidad: precio por ml, uso en ml y costo de lo usado");
const s2 = filaSanidad({ ...s1, compradoMl: 0 });
check(s2.estado === "FALTAN los ml por unidad", "sanidad: compra sin ml por unidad");
const pDec = PARAMETROS.find(p => p.clave === "pesoVentaKg")!, pGs = PARAMETROS.find(p => p.clave === "precioKgVivoGs")!, pPct = PARAMETROS.find(p => p.clave === "tasaIpsPatronal")!;
check(convertirParametro(pDec, "2,5") === 2.5 && convertirParametro(pGs, "18.500") === 18500n && convertirParametro(pPct, "16,5") === 0.165, "parámetros: coma decimal y puntos de miles");
console.log("\nOK — hojas de Finanzas (parte 2) verificadas");

// ── Parte 3: planificación ────────────────────────────────────────
import { coberturaDias, cuotaFrancesa, flujoReal, preguntasProyeccion, proyectar, rangoMeses, resumenPrestamo, semaforoDesvio, sumarMeses, tasaImplicita, vencimientos } from "@/lib/finanzas/planificacion";

check(sumarMeses(202611, 3) === 202702 && rangoMeses(202611, 202702).length === 4, "meses: sumar y rango cruzando el año");
const tm = tasaImplicita(10_000_000, 1_000_000, 12)!;
check(Math.abs(tm - 0.029229) < 0.00001, "tasa mensual implícita como RATE de Excel (10 M, 12 cuotas de 1 M ≈ 2,92 %)");
check(Math.abs(cuotaFrancesa(10_000_000, 12, 0.24) - 945_596) < 1 && cuotaFrancesa(1_200_000, 12, null) === 100_000, "cuota francesa y cuota simple como la planilla");
const v = vencimientos(new Date(Date.UTC(2026, 0, 31)), 3);
check(v[1].toISOString().slice(0, 10) === "2026-02-28" && v[2].toISOString().slice(0, 10) === "2026-03-31", "vencimientos cortados a fin de mes");
const corteP = new Date(Date.UTC(2026, 2, 15));
const rp = resumenPrestamo({ montoRecibidoGs: 10_000_000n, cuotaMensualGs: 1_000_000n, numeroCuotas: 12 },
  vencimientos(new Date(Date.UTC(2026, 0, 10)), 12).map((d, i) => ({ numero: i + 1, vencimiento: d, montoGs: 1_000_000n, pagada: i === 0 })), corteP);
check(rp.pagadas === 1 && rp.atrasadas === 2 && rp.saldo === 11_000_000n && rp.costoFinanciero === 2_000_000n, "préstamo: pagadas, atrasadas, saldo y costo financiero");
check(semaforoDesvio(100n, 104n, 0.05, 0.1).semaforo === "OK" && semaforoDesvio(100n, 108n, 0.05, 0.1).semaforo === "ATENCIÓN" && semaforoDesvio(100n, 130n, 0.05, 0.1).semaforo === "EXPLICAR" && semaforoDesvio(0n, 5n, 0.05, 0.1).semaforo === "–", "semáforo de desvío");
const pr = proyectar({ desde: 202612, meses: 3, saldoInicial: 1_000_000n, ventasMes: () => 2_000_000n, otrosIngresosMes: 0n,
  aportes: new Map(), gastoOperativo: new Map([[202612, 2_500_000n], [202701, 2_500_000n], [202702, 2_500_000n]]), inversion: new Map(),
  cuotas: new Map([[202701, 1_000_000n]]), porPagar: new Map(), colchonMeses: 1 });
check(pr[0].saldoFinal === 500_000n && pr[1].saldoFinal === -1_000_000n && pr[1].alerta === "SIN CAJA" && pr[0].alerta === "AJUSTADO", "proyección: saldo mes a mes y alertas");
const pq = preguntasProyeccion(pr, 1_000_000n, 0n);
check(pq.mesSinCaja === 202701 && pq.capitalTrabajoNecesario === 1_500_000n && pq.necesitoProximoMes === 0n, "proyección: mes sin caja y capital de trabajo necesario");
const fl = flujoReal([
  { fechaPago: new Date(Date.UTC(2026, 0, 5)), montoGs: 5_000_000n, signo: 1, tipo: "INGRESO", categoria: "Venta de lechones", esInterno: false },
  { fechaPago: new Date(Date.UTC(2026, 0, 6)), montoGs: 2_000_000n, signo: -1, tipo: "GASTO", categoria: "Energía", esInterno: false },
  { fechaPago: new Date(Date.UTC(2026, 1, 6)), montoGs: 1_000_000n, signo: -1, tipo: "FINANCIAMIENTO", categoria: "Pago de cuota de préstamo", esInterno: false },
  { fechaPago: new Date(Date.UTC(2026, 1, 7)), montoGs: 3_000_000n, signo: 1, tipo: "FINANCIAMIENTO", categoria: "Aporte de capital", esInterno: false },
], 202601, 202602, 100n);
check(fl[0].flujoNeto === 3_000_000n && fl[1].flujoNeto === 2_000_000n && fl[1].saldoFinal === 5_000_100n, "flujo de caja real: flujo neto y saldo");
check(coberturaDias(3_000_000n, 3_000_000) === 30, "cobertura de caja en días");
console.log("\nOK — planificación (parte 3) verificada");

// ── Parte 4: retorno y equilibrio ─────────────────────────────────
import { flujosRetorno, payback, puntoEquilibrio, tir, van } from "@/lib/finanzas/planificacion";
const fr = flujosRetorno(1000, 300, 0.1);
check(fr.length === 6 && fr[0] === -1000 && Math.abs(fr[2] - 330) < 1e-9, "flujos del retorno: año 0 y crecimiento");
check(Math.abs(van([-1000, 500, 600], 0.1) - (-1000 + 500 / 1.1 + 600 / 1.21)) < 1e-9, "VAN");
const t = tir([-1000, 500, 600])!;
check(Math.abs(van([-1000, 500, 600], t)) < 1e-6 && tir([100, 200]) === null, "TIR (y no calculable sin cambio de signo)");
check(Math.abs(payback([-1000, 400, 400, 400])! - 2.5) < 1e-9 && payback([-1000, 100, 100]) === null, "payback con fracción y sin recupero");
const pe = puntoEquilibrio(10_000_000, 4_000_000, 20, 450_000);
check(pe.valor === 40 && puntoEquilibrio(1, 1, 0, 1).mensaje === "Sin ventas en el mes" && puntoEquilibrio(1, 10_000_000, 1, 100).valor === null, "punto de equilibrio y sus mensajes");
console.log("\nOK — retorno de la inversión (parte 4) verificado");
