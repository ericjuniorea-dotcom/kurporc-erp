import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

const DEFAULT_METAS = [
  { modulo: "MATERNIDAD", kpiKey: "nacidos_vivos_meta",    valor: 13.5 },
  { modulo: "MATERNIDAD", kpiKey: "mortalidad_pct_max",    valor: 8.0  },
  { modulo: "MATERNIDAD", kpiKey: "peso_destete_kg",       valor: 6.5  },
  { modulo: "MATERNIDAD", kpiKey: "dias_lactancia",        valor: 21   },
  { modulo: "MATERNIDAD", kpiKey: "destetados_parto",      valor: 12.0 },
  { modulo: "MATERNIDAD", kpiKey: "pct_momificados_max",   valor: 1.0  },
  { modulo: "MATERNIDAD", kpiKey: "peso_min_entrada_kg",   valor: 175  },
  { modulo: "GESTACION",  kpiKey: "tasa_concepcion_pct",   valor: 85   },
  { modulo: "GESTACION",  kpiKey: "dias_open_max",         valor: 5    },
  { modulo: "GESTACION",  kpiKey: "partos_cerda_anio",     valor: 2.4  },
  { modulo: "GESTACION",  kpiKey: "peso_gestacion_kg",     valor: 200  },
  { modulo: "GESTACION",  kpiKey: "dias_gestacion",        valor: 114  },
  { modulo: "RECRIA",     kpiKey: "gmd_fase1_gdia",        valor: 350  },
  { modulo: "RECRIA",     kpiKey: "gmd_fase2_gdia",        valor: 550  },
  { modulo: "RECRIA",     kpiKey: "conversion_alimenticia",valor: 1.8  },
  { modulo: "RECRIA",     kpiKey: "peso_umbral_f1_f2",     valor: 15   },
  { modulo: "RECRIA",     kpiKey: "peso_umbral_f2_engorde",valor: 25   },
  { modulo: "ENGORDE",    kpiKey: "peso_faena_objetivo",   valor: 115  },
  { modulo: "ENGORDE",    kpiKey: "dias_engorde",          valor: 90   },
  { modulo: "ENGORDE",    kpiKey: "conversion_alimenticia_engorde", valor: 2.5 },
];

const DEFAULT_GENETICA = [
  { nombre: "TN70", empresa: "Topigs Norsvin", tipoGenetico: "HIBRIDA_F1", funcion: "MATERNA",
    composicionRacial: "Landrace × Large White", metaNacidosVivos: 14 },
  { nombre: "Híbrida DanBred", empresa: "DanBred", tipoGenetico: "HIBRIDA_F1", funcion: "MATERNA",
    composicionRacial: "Landrace × Yorkshire", metaNacidosVivos: 14 },
  { nombre: "Duroc", empresa: "Reproductor propio", tipoGenetico: "RAZA_PURA", funcion: "PATERNA",
    composicionRacial: "Duroc 100%", metaNacidosVivos: null },
  { nombre: "Naïma CG36", empresa: "Nucleus", tipoGenetico: "HIBRIDA_F1", funcion: "MATERNA",
    composicionRacial: "Large White × Landrace", metaNacidosVivos: 14 },
] as const;

