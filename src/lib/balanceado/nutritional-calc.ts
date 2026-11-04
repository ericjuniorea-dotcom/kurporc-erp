import prisma from "@/lib/db/prisma";

export interface NutritionalProfile {
  totalProteinPct:    number;
  totalEnergyKcal:    number;
  totalLysinePct:     number;
  totalMethioninePct: number;
  totalCalciumPct:    number;
  totalPhosphorusPct: number;
  totalMoisturePct:   number;
  totalMycotoxinPpb:  number;
}

interface Ingredient {
  inclusionPct:  number;
  rawMaterialId: string;
}

// Calcula el perfil nutricional de una versión de fórmula
// usando los valores del lote más reciente de cada materia prima.
export async function calculateNutritionalProfile(
  ingredients: Ingredient[]
): Promise<NutritionalProfile> {
  const profile: NutritionalProfile = {
    totalProteinPct:    0,
    totalEnergyKcal:    0,
    totalLysinePct:     0,
    totalMethioninePct: 0,
    totalCalciumPct:    0,
    totalPhosphorusPct: 0,
    totalMoisturePct:   0,
    totalMycotoxinPpb:  0,
  };

  for (const ing of ingredients) {
    const pct = Number(ing.inclusionPct) / 100;
    if (pct === 0) continue;

    // Usar el lote más reciente con valores nutricionales
    const lot = await prisma.loteInventario.findFirst({
      where:   { vacunaId: ing.rawMaterialId, cantidadActual: { gt: 0 } },
      orderBy: { fechaIngreso: "desc" },
      include: { nutricion: true },
    });

    if (!lot?.nutricion) continue;

    profile.totalProteinPct    += pct * Number(lot.nutricion.crudProteinPct          ?? 0);
    profile.totalEnergyKcal    += pct * Number(lot.nutricion.metabolizableEnergyKcal ?? 0);
    profile.totalLysinePct     += pct * Number(lot.nutricion.lysinePct               ?? 0);
    profile.totalMethioninePct += pct * Number(lot.nutricion.methioninePct           ?? 0);
    profile.totalCalciumPct    += pct * Number(lot.nutricion.calciumPct              ?? 0);
    profile.totalPhosphorusPct += pct * Number(lot.nutricion.phosphorusPct           ?? 0);
    profile.totalMoisturePct   += pct * Number(lot.nutricion.moisturePct             ?? 0);
    profile.totalMycotoxinPpb  += pct * Number(lot.nutricion.mycotoxinPpb            ?? 0);
  }

  // Redondear a 3 decimales
  return Object.fromEntries(
    Object.entries(profile).map(([k, v]) => [k, Math.round(Number(v) * 1000) / 1000])
  ) as unknown as NutritionalProfile;
}

// Compara el perfil calculado con las metas nutricionales del tenant
export async function checkNutritionalTargets(
  tenantId:   string,
  feedTypeId: string,
  profile:    NutritionalProfile
): Promise<{ meetsTargets: boolean; warnings: string[] }> {
  const target = await prisma.nutritionalTarget.findUnique({
    where: { tenantId_feedTypeId: { tenantId, feedTypeId } },
  });

  if (!target) return { meetsTargets: true, warnings: [] };

  const warnings: string[] = [];

  if (target.minProteinPct && profile.totalProteinPct < Number(target.minProteinPct)) {
    warnings.push(
      `Proteína: ${profile.totalProteinPct.toFixed(2)}% (mínimo ${target.minProteinPct}%)`
    );
  }
  if (target.minEnergyKcal && profile.totalEnergyKcal < Number(target.minEnergyKcal)) {
    warnings.push(
      `Energía: ${profile.totalEnergyKcal.toFixed(0)} kcal/kg (mínimo ${target.minEnergyKcal})`
    );
  }
  if (target.minLysinePct && profile.totalLysinePct < Number(target.minLysinePct)) {
    warnings.push(
      `Lisina: ${profile.totalLysinePct.toFixed(3)}% (mínimo ${target.minLysinePct}%)`
    );
  }
  if (target.maxMycotoxinPpb && profile.totalMycotoxinPpb > Number(target.maxMycotoxinPpb)) {
    warnings.push(
      `⚠ MICOTOXINAS: ${profile.totalMycotoxinPpb.toFixed(1)} ppb (máximo ${target.maxMycotoxinPpb} ppb)`
    );
  }

  return { meetsTargets: warnings.length === 0, warnings };
}
