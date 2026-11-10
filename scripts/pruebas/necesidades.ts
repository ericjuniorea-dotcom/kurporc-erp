/**
 * Prueba de la Fase 14 (criterios de aceptación):
 *  - La cantidad sugerida coincide con el cálculo a mano (ejemplo del documento: 1.200 kg, 180 kg/día → pedir 3.000 kg).
 *  - Vacunas: frascos agrupados por día de aplicación.
 *  - Sin historia ni modelo → SIN_DATOS.
 *  - Ración: gestación → parto → lactancia → destete con el calendario.
 *  - Con la base: el cálculo corre para una granja real y guarda la foto.
 *   npm run prueba:necesidades
 */
import prisma from "@/lib/db/prisma";
import { consumoHistoricoDiario, consumoProgramado, consumoRacion, explicar, horizonte, PARAM_DEFECTO, sugerir, type Raciones } from "@/lib/necesidades/calculo";
import { calcularNecesidades } from "@/lib/necesidades/datos";

function check(cond: unknown, msg: string) { if (!cond) throw new Error(`FALLA: ${msg}`); console.log(`  ✓ ${msg}`); }
const HOY = new Date("2026-11-10T00:00:00Z");
const D = (dias: number) => new Date(HOY.getTime() + dias * 86_400_000);