// Protocolos de Gestación basados en las fichas técnicas oficiales de los
// laboratorios (día de gestación exacto, no semanas — ver fichaTecnicaUrl de
// cada fila para el PDF original):
// - RHINISENG EXP (Hipra): básica 2 dosis c/nulípara (6-8 sem. preparto + refuerzo
//   3-4 sem. después), revacunación 1 dosis (3-4 sem. preparto). Se mezcla con
//   Suiseng en una sola aplicación de 4ml (grupoMezclaId compartido).
// - SUISENG AM (Hipra): básica 2 dosis (~6 sem. y ~3 sem. preparto), revacunación
//   1 dosis (3 sem. preparto). Mezclable con Rhiniseng.
// - PORCILIS GLÄSSER (MSD): básica 2 dosis c/4 sem. de intervalo (6-8 sem.
//   preparto), revacunación 1 dosis (2-4 sem. preparto). La ficha indica no
//   mezclar con otros medicamentos — se aplica sola, sin grupoMezclaId.
// Gestación de referencia: 114 días (ver ConfigMeta dias_gestacion).
const DEFAULT_VACUNAS = [
  // ── GESTACIÓN ────────────────────────────────────────────────────
  {
    modulo: "GESTACION", nombreVacuna: "Rinitis Atrófica Progresiva", marcaComercial: "Rhiniseng Exp",
    laboratorio: "Hipra", principioActivo: "Bordetella bronchiseptica inactivada + toxina recombinante Pasteurella multocida tipo D",
    enfermedadObjetivo: "Rinitis Atrófica Progresiva",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 72 de gestación",
    paisProcedencia: "ESP", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "NULIPARA", diaGestacion: 72, ordenDosis: 1, grupoMezclaId: "MEZCLA_NULIPARA_D1",
    fichaTecnicaUrl: "https://static-web.hipra.com/migrate_files/product_files/RHINISENG-EXP-703558-00.3_0.pdf",
    notas: "Esquema básico HIPRA (nulípara, primera vez): 2 dosis IM 2ml, día 72 y día 93 de gestación. Se aplica mezclada con Suiseng AM (4ml combinados) en el mismo día.",
  },
  {
    modulo: "GESTACION", nombreVacuna: "Rinitis Atrófica Progresiva", marcaComercial: "Rhiniseng Exp",
    laboratorio: "Hipra", principioActivo: "Bordetella bronchiseptica inactivada + toxina recombinante Pasteurella multocida tipo D",
    enfermedadObjetivo: "Rinitis Atrófica Progresiva",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 93 de gestación",
    paisProcedencia: "ESP", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "NULIPARA", diaGestacion: 93, ordenDosis: 2, grupoMezclaId: "MEZCLA_NULIPARA_D2",
    fichaTecnicaUrl: "https://static-web.hipra.com/migrate_files/product_files/RHINISENG-EXP-703558-00.3_0.pdf",
  },
  {
    modulo: "GESTACION", nombreVacuna: "Rinitis Atrófica Progresiva", marcaComercial: "Rhiniseng Exp",
    laboratorio: "Hipra", principioActivo: "Bordetella bronchiseptica inactivada + toxina recombinante Pasteurella multocida tipo D",
    enfermedadObjetivo: "Rinitis Atrófica Progresiva",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 93 de gestación (revacunación)",
    paisProcedencia: "ESP", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "MULTIPARA", diaGestacion: 93, ordenDosis: 1, grupoMezclaId: "MEZCLA_MULTIPARA",
    fichaTecnicaUrl: "https://static-web.hipra.com/migrate_files/product_files/RHINISENG-EXP-703558-00.3_0.pdf",
    notas: "Revacunación (multípara, ya vacunada en gestaciones previas): 1 sola dosis IM 2ml, 3-4 semanas antes del parto (día 93 de gestación). Mezclada con Suiseng AM.",
  },
  {
    modulo: "GESTACION", nombreVacuna: "Colibacilosis neonatal + Clostridiosis porcina", marcaComercial: "Suiseng AM",
    laboratorio: "Hipra", principioActivo: "Factores de adhesión F4ab/F4ac/F5/F6 de E. coli + enterotoxoide LT + toxoide C. perfringens tipo C + toxoide C. novyi tipo B",
    enfermedadObjetivo: "Colibacilosis neonatal + Clostridiosis porcina",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 72 de gestación",
    paisProcedencia: "ESP", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "NULIPARA", diaGestacion: 72, ordenDosis: 1, grupoMezclaId: "MEZCLA_NULIPARA_D1",
    fichaTecnicaUrl: "https://static-web.hipra.com/2024-03/SUISENG-AM-PY-719232-21.2.pdf",
    notas: "Esquema básico HIPRA (nulípara): 2 dosis IM 2ml, día 72 y día 93 de gestación. Mezclada con Rhiniseng Exp (4ml combinados, agitar suavemente ambos frascos antes de mezclar).",
  },
  {
    modulo: "GESTACION", nombreVacuna: "Colibacilosis neonatal + Clostridiosis porcina", marcaComercial: "Suiseng AM",
    laboratorio: "Hipra", principioActivo: "Factores de adhesión F4ab/F4ac/F5/F6 de E. coli + enterotoxoide LT + toxoide C. perfringens tipo C + toxoide C. novyi tipo B",
    enfermedadObjetivo: "Colibacilosis neonatal + Clostridiosis porcina",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 93 de gestación",
    paisProcedencia: "ESP", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "NULIPARA", diaGestacion: 93, ordenDosis: 2, grupoMezclaId: "MEZCLA_NULIPARA_D2",
    fichaTecnicaUrl: "https://static-web.hipra.com/2024-03/SUISENG-AM-PY-719232-21.2.pdf",
  },
  {
    modulo: "GESTACION", nombreVacuna: "Colibacilosis neonatal + Clostridiosis porcina", marcaComercial: "Suiseng AM",
    laboratorio: "Hipra", principioActivo: "Factores de adhesión F4ab/F4ac/F5/F6 de E. coli + enterotoxoide LT + toxoide C. perfringens tipo C + toxoide C. novyi tipo B",
    enfermedadObjetivo: "Colibacilosis neonatal + Clostridiosis porcina",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 93 de gestación (revacunación)",
    paisProcedencia: "ESP", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "MULTIPARA", diaGestacion: 93, ordenDosis: 1, grupoMezclaId: "MEZCLA_MULTIPARA",
    fichaTecnicaUrl: "https://static-web.hipra.com/2024-03/SUISENG-AM-PY-719232-21.2.pdf",
    notas: "Revacunación (multípara): 1 dosis IM 2ml, 3 semanas antes de la fecha esperada de parto (día 93 de gestación). Mezclada con Rhiniseng Exp.",
  },
  {
    modulo: "GESTACION", nombreVacuna: "Enfermedad de Glässer", marcaComercial: "Porcilis Glässer",
    laboratorio: "MSD", principioActivo: "Glaesserella (Haemophilus) parasuis cepa 4800 serotipo 5 inactivada",
    enfermedadObjetivo: "Enfermedad de Glässer",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 60 de gestación",
    paisProcedencia: "NLD", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "NULIPARA", diaGestacion: 60, ordenDosis: 1,
    fichaTecnicaUrl: "https://www.msd-salud-animal.com.ar/wp-content/uploads/sites/44/2023/05/Ficha-Tecnica-Porcilis-Glasser.pdf",
    notas: "Esquema básico MSD (nulípara): 2 dosis IM 2ml con 4 semanas de intervalo, día 60 y día 88 de gestación (6-8 semanas preparto). La ficha indica no administrar junto con otros medicamentos — aplicar en sitio y momento propio.",
  },
  {
    modulo: "GESTACION", nombreVacuna: "Enfermedad de Glässer", marcaComercial: "Porcilis Glässer",
    laboratorio: "MSD", principioActivo: "Glaesserella (Haemophilus) parasuis cepa 4800 serotipo 5 inactivada",
    enfermedadObjetivo: "Enfermedad de Glässer",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 88 de gestación",
    paisProcedencia: "NLD", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "NULIPARA", diaGestacion: 88, ordenDosis: 2,
    fichaTecnicaUrl: "https://www.msd-salud-animal.com.ar/wp-content/uploads/sites/44/2023/05/Ficha-Tecnica-Porcilis-Glasser.pdf",
  },
  {
    modulo: "GESTACION", nombreVacuna: "Enfermedad de Glässer", marcaComercial: "Porcilis Glässer",
    laboratorio: "MSD", principioActivo: "Glaesserella (Haemophilus) parasuis cepa 4800 serotipo 5 inactivada",
    enfermedadObjetivo: "Enfermedad de Glässer",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 90 de gestación (revacunación)",
    paisProcedencia: "NLD", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "MULTIPARA", diaGestacion: 90, ordenDosis: 1,
    fichaTecnicaUrl: "https://www.msd-salud-animal.com.ar/wp-content/uploads/sites/44/2023/05/Ficha-Tecnica-Porcilis-Glasser.pdf",
    notas: "Revacunación (multípara): 1 dosis IM 2ml, entre 4 y 2 semanas antes del parto (día 90 de gestación).",
  },
  // ── MATERNIDAD ───────────────────────────────────────────────────
  // Protocolo dividido en dos sujetos: LECHÓN (día de vida) y HEMBRA en
  // lactación (día post-parto) — ver fichaTecnicaUrl de cada fila para el PDF
  // original de cada laboratorio.
  // Lechones: Previron (día 3) → Baycox 5% (día 5) → Porcilis PCV M Hyo +
  // Porcilis Ileitis (día 21, inyecciones separadas) → Porcilis Glässer (día 41).
  // Hembras lactantes: Eryseng Parvo/Lepto (día 7 post-parto) → Stimovit MOV (día 10 post-parto).
  {
    modulo: "MATERNIDAD", nombreVacuna: "Anemia ferropénica neonatal", marcaComercial: "Previron",
    laboratorio: "Hipra", principioActivo: "Hierro (III) 200 mg/ml (como gleptoferrón)",
    enfermedadObjetivo: "Anemia ferropénica neonatal",
    viaAplicacion: "IM", dosisMl: 1, momentoAplicacion: "Día 3 de vida",
    paisProcedencia: "ESP", tempConservacion: "Sin refrigeración (temp. ambiente)", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "AMBAS", sujeto: "LECHON", diaReferencia: 3, ordenDosis: 1,
    fichaTecnicaUrl: "https://static-web.hipra.com/2023-06/PREVIRON-EU-ES-714301-22.0.pdf",
    notas: "1 sola dosis IM de 1 ml (200 mg de hierro), inyección profunda, entre el día 1 y 3 de vida.",
  },
  {
    modulo: "MATERNIDAD", nombreVacuna: "Coccidiosis neonatal", marcaComercial: "Baycox 5%",
    laboratorio: "Bayer", principioActivo: "Toltrazuril 50 mg/ml",
    enfermedadObjetivo: "Coccidiosis neonatal (Isospora suis)",
    viaAplicacion: "ORAL", dosisMl: 0.6, momentoAplicacion: "Día 5 de vida",
    paisProcedencia: "DEU", tempConservacion: "15–30 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "AMBAS", sujeto: "LECHON", diaReferencia: 5, ordenDosis: 1,
    fichaTecnicaUrl: "https://servicampodelvallesa.com/demo/wp-content/uploads/2020/09/Baycox-5-Susp-Oral-Ficha-Tecnica.pdf",
    notas: "Dosis oral única de 20 mg de toltrazuril por kg de peso (0,4 ml de suspensión/kg). El valor de 0,6 ml es un estimado para un lechón de ~1,5 kg — ajustar según peso real. Aplicar entre el día 3 y 5 de vida.",
  },
  {
    modulo: "MATERNIDAD", nombreVacuna: "Circovirus Porcino Tipo 2 (PCV2) + Mycoplasma hyopneumoniae", marcaComercial: "Porcilis PCV M Hyo",
    laboratorio: "MSD", principioActivo: "Antígeno subunitario ORF2 de Circovirus Porcino Tipo 2 + Mycoplasma hyopneumoniae inactivado",
    enfermedadObjetivo: "Circovirus Porcino Tipo 2 (PCV2) + Mycoplasma hyopneumoniae",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 21 de vida (dosis única)",
    paisProcedencia: "NLD", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "AMBAS", sujeto: "LECHON", diaReferencia: 21, ordenDosis: 1,
    fichaTecnicaUrl: "https://www.msd-salud-animal.com.co/wp-content/uploads/sites/46/2024/07/FT-PorcilisPCV-M-Hyo_V02_20240305.pdf",
    notas: "Esquema de una sola dosis: 2 ml IM a partir de las 3 semanas (día 21) de edad.",
  },
  {
    modulo: "MATERNIDAD", nombreVacuna: "Ileítis porcina", marcaComercial: "Porcilis Ileitis",
    laboratorio: "MSD", principioActivo: "Lawsonia intracellularis inactivada, cepa SPAH08",
    enfermedadObjetivo: "Ileítis porcina (Lawsonia intracellularis)",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 21 de vida",
    paisProcedencia: "USA", tempConservacion: "2–7 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "AMBAS", sujeto: "LECHON", diaReferencia: 21, ordenDosis: 1,
    fichaTecnicaUrl: "https://www.msd-salud-animal.com.ar/wp-content/uploads/sites/44/2022/06/Porcilis-ILEITIS-6-22.pdf",
    notas: "2 ml IM, cerdos de 3 semanas de edad o mayores. Inyección separada de Porcilis PCV M Hyo (mismo día, distinto sitio) — la ficha no indica mezcla.",
  },
  {
    modulo: "MATERNIDAD", nombreVacuna: "Erisipela + Parvovirosis + Leptospirosis Porcina", marcaComercial: "Eryseng Parvo/Lepto",
    laboratorio: "Hipra", principioActivo: "Parvovirus porcino inactivado + Erysipelothrix rhusiopathiae inactivado + 6 serovares de Leptospira interrogans inactivados",
    enfermedadObjetivo: "Erisipela + Parvovirosis + Leptospirosis Porcina",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 7 post-parto",
    paisProcedencia: "BRA", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "AMBAS", sujeto: "HEMBRA", diaReferencia: 7, ordenDosis: 1,
    fichaTecnicaUrl: "https://static-web.hipra.com/2024-03/ERYSENG-PARVO-LEPTO-LAMI-AM-PY-719646-21.1.pdf",
    notas: "2 ml IM. La ficha indica que puede utilizarse durante la gestación y la lactancia; protocolo de la granja: aplicar 7 días post-parto.",
  },
  {
    modulo: "MATERNIDAD", nombreVacuna: "Suplementación reconstituyente post-parto", marcaComercial: "Stimovit MOV",
    laboratorio: "MSD", principioActivo: "Hierro dextrano + cobre + glutamato + aminoácidos (arginina, lisina, treonina, valina) + vitaminas B3/B8",
    enfermedadObjetivo: null,
    viaAplicacion: "IM", dosisMl: 5, momentoAplicacion: "Día 10 post-parto",
    paisProcedencia: "BRA", tempConservacion: "Menos de 30 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "AMBAS", sujeto: "HEMBRA", diaReferencia: 10, ordenDosis: 1,
    fichaTecnicaUrl: "https://www.msd-salud-animal.com.co/wp-content/uploads/sites/46/2024/07/FT-StimovitMOV_V02_20240229.pdf",
    notas: "Adultos: 5 ml IM, dosis única. Reconstituyente/vigorizante — no es una vacuna contra una enfermedad específica.",
  },
  // ── RECRÍA / INICIACIÓN ────────────────────────────────────────────
  // Único protocolo vigente en esta etapa: Glässer, aplicado a los lechones
  // que ya pasaron por Maternidad (día 41 de vida cae en Iniciación, no en
  // Maternidad — de ahí que la fila viva en el módulo RECRIA).
  {
    modulo: "RECRIA", nombreVacuna: "Enfermedad de Glässer", marcaComercial: "Porcilis Glässer",
    laboratorio: "MSD", principioActivo: "Glaesserella (Haemophilus) parasuis cepa 4800 serotipo 5 inactivada",
    enfermedadObjetivo: "Enfermedad de Glässer",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 41 de vida",
    paisProcedencia: "NLD", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
    diasEsperaServicio: 0, paridad: "AMBAS", sujeto: "LECHON", diaReferencia: 41, ordenDosis: 1,
    fichaTecnicaUrl: "https://www.msd-salud-animal.com.ar/wp-content/uploads/sites/44/2023/05/Ficha-Tecnica-Porcilis-Glasser.pdf",
    notas: "Esquema del protocolo de la granja: 1 dosis al día 41 de vida. La ficha oficial del esquema en cerdos en recría prevé 2 dosis con 2 semanas de intervalo (desde las 5 semanas) — agregar una 2ª fila si se decide adoptar el esquema completo.",
  },
] as const;

