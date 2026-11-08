// Engorde (Fase 9) en funciones puras: indicadores del lote (9.3) y costo y margen (9.4).
// Sin base de datos: se prueban con `npm run prueba:engorde`.

const DIA = 86_400_000;
const dias = (a: Date, b: Date) => Math.max(0, (b.getTime() - a.getTime()) / DIA);

export type MovAnimales = { fecha: Date; cantidad: number; kg: number | null };
export type DatosLote = {
  ingreso: MovAnimales;                 // ingreso inicial (cantidad y kg totales)
  entradas: MovAnimales[];              // traslados que entran
  pesajes: { fecha: Date; animales: number; kgTotales: number }[];
  muertes: MovAnimales[];               // kg = peso estimado total de los muertos (puede faltar)
  ventas: MovAnimales[];
  otrasSalidas: MovAnimales[];          // descarte, hospital, traslados que salen…
  alimentoKg: number;
  fin: Date;                            // cierre del lote u hoy
};

export function indicadoresLote(d: DatosLote) {
  const ordenPesajes = [...d.pesajes].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const kgIngresados = (d.ingreso.kg ?? 0) + d.entradas.reduce((s, e) => s + (e.kg ?? 0), 0);
  const ingresados = d.ingreso.cantidad + d.entradas.reduce((s, e) => s + e.cantidad, 0);
  const muertos = d.muertes.reduce((s, x) => s + x.cantidad, 0);
  const vendidos = d.ventas.reduce((s, x) => s + x.cantidad, 0);
  const otros = d.otrasSalidas.reduce((s, x) => s + x.cantidad, 0);
  const presentes = ingresados - muertos - vendidos - otros;

  // Peso promedio a una fecha: el último pesaje anterior, o el de ingreso
  const pesoIngreso = d.ingreso.cantidad ? (d.ingreso.kg ?? 0) / d.ingreso.cantidad : 0;
  const pesoA = (f: Date) => {
    const p = ordenPesajes.filter(x => x.fecha.getTime() <= f.getTime()).at(-1);
    return p && p.animales > 0 ? p.kgTotales / p.animales : pesoIngreso;
  };

  // Animales-día: cada cambio de cantidad cuenta desde su fecha hasta el fin
  const cambios: { fecha: Date; delta: number }[] = [
    { fecha: d.ingreso.fecha, delta: d.ingreso.cantidad },
    ...d.entradas.map(e => ({ fecha: e.fecha, delta: e.cantidad })),
    ...[...d.muertes, ...d.ventas, ...d.otrasSalidas].map(e => ({ fecha: e.fecha, delta: -e.cantidad })),
  ];
  const animalesDia = cambios.reduce((s, c) => s + c.delta * dias(c.fecha, d.fin), 0);
  const diasPromedio = ingresados ? animalesDia / ingresados : 0;

  const pesoActual = pesoA(d.fin);
  const kgPresentes = presentes * pesoActual;
  const kgVendidos = d.ventas.reduce((s, x) => s + (x.kg ?? 0), 0);
  const kgOtras = d.otrasSalidas.reduce((s, x) => s + (x.kg ?? x.cantidad * pesoA(x.fecha)), 0);
  const kgMuertos = d.muertes.reduce((s, x) => s + (x.kg ?? x.cantidad * pesoA(x.fecha)), 0);
  const kgSalida = kgVendidos + kgOtras;
  const gananciaVivos = kgSalida + kgPresentes - kgIngresados;
  const kgGanados = gananciaVivos + kgMuertos;            // la conversión incluye lo que ganaron los que murieron
  const kgProducidos = kgVendidos + kgPresentes - kgIngresados;

  return {
    ingresados, presentes, muertos, vendidos, otrasSalidas: otros,
    animalesDia, diasPromedio, pesoActual, kgIngresados, kgPresentes, kgVendidos, kgMuertos, kgProducidos, kgGanados,
    gdpKg: animalesDia > 0 ? gananciaVivos / animalesDia : null,
    conversion: kgGanados > 0 ? d.alimentoKg / kgGanados : null,
    conversionEconomica: kgVendidos - kgIngresados > 0 ? d.alimentoKg / (kgVendidos - kgIngresados) : null,
    mortalidad: ingresados ? muertos / ingresados : null,
  };
}

/** Días que faltan para el peso objetivo según la curva (o la GDP si no hay curva). */
export function diasHastaObjetivo(pesoActual: number, objetivo: number, curva: { dia: number; pesoKg: number }[] | null, gdpKg: number | null): number | null {
  if (pesoActual >= objetivo) return 0;
  if (curva && curva.length >= 2) {
    const puntos = [...curva].sort((a, b) => a.dia - b.dia);
    const diaDe = (peso: number) => {
      for (let i = 1; i < puntos.length; i++) {
        const a = puntos[i - 1], b = puntos[i];
        if (peso <= b.pesoKg) return a.dia + ((peso - a.pesoKg) / (b.pesoKg - a.pesoKg || 1)) * (b.dia - a.dia);
      }
      return null;
    };
    const hoy = diaDe(pesoActual), meta = diaDe(objetivo);
    if (hoy !== null && meta !== null) return Math.ceil(meta - hoy);
  }
  return gdpKg && gdpKg > 0 ? Math.ceil((objetivo - pesoActual) / gdpKg) : null;
}

/** Peso esperado por la curva a un día del engorde (interpolación lineal). */
export function pesoEsperado(curva: { dia: number; pesoKg: number }[], dia: number): number | null {
  const p = [...curva].sort((a, b) => a.dia - b.dia);
  if (!p.length) return null;
  if (dia <= p[0].dia) return p[0].pesoKg;
  for (let i = 1; i < p.length; i++) if (dia <= p[i].dia) return p[i - 1].pesoKg + ((dia - p[i - 1].dia) / (p[i].dia - p[i - 1].dia || 1)) * (p[i].pesoKg - p[i - 1].pesoKg);
  return p.at(-1)!.pesoKg;
}

// ── 9.4 · Costo y margen del lote ─────────────────────────────────
export type EntradaCosto = {
  animales: bigint; alimento: bigint; sanidad: bigint; estructura: bigint; ventaGastos: bigint;
  ingresos: bigint; kgProducidos: number; kgVendidos: number; vendidos: number;
};
export function costoLote(e: EntradaCosto) {
  const total = e.animales + e.alimento + e.sanidad + e.estructura + e.ventaGastos;
  const margen = e.ingresos - total;
  return {
    total, margen,
    costoPorKgProducido: e.kgProducidos > 0 ? Number(total) / e.kgProducidos : null,
    costoPorAnimalVendido: e.vendidos > 0 ? Number(total) / e.vendidos : null,
    margenPorAnimal: e.vendidos > 0 ? Number(margen) / e.vendidos : null,
    precioEquilibrioKg: e.kgVendidos > 0 ? Number(total) / e.kgVendidos : null,
  };
}

/** Ingreso de un lote integrado según la tarifa del integrador. */
export function ingresoIntegracion(pago: string | null, tarifa: bigint | null, i: { kgProducidos: number; animalesDia: number; vendidos: number }): bigint {
  if (!tarifa) return 0n;
  const n = pago === "POR_KG_PRODUCIDO" ? i.kgProducidos : pago === "POR_ANIMAL_DIA" ? i.animalesDia : pago === "POR_CABEZA" ? i.vendidos : 0;
  return BigInt(Math.round(Number(tarifa) * Math.max(0, n)));
}
