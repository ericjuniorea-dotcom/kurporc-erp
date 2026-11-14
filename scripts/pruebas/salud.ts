/**
 * Fase 15.4 · Semáforo de salud del cliente (src/lib/admin/salud-calculo.ts).
 *   npm run prueba:salud
 */
import { calcularSalud, type EntradaSalud } from "@/lib/admin/salud-calculo";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
const base: EntradaSalud = { diasDesdeAlta: 60, diasDesdeUltimoUso: 1, primerosPasos: true, cargoUltimos7: true, cargoAlgunaVez: true };
const s = (x: Partial<EntradaSalud>) => calcularSalud({ ...base, ...x });

check(s({ diasDesdeAlta: 3, diasDesdeUltimoUso: null, cargoAlgunaVez: false, cargoUltimos7: false }) === "NUEVO", "alta de hace 3 días, sin nada: nuevo");
check(s({ diasDesdeAlta: 6 }) === "NUEVO", "alta de hace 6 días: nuevo aunque ya cargue");
check(s({ diasDesdeUltimoUso: 14 }) === "ROJO", "sin uso hace 14 días: rojo");
check(s({ diasDesdeUltimoUso: 30, cargoUltimos7: false }) === "ROJO", "sin uso hace 30 días: rojo");
check(s({ diasDesdeUltimoUso: null }) === "ROJO", "nunca usó y ya pasó la semana: rojo");
check(s({ diasDesdeAlta: 10, cargoAlgunaVez: false, cargoUltimos7: false }) === "ROJO", "más de 7 días desde el alta sin cargar nunca: rojo (aunque use)");
check(s({}) === "VERDE", "usó y cargó en los últimos 7 días con los primeros pasos completos: verde");
check(s({ diasDesdeUltimoUso: 6 }) === "VERDE", "usó hace 6 días: sigue verde");
check(s({ cargoUltimos7: false }) === "AMARILLO", "usa pero no cargó esta semana: amarillo");
check(s({ diasDesdeUltimoUso: 9 }) === "AMARILLO", "último uso hace 9 días (menos de 14): amarillo");
check(s({ primerosPasos: false }) === "AMARILLO", "primeros pasos incompletos: amarillo");
console.log("Todo bien.");