const DEFAULT_ALERTAS = [
  { modulo: "MATERNIDAD", eventoKey: "mortalidad_alta",     umbral: 8,   canales: ["SISTEMA"], gravedad: "DANGER",  activa: true },
  { modulo: "MATERNIDAD", eventoKey: "bajo_nacidos_vivos",  umbral: 10,  canales: ["SISTEMA"], gravedad: "WARNING", activa: true },
  { modulo: "GESTACION",  eventoKey: "baja_concepcion",           umbral: 75, canales: ["SISTEMA"], gravedad: "WARNING", activa: true },
  { modulo: "GESTACION",  eventoKey: "dias_open_excedidos",       umbral: 5,  canales: ["SISTEMA"], gravedad: "INFO",    activa: true },
  { modulo: "GESTACION",  eventoKey: "repeticiones_celo_descarte",umbral: 4,  canales: ["SISTEMA"], gravedad: "WARNING", activa: true },
  { modulo: "RECRIA",     eventoKey: "baja_gmd",            umbral: 300, canales: ["SISTEMA"], gravedad: "WARNING", activa: true },
  { modulo: "ENGORDE",    eventoKey: "atraso_peso_faena",   umbral: 100, canales: ["SISTEMA"], gravedad: "WARNING", activa: true },
];

export async function POST() {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;
  const userId = session.user.id;

  const results = { metas: 0, razas: 0, vacunas: 0, alertas: 0 };

  for (const m of DEFAULT_METAS) {
    await prisma.configMeta.upsert({
      where: { tenantId_modulo_kpiKey: { tenantId, modulo: m.modulo, kpiKey: m.kpiKey } },
      create: { tenantId, ...m, updatedBy: userId },
      update: {},
    });
    results.metas++;
  }

  for (const r of DEFAULT_GENETICA) {
    await prisma.genetica.upsert({
      where: { tenantId_nombre: { tenantId, nombre: r.nombre } },
      create: { tenantId, activa: true, ...r },
      update: {},
    });
    results.razas++;
  }

  for (const v of DEFAULT_VACUNAS) {
    const existe = await prisma.configVacuna.findFirst({
      where: {
        tenantId, modulo: v.modulo, marcaComercial: v.marcaComercial,
        paridad: v.paridad, ordenDosis: v.ordenDosis, activa: true,
      },
    });
    if (!existe) {
      await prisma.configVacuna.create({ data: { tenantId, activa: true, ...v } });
      results.vacunas++;
    }
  }

  for (const a of DEFAULT_ALERTAS) {
    await prisma.configAlerta.upsert({
      where: { tenantId_modulo_eventoKey: { tenantId, modulo: a.modulo, eventoKey: a.eventoKey } },
      create: { tenantId, ...a, updatedAt: new Date() },
      update: {},
    });
    results.alertas++;
  }

  return NextResponse.json({ ok: true, seeded: results });
}
