// Fase 10 · Cerdas paradas. Cálculo puro (sin base): días productivos, normales y parados de cada
// reproductora, y cuánto cuesta un día parado. Lo usan la pantalla, el tablero, las alertas y las pruebas.
//
// Productiva = gestando (del servicio que termina en parto; una servida sin resultado se considera gestando)
// o en lactancia (parto → destete). Lo demás es día no productivo (DNP): normal hasta el objetivo, parado después.
// Si un servicio repite, da vacía o aborta, sus días pasan a parados (se recalcula solo: todo sale de los eventos).

export type Causa = "DESTETE_TARDIO" | "REPETICION" | "VACIA" | "ABORTO" | "NULIPARA" | "DESCARTE_DEMORADO" | "MUERTE";
export const NOMBRE_CAUSA: Record<Causa, string> = {
  DESTETE_TARDIO: "Destete → servicio tardío", REPETICION: "Repetición de celo", VACIA: "Vacía en el diagnóstico",
  ABORTO: "Aborto", NULIPARA: "Nulípara sin servir a tiempo", DESCARTE_DEMORADO: "Descarte demorado", MUERTE: "Muerte",
};
export type Estado = "GESTANDO" | "LACTANDO" | "NORMAL" | "PARADA";
export type Tramo = { desde: Date; hasta: Date; estado: Estado; causa?: Causa; dias: number };

export type ServicioCerda = {
  id: string; fecha: Date;
  /** fecha de parto de este servicio, si parió */
  parto?: { fecha: Date; destete?: { fecha: Date; descarte: boolean } | null } | null;
  /** el resultado que corta el servicio sin parto (lo más temprano que se supo) */
  fallo?: { tipo: "REPETICION" | "VACIA" | "ABORTO"; fecha: Date } | null;
};
export type CerdaLinea = {
  id: string; codigo: string; nacimiento: Date | null; ingreso: Date;
  /** salida del plantel (muerte o venta/descarte) */
  salida?: { fecha: Date; tipo: "MUERTE" | "DESCARTE" } | null;
  servicios: ServicioCerda[];
};
export type ParamsParadas = {
  intervaloObjetivoDias: number;   // destete → servicio (en bandas, 5)
  toleranciaDias: number;          // días de gracia sobre el objetivo
  edadPrimerServicioDias: number;  // edad objetivo de la nulípara
  adaptacionDias: number;          // ingreso + adaptación
};

const DIA = 86_400_000;
const utc = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export const dia0 = (d: Date) => new Date(utc(d));
const ndias = (a: Date, b: Date) => Math.max(0, Math.round((utc(b) - utc(a)) / DIA));
const mas = (d: Date, n: number) => new Date(utc(d) + n * DIA);
const min = (a: Date, b: Date) => (utc(a) <= utc(b) ? a : b);
const max = (a: Date, b: Date) => (utc(a) >= utc(b) ? a : b);

/** Tramos de la vida de una cerda en el plantel, del ingreso hasta la salida o `hoy` (exclusivo). */
export function tramosCerda(c: CerdaLinea, p: ParamsParadas, hoy: Date): Tramo[] {
  const fin = dia0(c.salida ? min(c.salida.fecha, hoy) : hoy);
  const inicio = dia0(c.ingreso);
  const out: Tramo[] = [];
  const push = (desde: Date, hasta: Date, estado: Estado, causa?: Causa) => {
    const d0 = max(dia0(desde), inicio), d1 = min(dia0(hasta), fin);
    const n = ndias(d0, d1);
    if (n > 0) out.push({ desde: d0, hasta: d1, estado, causa, dias: n });
  };
  const sv = [...c.servicios].sort((a, b) => utc(a.fecha) - utc(b.fecha));
  const muere = c.salida?.tipo === "MUERTE" && utc(c.salida.fecha) <= utc(hoy);
  const sale = !!c.salida && utc(c.salida.fecha) <= utc(hoy);

  // Hueco sin gestar ni amamantar entre `desde` y `hasta` (o la salida). `normalHasta` = hasta dónde es normal.
  const hueco = (desde: Date, hasta: Date | null, causa: Causa, normalHasta?: Date) => {
    const h = hasta ?? fin;
    const terminaEnSalida = !hasta && sale;
    if (terminaEnSalida && causa !== "REPETICION" && causa !== "VACIA" && causa !== "ABORTO") {
      // del fin del último estado productivo a la salida: todo parado
      push(desde, h, "PARADA", causa === "DESCARTE_DEMORADO" ? "DESCARTE_DEMORADO" : muere ? "MUERTE" : "DESCARTE_DEMORADO");
      return;
    }
    if (normalHasta) { push(desde, min(normalHasta, h), "NORMAL"); push(max(normalHasta, desde), h, "PARADA", causa); }
    else push(desde, h, "PARADA", causa);
  };

  // Antes del primer servicio: normal hasta la fecha objetivo de la nulípara
  const objetivo = max(mas(c.ingreso, p.adaptacionDias), c.nacimiento ? mas(c.nacimiento, p.edadPrimerServicioDias) : inicio);
  hueco(inicio, sv[0]?.fecha ?? null, "NULIPARA", objetivo);

  sv.forEach((s, i) => {
    const sig = sv[i + 1]?.fecha ?? null;
    if (s.parto) {
      push(s.fecha, s.parto.fecha, "GESTANDO");
      const destete = s.parto.destete;
      push(s.parto.fecha, destete?.fecha ?? sig ?? fin, "LACTANDO");
      if (!destete) return;
      if (destete.descarte) hueco(destete.fecha, sig, "DESCARTE_DEMORADO");
      else hueco(destete.fecha, sig, "DESTETE_TARDIO", mas(destete.fecha, p.intervaloObjetivoDias + p.toleranciaDias));
      return;
    }
    // Sin parto: fracasó si hay resultado negativo o si hubo otro servicio después
    const fallo = s.fallo ?? (sig ? { tipo: "REPETICION" as const, fecha: sig } : null);
    if (!fallo) { push(s.fecha, fin, "GESTANDO"); return; } // servida o preñada, sin parto todavía
    hueco(s.fecha, sig, fallo.tipo);
  });
  return out;
}

