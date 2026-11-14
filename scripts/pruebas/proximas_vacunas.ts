/**
 * Próximas vacunas de una cerda según el protocolo (ficha → Vacunas).
 *   npm run prueba:proximas-vacunas
 */
import { proximasCerda, type EntradaProximas, type ItemProtocolo } from "@/lib/sanidad/proximas-cerda";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
const D = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date | null) => d?.toISOString().slice(0, 10);
const items: ItemProtocolo[] = [
  { id: "mov", dia: 7, disparador: "parto", vacuna: "MOV", descripcion: null },
  { id: "ery", dia: 7, disparador: "parto", vacuna: "ERYSENG", descripcion: null },
  { id: "rh1", dia: 70, disparador: "servicio", vacuna: "RHINISENG", descripcion: "1ª dosis" },
  { id: "gla", dia: 80, disparador: "servicio", vacuna: "PORCILIS GLASSER", descripcion: null },
];
const base = (x: Partial<EntradaProximas>): EntradaProximas => ({
  hoy: D("2026-11-14"), estado: "LACTATING", activa: true, partoAbierto: null, servicioEnCurso: null, agenda: [], items,
  param: { gestacion: 115, lactancia: 21, ids: 5 }, ...x,
});

// 13022: parió el 02/11, la agenda tiene MOV + Eryseng del 09/11 atrasadas
const l = proximasCerda(base({
  partoAbierto: D("2026-11-02"),
  agenda: [
    { id: "e1", fecha: D("2026-11-09"), estado: "retrasado", vacuna: "MOV", descripcion: null, protocoloItemId: "mov" },
    { id: "e2", fecha: D("2026-11-09"), estado: "retrasado", vacuna: "ERYSENG", descripcion: null, protocoloItemId: "ery" },
  ],
}));
check(iso(l[0].fecha) === "2026-11-09" && l[0].vacunas.length === 2 && !l[0].estimada && l[0].vacunas.every(v => v.estado === "retrasado"), "lactante: primero MOV + Eryseng del 09/11, juntas y atrasadas");
check(!l.some(p => p.estimada && p.base.includes("del parto (")), "lo ya agendado del parto no se repite como estimado");
const rh = l.find(p => p.vacunas.some(v => v.nombre === "RHINISENG"));
// destete 23/11 + 5 = servicio 28/11; +70 = 06/02/2027
check(rh && rh.estimada && iso(rh.fecha) === "2027-02-06", "Rhiniseng estimada a los 70 días del próximo servicio (28/11 → 06/02/2027)");
const prox = l.filter(p => p.base.includes("próximo parto"));
check(prox.length === 1 && iso(prox[0].fecha) === "2027-03-30", "MOV + Eryseng del próximo parto estimadas (parto 23/03 + 7)");

// Gestante: servida el 01/10, ya tiene agendada la Rhiniseng
const g = proximasCerda(base({
  estado: "PREGNANT", servicioEnCurso: D("2026-10-01"),
  agenda: [{ id: "r", fecha: D("2026-12-10"), estado: "pendiente", vacuna: "RHINISENG", descripcion: null, protocoloItemId: "rh1" }],
}));
check(iso(g[0].fecha) === "2026-12-10" && !g[0].estimada, "gestante: primero la Rhiniseng agendada");
check(g.some(p => p.estimada && iso(p.fecha) === "2026-12-20" && p.vacunas[0].nombre === "PORCILIS GLASSER"), "falta agendar Glasser: estimada el día 80");
check(g.some(p => iso(p.fecha) === "2027-01-31"), "posparto estimado: parto 24/01 + 7 = 31/01");

// Vacía: sin fecha, se agendan al servirla
const v = proximasCerda(base({ estado: "EMPTY" }));
check(v.length === 2 && v.every(p => p.fecha === null) && v[0].base.includes("día 70"), "vacía: las de gestación sin fecha, «al servirla»");
check(proximasCerda(base({ activa: false, partoAbierto: D("2026-11-02") })).length === 0, "de baja: nada");
console.log("Todo bien.");
