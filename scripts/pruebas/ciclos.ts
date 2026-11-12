/**
 * Línea de tiempo de los ciclos de una cerda (ficha → Ciclos), con casos calculados a mano.
 *   npm run prueba:ciclos
 */
import { ciclosCerda, type Entrada } from "@/lib/plantel/ciclos";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
const D = (s: string) => new Date(`${s}T00:00:00Z`);
const OBJ = { gestacion: 115, lactancia: 21, idsMax: 7, edadPrimerServicio: 240, adaptacion: 30, tolerancia: 2 };
const base = (x: Partial<Entrada>): Entrada => ({
  ingreso: D("2025-10-01"), nacimiento: D("2025-03-01"), compra: true, descarte: null, hoy: D("2026-11-11"),
  servicios: [], partos: [], fallos: [], adopcionesRecibidas: [], adopcionesDonadas: [], objetivo: OBJ, ...x,
});

// Como la imagen de referencia: compra → 86 días → servicio (3 montas) → 114 días → parto 14/0 → 32 días → destete 14 → 4 días → servicio …
const filas = ciclosCerda(base({
  nacimiento: D("2025-05-01"), // edad objetivo (240 días) el 27/12/2025: el primer servicio llega a tiempo
  servicios: [{ id: "a", fecha: D("2025-12-26") }, { id: "b", fecha: D("2025-12-27") }, { id: "c", fecha: D("2025-12-28") }, { id: "d", fecha: D("2026-05-25") }],
  partos: [
    { id: "p1", servicioId: "a", inicio: D("2026-04-19"), duracionMin: 120, vivos: 14, muertos: 0, momias: 0, pesoMedio: 1.29, muertesLechones: 0, destete: { fecha: D("2026-05-21"), destetados: 14, pesoMedio: 7.27, recibidos: 0, donados: 0 } },
    { id: "p2", servicioId: "d", inicio: D("2026-09-16"), duracionMin: 120, vivos: 13, muertos: 0, momias: 0, pesoMedio: 1.5, muertesLechones: 0, destete: { fecha: D("2026-10-08"), destetados: 11, pesoMedio: 6.2, recibidos: 0, donados: 2 } },
  ],
}));
check(filas.map(f => f.numero).join(",") === "2,1,0", "filas 2, 1 y 0, la más nueva arriba");
const f0 = filas[2], f1 = filas[1], f2 = filas[0];
check(f0.nodos[0].tipo === "COMPRA" && f0.tramos[0].dias === 86, "fila 0: compra y 86 días hasta el primer servicio");
check(f0.tramos[0].perdida === false, "fila 0: sin pérdida (antes de la edad objetivo + tolerancia)");
check(f1.nodos[0].centro === "3", "servicio con 3 montas en el mismo celo");
check(f1.tramos.map(t => t.dias).join(",") === "114,32,4", "ciclo 1: 114 de gestación, 32 de lactancia, 4 vacía");
check(f1.nodos[1].centro === "14/0" && f1.nodos[2].centro === "14", "parto 14/0 y 14 destetados");
check(f1.nodos[3].tipo === "FIN" && f1.tramos[2].perdida === false, "4 días vacía: normal, termina en el servicio siguiente");
check(f2.tramos[2].dias === 34 && f2.tramos[2].perdida && f2.nodos[3].tipo === "HOY", "ciclo 2: 34 días vacía hasta hoy, en rojo");
check(f2.tramos[1].abajo.includes("Donados: 2"), "lactancia muestra los donados");

// Repetición y gestación en curso
const g = ciclosCerda(base({
  servicios: [{ id: "s1", fecha: D("2026-05-01") }, { id: "s2", fecha: D("2026-05-22") }],
  fallos: [{ servicioId: "s1", fecha: D("2026-05-22"), tipo: "REPETICION" }],
}));
check(g.length === 3 && g[1].nodos[1].tipo === "REPETICION" && g[1].tramos[0].perdida, "servicio que repitió: fila en rojo que termina en «Repitió celo»");
check(g[0].nodos[1].previsto && g[0].nodos[1].tipo === "PARTO" && g[0].tramos[0].dias === 115, "último servicio sin parto todavía: parto previsto a los 115 días, punteado");

// Lactancia en curso: destete previsto
const l = ciclosCerda(base({
  servicios: [{ id: "x", fecha: D("2026-07-01") }],
  partos: [{ id: "p", servicioId: "x", inicio: D("2026-10-24"), duracionMin: null, vivos: 12, muertos: 1, momias: 1, pesoMedio: null, muertesLechones: 1, destete: null }],
}));
check(l[0].nodos[1].centro === "12/2" && l[0].nodos[2].previsto && l[0].nodos[2].centro === "11", "en lactancia: parto 12/2 y destete previsto con 11 al pie");

// Nulípara que pasó su fecha objetivo sin servicio
const nul = ciclosCerda(base({ ingreso: D("2026-01-14"), nacimiento: D("2025-06-01") }));
check(nul.length === 1 && nul[0].tramos[0].perdida && nul[0].nodos[1].tipo === "HOY", "nulípara sin servicio pasada la edad objetivo: en rojo hasta hoy");
console.log("Todo bien.");
