// Planificación financiera (Fase 8, parte 3) en funciones puras: deudas, presupuesto contra real,
// proyección y flujo de caja, evaluación de inversiones. Montos en bigint; tasas en number.

// ── Utilidades de meses AAAAMM ────────────────────────────────────
export function sumarMeses(aaaamm: number, n: number): number {
  const total = Math.floor(aaaamm / 100) * 12 + (aaaamm % 100) - 1 + n;
  return Math.floor(total / 12) * 100 + (total % 12) + 1;
}
export function rangoMeses(desde: number, hasta: number): number[] {
  const out: number[] = [];
  for (let m = desde; m <= hasta; m = sumarMeses(m, 1)) out.push(m);
  return out;
}
export const mesDeFecha = (d: Date) => d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;

// ── 8.19 · Deudas ─────────────────────────────────────────────────
/** Tasa mensual que iguala el valor presente de n cuotas con el monto recibido (como RATE de Excel). */
export function tasaImplicita(recibido: number, cuota: number, n: number): number | null {
  if (recibido <= 0 || cuota <= 0 || n <= 0) return null;
  if (cuota * n <= recibido) return 0; // sin costo financiero (o cuota mal cargada)
  let r = 0.02;
  for (let i = 0; i < 100; i++) {
    const f = Math.pow(1 + r, -n);
    const vp = cuota * (1 - f) / r;                       // valor presente de las cuotas
    const dvp = cuota * ((n * f) / (r * (1 + r)) - (1 - f) / (r * r));
    const paso = (vp - recibido) / dvp;
    r -= paso;
    if (!Number.isFinite(r) || r <= 0) r = 1e-6;
    if (Math.abs(paso) < 1e-10) return r;
  }
  return r;
}
export const tasaAnual = (mensual: number | null) => (mensual === null ? null : Math.pow(1 + mensual, 12) - 1);

/** Cuota de un préstamo por sistema francés; sin tasa = monto ÷ plazo (como la planilla). */
export function cuotaFrancesa(monto: number, plazoMeses: number, tasaAnualNominal: number | null): number {
  if (plazoMeses <= 0) return 0;
  if (!tasaAnualNominal) return monto / plazoMeses;
  const i = tasaAnualNominal / 12;
  return (monto * i) / (1 - Math.pow(1 + i, -plazoMeses));
}

export type CuotaEstado = { numero: number; vencimiento: Date; montoGs: bigint; pagada: boolean };
export function resumenPrestamo(p: { montoRecibidoGs: bigint; cuotaMensualGs: bigint; numeroCuotas: number }, cuotas: CuotaEstado[], corte: Date) {
  const pagadas = cuotas.filter(c => c.pagada).length;
  const pendientes = cuotas.length - pagadas;
  const atrasadas = cuotas.filter(c => !c.pagada && c.vencimiento.getTime() < corte.getTime()).length;
  const saldo = cuotas.filter(c => !c.pagada).reduce((s, c) => s + c.montoGs, 0n);
  const totalAPagar = cuotas.reduce((s, c) => s + c.montoGs, 0n);
  const mensual = tasaImplicita(Number(p.montoRecibidoGs), Number(p.cuotaMensualGs), p.numeroCuotas);
  const proxima = cuotas.filter(c => !c.pagada).sort((a, b) => a.vencimiento.getTime() - b.vencimiento.getTime())[0] ?? null;
  return {
    pagadas, pendientes, atrasadas, saldo, totalAPagar, costoFinanciero: totalAPagar - p.montoRecibidoGs,
    tasaMensual: mensual, tasaAnual: tasaAnual(mensual), proxima, ultimoVencimiento: cuotas.at(-1)?.vencimiento ?? null,
  };
}

/** Vencimientos de un préstamo: el primero y después cada mes el mismo día (cortado a fin de mes). */
export function vencimientos(primer: Date, n: number): Date[] {
  const dia = primer.getUTCDate();
  return Array.from({ length: n }, (_, i) => {
    const y = primer.getUTCFullYear(), m = primer.getUTCMonth() + i;
    const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(dia, ultimo)));
  });
}

