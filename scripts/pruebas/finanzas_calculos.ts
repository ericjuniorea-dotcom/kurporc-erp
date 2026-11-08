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