async function main() {
  console.log("Sugerencia (14.3)");
  const p = { ...PARAM_DEFECTO, unidadCompra: 1000 };
  check(horizonte(p) === 19, "H = 5 + 7 + 7 = 19 días");
  const s = sugerir(new Array(60).fill(180), 1200, 0, p);
  // demanda de hoy a hoy+19 = 20 días × 180 = 3.600; falta 3.600 − 1.200 = 2.400 → redondeado a 1.000 kg = 3.000
  check(Math.round(s.demandaH) === 3600 && s.cantidad === 3000, "1.200 kg con 180 kg/día → sugerido 3.000 kg (en bolsones de 1.000)");
  check(s.fechaQuiebre === 6 && s.urgencia === "PRONTO", "se termina el día 6: PRONTO (más que el plazo de 5, menos que 5 + 7)");
  check(sugerir(new Array(60).fill(180), 600, 0, p).urgencia === "CRITICA", "con 600 kg (3 días) es CRÍTICA");
  check(sugerir(new Array(60).fill(180), 1200, 2400, p).cantidad === 0, "con 2.400 kg en camino no hace falta pedir");
  const conMerma = sugerir(new Array(60).fill(100), 0, 0, { ...PARAM_DEFECTO, mermaPct: 0.2 });
  check(Math.round(conMerma.demandaH) === 2500, "merma 20 %: 100 kg/día se vuelven 125");
  const txt = explicar({ producto: "maíz", unidad: "kg", stock: 1200, enTransito: 0, metodo: "RACION", motivoConsumo: "Con 38 cerdas en gestación y 6 en lactancia", s, p, hoy: HOY });
  check(txt.includes("Tenés 1.200 kg de maíz") && txt.includes("180 kg por día") && txt.includes("16/11") && txt.includes("3.000 kg"), "la explicación dice stock, consumo, plazo, fecha de quiebre y cuánto pedir");

  console.log("Vacunas: frascos por día (M2)");
  const v = consumoProgramado(HOY, [{ fecha: D(2), dosis: 12 }, { fecha: D(2), dosis: 30 }, { fecha: D(9), dosis: 10 }, { fecha: D(-1), dosis: 5 }], 2, 25);
  check(v[2] === 100, "día 2: 42 dosis → 2 frascos de 25 = 50 dosis = 100 ml (2 ml/dosis)");
  check(v[9] === 50 && v[0] === 50, "día 9: 10 dosis → 1 frasco; una aplicación atrasada se necesita hoy");
  check(consumoProgramado(HOY, [{ fecha: D(2), dosis: 42 }], 1, null)[2] === 42, "sin envase conocido: dosis exactas");

  console.log("Sin datos (M3)");
  check(consumoHistoricoDiario([5, 0, 3, 0, 0, 0, 0, 0]) === null, "2 semanas con salidas → sin datos");
  check(sugerir(null, 10, 0, PARAM_DEFECTO).urgencia === "SIN_DATOS", "sin modelo ni historia → SIN_DATOS");
  const h = consumoHistoricoDiario([70, 70, 70, 0, 0, 0, 0, 0])!;
  check(Math.abs(h - (70 * (8 + 7 + 6)) / 36 / 7) < 1e-9, "promedio ponderado de 8 semanas (la última pesa 8)");

  console.log("Ración con calendario (M1)");
  const r: Raciones = { gestacionKgDia: 2.5, lactacionKgDia: 8, preInicial1KgLechon: 2, preInicial2KgLechon: 4, inicialKgLechon: 35, gestacionDias: 115, lactanciaDias: 21, lechonesPorParto: 12 };
  const madres = [{ estado: "GESTANTE" as const, servicio: D(-100) }]; // pare el día 15, desteta el 36
  const ges = consumoRacion("GESTATION", HOY, madres, [], [], r), lac = consumoRacion("LACTATION", HOY, madres, [], [], r);
  check(ges[0] === 2.5 && ges[14] === 2.5 && ges[15] === 0 && ges[36] === 2.5, "gestación hasta el parto (día 15) y de nuevo desde el destete (día 36)");
  check(lac[15] === 8 && lac[35] === 8 && lac[36] === 0 && lac.reduce((a, b) => a + b, 0) === 168, "lactancia: 21 días × 8 kg = 168 kg");
  const pre = consumoRacion("PRE_STARTER", HOY, madres, [], [], r).reduce((a, b) => a + b, 0);
  check(Math.abs(pre - 24) < 0.01, "pre-inicial: 12 lechones × 2 kg = 24 kg en la lactancia (consumo acumulado)");
  const f1 = consumoRacion("PHASE_1", HOY, [], [{ destete: D(-7), cantidad: 100 }], [], r).reduce((a, b) => a + b, 0);
  check(Math.abs(f1 - 200) < 0.01, "recría ya destetada hace 7 días: queda la mitad del programa (100 × 4 kg × 7/14 = 200 kg)");

  console.log("Base de datos");
  // La granja con más madres activas (en la copia local, KurPorc Granja)
  const top = await prisma.sow.groupBy({ by: ["tenantId"], where: { isActive: true }, _count: { tenantId: true }, orderBy: { _count: { tenantId: "desc" } }, take: 1 });
  const org = top[0] ? await prisma.tenant.findUnique({ where: { id: top[0].tenantId }, select: { id: true, farmName: true } })
    : await prisma.tenant.findFirst({ where: { tipo: { not: "VENDEDOR" } }, select: { id: true, farmName: true } });
  if (org) {
    const antes = await prisma.necesidadSnapshot.count({ where: { organizacionId: org.id } });
    const { filas } = await calcularNecesidades(org.id, { forzar: true });
    const despues = await prisma.necesidadSnapshot.count({ where: { organizacionId: org.id } });
    check(despues - antes === filas.length, `${org.farmName}: ${filas.length} productos calculados y guardados en la foto`);
    check(filas.every(f => f.explicacion.length > 20), "cada fila tiene su explicación");
    const sanit = filas.filter(f => ["VACUNA", "MEDICAMENTO", "SUPLEMENTO"].includes(f.categoria));
    if (sanit.length) console.log(`    (sanidad: ${sanit.filter(f => f.metodo === "PROGRAMADO").length} de ${sanit.length} por calendario)`);
    await prisma.necesidadSnapshot.deleteMany({ where: { organizacionId: org.id, calculadoEn: { gte: new Date(Date.now() - 60_000) } } });
  }
  console.log("Todo bien.");
}

main().then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
