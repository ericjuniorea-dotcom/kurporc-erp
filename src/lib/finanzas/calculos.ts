// Cálculos de Finanzas (Fase 8) en funciones puras: sin base de datos, fáciles de probar.
// Los montos viajan como bigint (guaraníes enteros); el redondeo es solo al mostrar.

export type Tramo = "Vencido" | "Esta semana" | "Este mes" | "Próximo mes" | "Próximos 3 meses" | "Más adelante" | "Sin fecha" | "–";
export type EstadoCuenta = "FALTA IMPORTE" | "PAGADO" | "COBRADO" | "SIN VENCIMIENTO" | "VENCIDO" | "PENDIENTE";

const DIA = 86_400_000;

/** AAAAMM de una fecha (en UTC: las columnas `date` llegan a medianoche UTC). */
export function mesDe(d: Date): number {
  return d.getUTCFullYear() * 100 + (d.getUTCMonth() + 1);
}

/** Último día del mes `offset` meses después del de `d` (UTC). */
export function finDeMes(d: Date, offset = 0): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 0));
}

/** Fecha 'AAAA-MM-DD' → Date a medianoche UTC (lo que guarda una columna `date`). */
export function fechaISO(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Fecha inválida");
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error("Fecha inválida");
  return d;
}

/** Hoy (fecha de corte "en vivo") a medianoche UTC, según la zona horaria de la organización. */
export function hoyUTC(ahora = new Date(), zona = "America/Asuncion"): Date {
  const [a, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

/** Tramo de vencimiento (8.6 / 8.7). `saldo` ≤ 0 = ya pagado o cobrado. */
export function tramoDe(vencimiento: Date | null, corte: Date, saldo: bigint): Tramo {
  if (saldo <= 0n) return "–";
  if (!vencimiento) return "Sin fecha";
  const v = vencimiento.getTime();
  if (v < corte.getTime()) return "Vencido";
  if (v <= corte.getTime() + 7 * DIA) return "Esta semana";
  if (v <= finDeMes(corte).getTime()) return "Este mes";
  if (v <= finDeMes(corte, 1).getTime()) return "Próximo mes";
  if (v <= finDeMes(corte, 3).getTime()) return "Próximos 3 meses";
  return "Más adelante";
}

/** Estado de una cuenta por pagar o por cobrar (8.6 / 8.7). */
export function estadoCuentaDe(monto: bigint, saldo: bigint, vencimiento: Date | null, corte: Date, esCobro: boolean): EstadoCuenta {
  if (monto <= 0n) return "FALTA IMPORTE";
  if (saldo <= 0n) return esCobro ? "COBRADO" : "PAGADO";
  if (!vencimiento) return "SIN VENCIMIENTO";
  if (vencimiento.getTime() < corte.getTime()) return "VENCIDO";
  return "PENDIENTE";
}

/** Mes en que se va a pagar (8.7): el del vencimiento, pero nunca antes del mes siguiente al corte. */
export function mesDePago(vencimiento: Date | null, corte: Date): number | null {
  if (!vencimiento) return null;
  const siguiente = mesDe(finDeMes(corte, 1));
  return Math.max(mesDe(vencimiento), siguiente);
}

export const TRAMOS: Tramo[] = ["Vencido", "Esta semana", "Este mes", "Próximo mes", "Próximos 3 meses", "Más adelante", "Sin fecha"];

/** Suma bigint de una lista. */
export function suma<T>(xs: T[], f: (x: T) => bigint): bigint {
  let t = 0n;
  for (const x of xs) t += f(x);
  return t;
}

/** Porcentaje como número (0–100) sin dividir por cero. */
export function pct(parte: bigint, total: bigint): number | null {
  if (total === 0n) return null;
  return Number((parte * 10000n) / total) / 100;
}

/** "₲ 1.234.567" (o "—" si es null). */
export function gs(v: bigint | number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "bigint" ? v : BigInt(Math.round(Number(v)));
  const neg = n < 0n;
  const txt = (neg ? -n : n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "−" : ""}₲ ${txt}`;
}

export function nombreMes(aaaamm: number, corto = false): string {
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const m = meses[(aaaamm % 100) - 1] ?? "?";
  return corto ? `${m.slice(0, 3)} ${Math.floor(aaaamm / 100)}` : `${m} ${Math.floor(aaaamm / 100)}`;
}

/** Saldo de una cuenta de fondos: saldo inicial + Σ pagos × signo, desde la fecha del saldo inicial. */
export function saldoCuenta(
  cuenta: { saldoInicialGs: bigint; fechaSaldoInicial: Date | null },
  pagos: { montoGs: bigint; signo: number; fechaPago: Date }[],
  hasta?: Date,
): bigint {
  let s = cuenta.saldoInicialGs;
  for (const p of pagos) {
    if (cuenta.fechaSaldoInicial && p.fechaPago.getTime() < cuenta.fechaSaldoInicial.getTime()) continue;
    if (hasta && p.fechaPago.getTime() > hasta.getTime()) continue;
    s += p.signo > 0 ? p.montoGs : -p.montoGs;
  }
  return s;
}

/** Aviso (no bloqueo) de precio atípico (mejora N° 11): se aleja más de 20 % del promedio. */
export function precioAtipico(precio: number, promedio: number | null): boolean {
  if (!promedio || promedio <= 0 || !Number.isFinite(precio)) return false;
  return Math.abs(precio - promedio) / promedio > 0.2;
}
