import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { formulaVersionSchema } from "@/lib/validations/balanceado";
import { calculateNutritionalProfile, checkNutritionalTargets } from "@/lib/balanceado/nutritional-calc";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const formulas = await prisma.formula.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    include: {
      feedType: { select: { name: true, phase: true } },
      versions: {
        where:   { status: "ACTIVE" },
        take:    1,
        include: {
          ingredients: {
            include: { rawMaterial: { select: { name: true, materialType: true } } },
          },
        },
      },
    },
    orderBy: { feedType: { sortOrder: "asc" } },
  });

  return NextResponse.json(formulas);
}

// Crear nueva versión de fórmula (INACTIVA hasta que el Vet Jefe la apruebe — Regla 1)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Encargado BAL y superiores pueden crear borradores; solo Vet Jefe puede aprobar
  const allowed = [1, 2, 4, 6];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso para crear versiones de fórmula" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = formulaVersionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { formulaId, ingredients, aiSuggestionNotes } = parsed.data;
  const tenantId = session.user.tenantId;

  const formula = await prisma.formula.findFirst({
    where:   { id: formulaId, tenantId },
    include: { versions: { select: { versionNumber: true }, orderBy: { versionNumber: "desc" }, take: 1 } },
  });
  if (!formula) return NextResponse.json({ error: "Fórmula no encontrada" }, { status: 404 });

  const nextVersion = (formula.versions[0]?.versionNumber ?? 0) + 1;

  // Calcular perfil nutricional automáticamente
  const profile  = await calculateNutritionalProfile(ingredients);
  const targets  = await checkNutritionalTargets(tenantId, formula.feedTypeId, profile);

  const version = await prisma.$transaction(async (tx) => {
    const v = await tx.formulaVersion.create({
      data: {
        tenantId,
        formulaId,
        versionNumber:         nextVersion,
        status:                "INACTIVE", // Pendiente de aprobación del Vet Jefe
        totalProteinPct:       profile.totalProteinPct,
        totalEnergyKcal:       profile.totalEnergyKcal,
        totalLysinePct:        profile.totalLysinePct,
        totalMethioninePct:    profile.totalMethioninePct,
        totalCalciumPct:       profile.totalCalciumPct,
        totalPhosphorusPct:    profile.totalPhosphorusPct,
        totalMoisturePct:      profile.totalMoisturePct,
        totalMycotoxinPpb:     profile.totalMycotoxinPpb,
        aiSuggestionNotes:     aiSuggestionNotes ?? undefined,
        ingredients: {
          create: ingredients.map((i) => ({
            rawMaterialId: i.rawMaterialId,
            inclusionPct:  i.inclusionPct,
          })),
        },
      },
      include: {
        ingredients: {
          include: { rawMaterial: { select: { name: true } } },
        },
      },
    });
    return v;
  });

  return NextResponse.json({ version, profile, nutritionalWarnings: targets.warnings }, { status: 201 });
}