// ── 8.14 · Presupuesto contra real ────────────────────────────────
export type Semaforo = "–" | "OK" | "ATENCIÓN" | "EXPLICAR";
export function semaforoDesvio(presupuesto: bigint, real: bigint, meta: number, alerta: number): { diferencia: bigint; desvio: number | null; semaforo: Semaforo } {
  const diferencia = real - presupuesto;
  if (presupuesto === 0n) return { diferencia, desvio: null, semaforo: "–" };
  const desvio = Number(diferencia) / Number(presupuesto);
  const a = Math.abs(desvio);
  return { diferencia, desvio, semaforo: a <= meta ? "OK" : a <= alerta ? "ATENCIÓN" : "EXPLICAR" };
}

// ── 8.15 · Proyección de caja ─────────────────────────────────────
export type MesProyeccion = {
  mes: number; ventas: bigint; otrosIngresos: bigint; aportes: bigint; ingresos: bigint;
  gastoOperativo: bigint; inversion: bigint; cuotas: bigint; porPagar: bigint; egresos: bigint;
  flujo: bigint; saldoInicial: bigint; saldoFinal: bigint; mesesCubiertos: number | null; alerta: "SIN CAJA" | "AJUSTADO" | "OK";
};
export function proyectar(e: {
  desde: number; meses: number; saldoInicial: bigint; ventasMes: (mes: number) => bigint; otrosIngresosMes: bigint;
  aportes: Map<number, bigint>; gastoOperativo: Map<number, bigint>; inversion: Map<number, bigint>;
  cuotas: Map<number, bigint>; porPagar: Map<number, bigint>; colchonMeses: number;
}): MesProyeccion[] {
  const out: MesProyeccion[] = [];
  let saldo = e.saldoInicial;
  for (let i = 0; i < e.meses; i++) {
    const mes = sumarMeses(e.desde, i);
    const ventas = e.ventasMes(mes), aportes = e.aportes.get(mes) ?? 0n;
    const ingresos = ventas + e.otrosIngresosMes + aportes;
    const gastoOperativo = e.gastoOperativo.get(mes) ?? 0n, inversion = e.inversion.get(mes) ?? 0n;
    const cuotas = e.cuotas.get(mes) ?? 0n, porPagar = e.porPagar.get(mes) ?? 0n;
    const egresos = gastoOperativo + inversion + cuotas + porPagar;
    const flujo = ingresos - egresos;
    const saldoInicial = saldo;
    saldo = saldoInicial + flujo;
    out.push({
      mes, ventas, otrosIngresos: e.otrosIngresosMes, aportes, ingresos, gastoOperativo, inversion, cuotas, porPagar, egresos,
      flujo, saldoInicial, saldoFinal: saldo, mesesCubiertos: egresos > 0n ? Number(saldo) / Number(egresos) : null,
      alerta: saldo < 0n ? "SIN CAJA" : Number(saldo) < Number(egresos) * e.colchonMeses ? "AJUSTADO" : "OK",
    });
  }
  return out;
}

/** Las preguntas de la proyección (8.15). */
export function preguntasProyeccion(p: MesProyeccion[], cajaHoy: bigint, aportesPrevistos: bigint) {
  const proximo = p[0];
  const necesito = proximo ? (proximo.egresos - (proximo.ventas + proximo.otrosIngresos + proximo.aportes) - cajaHoy) : 0n;
  const sinCaja = p.find(m => m.saldoFinal < 0n)?.mes ?? null;
  const masBajo = p.reduce((m, x) => (x.saldoFinal < m ? x.saldoFinal : m), p[0]?.saldoFinal ?? 0n);
  return {
    necesitoProximoMes: necesito > 0n ? necesito : 0n,
    egresosProximoMes: proximo?.egresos ?? 0n,
    ingresosEsperados: proximo ? proximo.ingresos : 0n,
    mesSinCaja: sinCaja,
    saldoMasBajo: masBajo,
    capitalTrabajoNecesario: masBajo < 0n ? -masBajo : 0n,
    aportesPrevistos,
  };
}

// ── 8.16 · Flujo de caja real ─────────────────────────────────────
export type PagoFlujo = { fechaPago: Date; montoGs: bigint; signo: number; tipo: string; categoria: string; esInterno: boolean };
export type MesFlujo = {
  mes: number; tipo: "Real" | "Proyectado"; saldoInicial: bigint; ingresos: bigint; egresosOperativos: bigint; inversiones: bigint;
  financiamiento: bigint; pagoDeudas: bigint; otros: bigint; flujoNeto: bigint; saldoFinal: bigint; acumuladoAnio: bigint;
};
const ENTRADAS_FINANCIAMIENTO = new Set(["Préstamo recibido", "Aporte de capital"]);
const OTROS_FINANCIAMIENTO = new Set(["Intereses y comisiones", "Retiro del titular"]);

