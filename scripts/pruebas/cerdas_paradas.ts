/**
 * Prueba de la Fase 10: días parados por causa con un plantel calculado a mano, recálculo retroactivo
 * y el costo del día parado con el ejemplo de septiembre del documento (≈ Gs 26.005).
 *   npm run prueba:cerdas-paradas
 */
import { costoDia, partosMaximos, paradaHoy, resumir, tramosCerda, type CerdaLinea } from "@/lib/cerdas-paradas/calculo";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
const D = (s: string) => new Date(`${s}T00:00:00Z`);
const P = { intervaloObjetivoDias: 5, toleranciaDias: 2, edadPrimerServicioDias: 240, adaptacionDias: 30 };
const HOY = D("2026-06-30");
const base = { nacimiento: D("2025-01-01"), ingreso: D("2026-01-01") };
const r = (c: Omit<CerdaLinea, "id" | "codigo">) => resumir(tramosCerda({ id: "x", codigo: "x", ...c }, P, HOY));

// A · todo a tiempo: servida antes de la fecha objetivo, servicio al día 5 del destete
const a = r({ ...base, servicios: [
  { id: "1", fecha: D("2026-01-20"), parto: { fecha: D("2026-05-14"), destete: { fecha: D("2026-06-04"), descarte: false } } },
  { id: "2", fecha: D("2026-06-09") },
] });
check(a.parados === 0 && a.normales === 24 && a.productivos === 114 + 21 + 21, "a tiempo: 0 parados, 24 normales, 156 productivos");

// B · servicio 10 días después del destete: 7 normales (5 + 2 de tolerancia) y 3 parados
const b = r({ ...base, servicios: [
  { id: "1", fecha: D("2026-01-31"), parto: { fecha: D("2026-05-25"), destete: { fecha: D("2026-06-15"), descarte: false } } },
  { id: "2", fecha: D("2026-06-25") },
] });
check(b.porCausa.DESTETE_TARDIO === 3 && b.parados === 3, "destete tardío: 3 días parados");

// C · repetición: del servicio que no preñó al nuevo servicio, todos parados
const c = r({ ...base, servicios: [
  { id: "1", fecha: D("2026-01-10"), fallo: { tipo: "REPETICION", fecha: D("2026-01-31") } },
  { id: "2", fecha: D("2026-01-31") },
] });
check(c.porCausa.REPETICION === 21 && c.parados === 21, "repetición: 21 días parados");

// C' · sin el resultado cargado pero con otro servicio después: igual es repetición
const c2 = r({ ...base, servicios: [{ id: "1", fecha: D("2026-01-10") }, { id: "2", fecha: D("2026-01-31") }] });
check(c2.porCausa.REPETICION === 21, "un servicio nuevo sin parto previo cuenta como repetición");

// Recálculo retroactivo: servida sin diagnóstico = gestando; al cargar la vacía, esos días pasan a parados
const pendiente = r({ ...base, servicios: [{ id: "1", fecha: D("2026-01-10") }] });
const vacia = r({ ...base, servicios: [{ id: "1", fecha: D("2026-01-10"), fallo: { tipo: "VACIA", fecha: D("2026-02-05") } }] });
check(pendiente.parados === 0 && pendiente.productivos === 171, "servida sin diagnóstico: gestando (0 parados)");
check(vacia.porCausa.VACIA === 171, "al cargar la vacía, los 171 días desde el servicio pasan a parados");

// E · aborto y nuevo servicio 60 días después
const e = r({ ...base, servicios: [{ id: "1", fecha: D("2026-01-10"), fallo: { tipo: "ABORTO", fecha: D("2026-03-01") } }, { id: "2", fecha: D("2026-03-11") }] });
check(e.porCausa.ABORTO === 60, "aborto: 60 días parados hasta el nuevo servicio");

// F · nulípara: fecha objetivo = ingreso + 30 (31/01); servida el 02/03 → 30 días parados
const f = r({ nacimiento: D("2025-03-01"), ingreso: D("2026-01-01"), servicios: [{ id: "1", fecha: D("2026-03-02") }] });
check(f.porCausa.NULIPARA === 30 && f.normales === 30, "nulípara atrasada: 30 normales y 30 parados");

// G · marcada para descarte al destete, sale 21 días después
const g = r({ ...base, salida: { fecha: D("2026-06-10"), tipo: "DESCARTE" }, servicios: [
  { id: "1", fecha: D("2026-01-05"), parto: { fecha: D("2026-04-29"), destete: { fecha: D("2026-05-20"), descarte: true } } },
] });
check(g.porCausa.DESCARTE_DEMORADO === 21, "descarte demorado: 21 días parados");

// H · destetada y muerta sin volver a servirse: todo el hueco es pérdida por muerte
const h = r({ ...base, salida: { fecha: D("2026-06-01"), tipo: "MUERTE" }, servicios: [
  { id: "1", fecha: D("2026-01-05"), parto: { fecha: D("2026-04-29"), destete: { fecha: D("2026-05-20"), descarte: false } } },
] });
check(h.porCausa.MUERTE === 12, "muerte: 12 días parados del destete a la muerte");

// Muere gestando: no hay días parados
const m = r({ ...base, salida: { fecha: D("2026-04-20"), tipo: "MUERTE" }, servicios: [{ id: "1", fecha: D("2026-01-05") }] });
check(m.parados === 0, "muerta gestando: 0 parados");

// Parada hoy
const hoyVacia = paradaHoy(tramosCerda({ id: "x", codigo: "x", ...base, servicios: [{ id: "1", fecha: D("2026-01-10"), fallo: { tipo: "VACIA", fecha: D("2026-02-05") } }] }, P, HOY), HOY);
check(hoyVacia?.causa === "VACIA" && hoyVacia.dias === 171, "vacía sin volver a servir: parada hoy");

// Costo del día parado: ejemplo de septiembre del documento
const k = costoDia({ consumoKgDia: 2.5, precioGestacionKg: 2561.6, fijosGs: 5_735_500, amortizacionGs: 1_561_347, matrices: 37, diasMes: 30,
  partosMeta: 2.4, nacidosMeta: 13, mortalidadMeta: 0.08, precioLechonGs: 435_000, costoVariableLechonGs: 269_355 });
check(Math.abs(k.alimento - 6404) < 1, `alimento por día ≈ Gs 6.404 (${Math.round(k.alimento)})`);
check(Math.abs(k.estructura - 6574) < 1, `estructura por día ≈ Gs 6.574 (${Math.round(k.estructura)})`);
check(Math.abs(k.lucroCesante - 13027) < 2, `lucro cesante por día ≈ Gs 13.027 (${Math.round(k.lucroCesante)})`);
check(Math.abs(k.perdidaDia - 26005) < 3, `pérdida por día ≈ Gs 26.005 (${Math.round(k.perdidaDia)})`);
check(Math.abs(k.perdidaDia * 21 - 546_100) < 60, "una repetición de 21 días ≈ Gs 546.100");
check(Math.abs(partosMaximos(115, 21, 5) - 2.59) < 0.005, "máximo teórico: 2,59 partos por cerda por año");
console.log("\nOK — cerdas paradas verificadas");