export type Resumen = { productivos: number; normales: number; parados: number; porCausa: Partial<Record<Causa, number>> };
export function resumir(tramos: Tramo[]): Resumen {
  const r: Resumen = { productivos: 0, normales: 0, parados: 0, porCausa: {} };
  for (const t of tramos) {
    if (t.estado === "GESTANDO" || t.estado === "LACTANDO") r.productivos += t.dias;
    else if (t.estado === "NORMAL") r.normales += t.dias;
    else { r.parados += t.dias; r.porCausa[t.causa!] = (r.porCausa[t.causa!] ?? 0) + t.dias; }
  }
  return r;
}

/** Días parados por mes (clave AAAAMM) y causa. */
export function paradosPorMes(tramos: Tramo[]): Map<number, Partial<Record<Causa, number>>> {
  const m = new Map<number, Partial<Record<Causa, number>>>();
  for (const t of tramos) {
    if (t.estado !== "PARADA") continue;
    for (let d = utc(t.desde); d < utc(t.hasta); d += DIA) {
      const f = new Date(d), k = f.getUTCFullYear() * 100 + f.getUTCMonth() + 1;
      const x = m.get(k) ?? {};
      x[t.causa!] = (x[t.causa!] ?? 0) + 1;
      m.set(k, x);
    }
  }
  return m;
}

/** Si hoy está parada: la causa y desde cuándo. */
export function paradaHoy(tramos: Tramo[], hoy: Date): { causa: Causa; desde: Date; dias: number } | null {
  const u = tramos[tramos.length - 1];
  if (!u || u.estado !== "PARADA" || utc(u.hasta) < utc(dia0(hoy))) return null;
  return { causa: u.causa!, desde: u.desde, dias: u.dias };
}

export const ACCION: Record<Causa, string> = {
  NULIPARA: "Servir", DESTETE_TARDIO: "Revisar celo y servir", REPETICION: "Revisar celo y servir", VACIA: "Servir o decidir descarte",
  ABORTO: "Decidir descarte", DESCARTE_DEMORADO: "Vender descarte", MUERTE: "—",
};

// ── Cuánto cuesta un día parado (10.2) ─────────────────────────────────
export type CostoMes = {
  consumoKgDia: number; precioGestacionKg: number | null;
  fijosGs: number; amortizacionGs: number; matrices: number; diasMes: number;
  partosMeta: number; nacidosMeta: number; mortalidadMeta: number;
  precioLechonGs: number; costoVariableLechonGs: number | null;
};
export type CostoDia = { alimento: number; estructura: number; costoDia: number; lechonesDia: number; margen: number | null; lucroCesante: number; perdidaDia: number };
export function costoDia(c: CostoMes): CostoDia {
  const alimento = c.consumoKgDia * (c.precioGestacionKg ?? 0);
  const estructura = c.matrices > 0 && c.diasMes > 0 ? (c.fijosGs + c.amortizacionGs) / (c.matrices * c.diasMes) : 0;
  const lechonesDia = (c.partosMeta * c.nacidosMeta * (1 - c.mortalidadMeta)) / 365;
  const margen = c.costoVariableLechonGs === null ? null : c.precioLechonGs - c.costoVariableLechonGs;
  const lucroCesante = margen === null ? 0 : lechonesDia * Math.max(0, margen);
  return { alimento, estructura, costoDia: alimento + estructura, lechonesDia, margen, lucroCesante, perdidaDia: alimento + estructura + lucroCesante };
}

/** Máximo teórico de partos por cerda por año: 365 ÷ (gestación + lactancia + intervalo objetivo). */
export const partosMaximos = (gestacion: number, lactancia: number, ids: number) => 365 / (gestacion + lactancia + ids);