export function flujoReal(pagos: PagoFlujo[], desde: number, hasta: number, saldoInicial: bigint): MesFlujo[] {
  const meses = rangoMeses(desde, hasta);
  let saldo = saldoInicial, acum = 0n;
  return meses.map(mes => {
    const delMes = pagos.filter(p => !p.esInterno && mesDeFecha(p.fechaPago) === mes);
    const suma = (f: (p: PagoFlujo) => boolean) => delMes.filter(f).reduce((s, p) => s + p.montoGs, 0n);
    const ingresos = suma(p => p.tipo === "INGRESO");
    const egresosOperativos = suma(p => p.tipo === "GASTO");
    const inversiones = suma(p => p.tipo === "INVERSION");
    const financiamiento = suma(p => p.tipo === "FINANCIAMIENTO" && ENTRADAS_FINANCIAMIENTO.has(p.categoria));
    const pagoDeudas = suma(p => p.tipo === "FINANCIAMIENTO" && p.categoria === "Pago de cuota de préstamo");
    const otros = suma(p => p.tipo === "FINANCIAMIENTO" && OTROS_FINANCIAMIENTO.has(p.categoria));
    const flujoNeto = ingresos - egresosOperativos - inversiones + financiamiento - pagoDeudas - otros;
    if (mes % 100 === 1) acum = 0n;
    acum += flujoNeto;
    const ini = saldo;
    saldo += flujoNeto;
    return { mes, tipo: "Real", saldoInicial: ini, ingresos, egresosOperativos, inversiones, financiamiento, pagoDeudas, otros, flujoNeto, saldoFinal: saldo, acumuladoAnio: acum };
  });
}

/** Cobertura de caja en días = saldo ÷ (egreso operativo mensual promedio ÷ 30). */
export function coberturaDias(saldo: bigint, egresoPromedioMensual: number): number | null {
  if (egresoPromedioMensual <= 0) return null;
  return Number(saldo) / (egresoPromedioMensual / 30);
}

// ── 8.22 · Retorno de la inversión y punto de equilibrio ──────────
/** Valor actual neto de flujos anuales (el índice 0 es el año 0, sin descontar). */
export function van(flujos: number[], tasa: number): number {
  return flujos.reduce((s, f, i) => s + f / Math.pow(1 + tasa, i), 0);
}
/** Tasa interna de retorno por bisección; null si los flujos no cambian de signo. */
export function tir(flujos: number[]): number | null {
  const hayNeg = flujos.some(f => f < 0), hayPos = flujos.some(f => f > 0);
  if (!hayNeg || !hayPos) return null;
  let lo = -0.99, hi = 10;
  if (van(flujos, lo) * van(flujos, hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (van(flujos, lo) * van(flujos, mid) <= 0) hi = mid; else lo = mid;
    if (hi - lo < 1e-9) break;
  }
  return (lo + hi) / 2;
}
/** Años hasta recuperar la inversión (con fracción); null si no se recupera en el horizonte. */
export function payback(flujos: number[]): number | null {
  let acum = 0;
  for (let i = 0; i < flujos.length; i++) {
    const antes = acum;
    acum += flujos[i];
    if (i > 0 && antes < 0 && acum >= 0) return i - 1 + -antes / flujos[i];
  }
  return null;
}
/** Flujos para el retorno: año 0 = −inversión; año 1 = proyectado; años 2 a 5 crecen a la tasa. */
export function flujosRetorno(inversion: number, anio1: number, crecimiento: number, anios = 5): number[] {
  return [-inversion, ...Array.from({ length: anios }, (_, i) => anio1 * Math.pow(1 + crecimiento, i))];
}
/** Punto de equilibrio en lechones por mes = gasto fijo ÷ (precio − gasto variable por lechón). */
export function puntoEquilibrio(fijoMes: number, variableMes: number, entregadosMes: number, precioRef: number): { valor: number | null; mensaje?: string } {
  if (entregadosMes <= 0) return { valor: null, mensaje: "Sin ventas en el mes" };
  const contribucion = precioRef - variableMes / entregadosMes;
  if (contribucion <= 0) return { valor: null, mensaje: "No calculable: el costo variable por lechón supera al precio" };
  return { valor: fijoMes / contribucion };
}
