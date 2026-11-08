/**
 * Prueba de la Fase 9: indicadores, costo y margen de un lote de engorde (cálculo a mano).
 *   npm run prueba:engorde
 */
import { costoLote, diasHastaObjetivo, indicadoresLote, ingresoIntegracion, pesoEsperado } from "@/lib/engorde/indicadores";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
const d = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 86_400_000);
const cerca = (a: number | null, b: number, tol = 1e-4) => a !== null && Math.abs(a - b) < tol;

// Lote de prueba del documento: 100 animales de 25 kg, 3 muertes, pesaje y consumo
const base = {
  ingreso: { fecha: d(0), cantidad: 100, kg: 2500 }, entradas: [],
  pesajes: [{ fecha: d(30), animales: 20, kgTotales: 900 }, { fecha: d(60), animales: 97, kgTotales: 6790 }],
  muertes: [{ fecha: d(30), cantidad: 3, kg: 135 }], ventas: [], otrasSalidas: [], alimentoKg: 10_000, fin: d(60),
};
const i1 = indicadoresLote(base);
// A mano: animales-día = 100×60 − 3×30 = 5.910 · kg presentes = 97 × 70 = 6.790 · ganancia = 6.790 − 2.500 = 4.290
check(i1.ingresados === 100 && i1.presentes === 97 && i1.animalesDia === 5910, "presentes y animales-día");
check(cerca(i1.gdpKg, 4290 / 5910), "GDP = (kg salida + kg presentes − kg ingresados) ÷ animales-día");
check(cerca(i1.conversion, 10_000 / 4425), "CA = alimento ÷ kg ganados (incluye el peso de los muertos)");
check(i1.mortalidad === 0.03 && cerca(i1.kgProducidos, 4290), "mortalidad 3 % y kg producidos");
check(cerca(i1.diasPromedio, 59.1), "días en engorde ponderados por animal");

// Venta de todo el lote a los 110 días
const i2 = indicadoresLote({ ...base, pesajes: [...base.pesajes, { fecha: d(110), animales: 97, kgTotales: 10_670 }], ventas: [{ fecha: d(110), cantidad: 97, kg: 10_670 }], alimentoKg: 25_000, fin: d(110) });
check(i2.presentes === 0 && cerca(i2.kgProducidos, 8170) && cerca(i2.conversionEconomica, 25_000 / 8170), "lote vendido: kg producidos y conversión económica");

// Costo y margen: la suma de los costos ÷ kg producidos
const c = costoLote({ animales: 30_000_000n, alimento: 70_000_000n, sanidad: 2_000_000n, estructura: 8_000_000n, ventaGastos: 1_000_000n, ingresos: 197_395_000n, kgProducidos: 8170, kgVendidos: 10_670, vendidos: 97 });
check(c.total === 111_000_000n && c.margen === 86_395_000n, "costo total y margen del lote");
check(cerca(c.costoPorKgProducido, 111_000_000 / 8170) && cerca(c.precioEquilibrioKg, 111_000_000 / 10_670) && cerca(c.margenPorAnimal, 86_395_000 / 97), "costo por kg producido, precio de equilibrio y margen por animal");

// Integrado con alimento del integrador: la conversión usa los kilos; el costo del alimento es 0 (lo decide quien arma la entrada)
check(ingresoIntegracion("POR_KG_PRODUCIDO", 2_000n, { kgProducidos: 8170, animalesDia: 0, vendidos: 97 }) === 16_340_000n && ingresoIntegracion(null, null, { kgProducidos: 1, animalesDia: 1, vendidos: 1 }) === 0n, "ingreso de integración por kg producido");

// Curva: peso esperado y días hasta el objetivo
const curva = [{ dia: 0, pesoKg: 25 }, { dia: 50, pesoKg: 65 }, { dia: 100, pesoKg: 110 }];
check(pesoEsperado(curva, 25) === 45 && diasHastaObjetivo(65, 110, curva, null) === 50 && diasHastaObjetivo(100, 110, null, 0.8) === 13, "curva: peso esperado y días hasta el objetivo");
console.log("\nOK — engorde verificado");
