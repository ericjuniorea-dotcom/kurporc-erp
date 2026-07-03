import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
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

const DEFAULT_RAZAS = [
  { nombre: "Landrace",    tipoLinea: "MATERNA",   usoPrincipal: "Línea materna pura — alta prolificidad", nacidosVivosMeta: 14, diasGestacion: 115 },
  { nombre: "Large White", tipoLinea: "MATERNA",   usoPrincipal: "Línea materna pura — robustez", nacidosVivosMeta: 13.5, diasGestacion: 114 },
  { nombre: "Duroc",       tipoLinea: "PATERNA",   usoPrincipal: "Línea paterna — calidad cárnica", nacidosVivosMeta: 10, diasGestacion: 113 },
  { nombre: "Pietrain",    tipoLinea: "PATERNA",   usoPrincipal: "Línea paterna — magro", nacidosVivosMeta: 9, diasGestacion: 114 },
  { nombre: "F1 LW x LR", tipoLinea: "HIBRIDA",   usoPrincipal: "Hembra comercial F1 — vigor híbrido", nacidosVivosMeta: 14, diasGestacion: 114 },
];

const DEFAULT_VACUNAS = [
  // ── GESTACIÓN ────────────────────────────────────────────────────
  {
    modulo: "GESTACION", nombreVacuna: "Parvovirus + Leptospira (pre-servicio)", marcaComercial: "Farrowsure Gold B",
    laboratorio: "Zoetis", principioActivo: "Parvovirus porcino + Leptospira spp.",
    enfermedadObjetivo: "Parvovirosis porcina + Leptospirosis",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "2–3 semanas antes del servicio", refuerzoDias: 180,
    paisProcedencia: "USA", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
  },
  {
    modulo: "GESTACION", nombreVacuna: "PCV2 Circovirus", marcaComercial: "Ingelvac CircoFLEX",
    laboratorio: "Boehringer Ingelheim", principioActivo: "Circovirus porcino tipo 2 (subunit.)",
    enfermedadObjetivo: "Circovirus Porcino Tipo 2 (PCV2)",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Al servicio / detección de celo", refuerzoDias: 180,
    paisProcedencia: "DEU", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
  },
  {
    modulo: "GESTACION", nombreVacuna: "PRRS MLV", marcaComercial: "Ingelvac PRRS MLV",
    laboratorio: "Boehringer Ingelheim", principioActivo: "PRRS virus vivo modificado",
    enfermedadObjetivo: "Síndrome Reproductivo y Respiratorio Porcino (PRRS)",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Al destete + 4 semanas (repetir c/6 meses)", refuerzoDias: 180,
    paisProcedencia: "DEU", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
  },
  {
    modulo: "GESTACION", nombreVacuna: "Influenza porcina", marcaComercial: "FluSure XP",
    laboratorio: "Zoetis", principioActivo: "Influenza porcina H1N1 + H3N2 inactivada",
    enfermedadObjetivo: "Influenza Porcina (SIV)",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Semana 4–6 de gestación", refuerzoDias: 180,
    paisProcedencia: "USA", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: false,
  },
  {
    modulo: "GESTACION", nombreVacuna: "Erisipela porcina", marcaComercial: "Eryseng",
    laboratorio: "Hipra", principioActivo: "Erysipelothrix rhusiopathiae serotipo 1 + 2 inactivado",
    enfermedadObjetivo: "Erisipela (Mal rojo)",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Al servicio o 2 semanas antes", refuerzoDias: 180,
    paisProcedencia: "ESP", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: false,
  },
  // ── MATERNIDAD ───────────────────────────────────────────────────
  {
    modulo: "MATERNIDAD", nombreVacuna: "Parvovirus + Leptospira (pre-parto)", marcaComercial: "Farrowsure Gold B",
    laboratorio: "Zoetis", principioActivo: "Parvovirus porcino + Leptospira spp.",
    enfermedadObjetivo: "Parvovirosis + Leptospirosis",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "21 días pre-parto", refuerzoDias: 180,
    paisProcedencia: "USA", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
  },
  {
    modulo: "MATERNIDAD", nombreVacuna: "E.coli + Clostridiosis", marcaComercial: "Clostrishield 4",
    laboratorio: "MSD", principioActivo: "E.coli K88/K99 + Clostridium perfringens A/C",
    enfermedadObjetivo: "Colibacilosis + Clostridiosis neonatal",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "35 días pre-parto", refuerzoDias: 180,
    paisProcedencia: "USA", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
  },
  {
    modulo: "MATERNIDAD", nombreVacuna: "Hierro dextrano (lechones)", marcaComercial: "Gleptosil",
    laboratorio: "Varios", principioActivo: "Fe-dextrano 200 mg/ml",
    enfermedadObjetivo: "Anemia ferropénica neonatal",
    viaAplicacion: "IM", dosisMl: 1, momentoAplicacion: "Día 3 de vida del lechón",
    paisProcedencia: "DEU", tempConservacion: "Temp. ambiente", diasAlertaVto: 30, obligatoria: true,
  },
  // ── RECRÍA ───────────────────────────────────────────────────────
  {
    modulo: "RECRIA", nombreVacuna: "Mycoplasma hyopneumoniae", marcaComercial: "M+PAC",
    laboratorio: "Elanco", principioActivo: "Mycoplasma hyopneumoniae inactivada",
    enfermedadObjetivo: "Neumonía enzoótica porcina (Mycoplasma)",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Día 7 de vida (1ª dosis)",
    paisProcedencia: "USA", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
  },
  {
    modulo: "RECRIA", nombreVacuna: "PCV2 (lechones)", marcaComercial: "Ingelvac CircoFLEX",
    laboratorio: "Boehringer Ingelheim", principioActivo: "Circovirus porcino tipo 2 (subunit.)",
    enfermedadObjetivo: "Circovirus Porcino Tipo 2 (PCV2)",
    viaAplicacion: "IM", dosisMl: 1, momentoAplicacion: "Semana 3 de vida (1 dosis única)",
    paisProcedencia: "DEU", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: true,
  },
  {
    modulo: "RECRIA", nombreVacuna: "Actinobacillus pleuropneumoniae", marcaComercial: "Porcilis APP",
    laboratorio: "MSD", principioActivo: "A. pleuropneumoniae serotipo 1, 2, 5, 6 inactivado",
    enfermedadObjetivo: "Pleuroneumonía porcina (APP)",
    viaAplicacion: "IM", dosisMl: 2, momentoAplicacion: "Semana 5–6 de vida (2 dosis con 3 sem. de intervalo)",
    paisProcedencia: "NLD", tempConservacion: "2–8 °C", diasAlertaVto: 30, obligatoria: false,
  },
];

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
  const session = await getServerSession(authOptions);
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

  for (const r of DEFAULT_RAZAS) {
    await prisma.configRaza.upsert({
      where: { tenantId_nombre: { tenantId, nombre: r.nombre } },
      create: { tenantId, activa: true, ...r },
      update: {},
    });
    results.razas++;
  }

  for (const v of DEFAULT_VACUNAS) {
    const existe = await prisma.configVacuna.findFirst({
      where: { tenantId, modulo: v.modulo, nombreVacuna: v.nombreVacuna, activa: true },
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
