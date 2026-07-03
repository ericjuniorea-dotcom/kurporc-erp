import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { rawMaterialLotSchema } from "@/lib/validations/balanceado";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const allowed = [1, 2, 4, 5, 6, 7];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = rawMaterialLotSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const {
    rawMaterialId, lotCode, receivedDate, quantityKg, pricePerKg,
    supplierId, invoiceNumber, expiryDate,
    crudProteinPct, metabolizableEnergyKcal, lysinePct, methioninePct,
    calciumPct, phosphorusPct, moisturePct, mycotoxinPpb,
  } = parsed.data;

  const tenantId = session.user.tenantId;

  // Verificar que la materia prima pertenece al tenant
  const material = await prisma.rawMaterial.findFirst({
    where: { id: rawMaterialId, tenantId },
  });
  if (!material) return NextResponse.json({ error: "Materia prima no encontrada" }, { status: 404 });

  // Verificar que no existe el mismo código de lote para esta materia prima
  const exists = await prisma.rawMaterialLot.findUnique({
    where: { rawMaterialId_lotCode: { rawMaterialId, lotCode } } as any,
  });
  if (exists) {
    return NextResponse.json({ error: "Ya existe un lote con ese código para esta materia prima" }, { status: 409 });
  }

  const lot = await prisma.rawMaterialLot.create({
    data: {
      tenantId,
      rawMaterialId,
      lotCode,
      receivedDate:            new Date(receivedDate),
      quantityKg,
      remainingKg:             quantityKg, // inicia con todo disponible
      pricePerKg,
      supplierId:              supplierId              ?? undefined,
      invoiceNumber:           invoiceNumber           ?? undefined,
      expiryDate:              expiryDate ? new Date(expiryDate) : undefined,
      crudProteinPct:          crudProteinPct          ?? undefined,
      metabolizableEnergyKcal: metabolizableEnergyKcal ?? undefined,
      lysinePct:               lysinePct               ?? undefined,
      methioninePct:           methioninePct           ?? undefined,
      calciumPct:              calciumPct              ?? undefined,
      phosphorusPct:           phosphorusPct           ?? undefined,
      moisturePct:             moisturePct             ?? undefined,
      mycotoxinPpb:            mycotoxinPpb            ?? undefined,
    },
  });

  // Alertar si las micotoxinas superan el umbral (300 ppb es el típico de la industria porcina)
  if (mycotoxinPpb && mycotoxinPpb > 300) {
    await prisma.alert.create({
      data: {
        tenantId,
        alertType: "MYCOTOXIN_LIMIT_EXCEEDED",
        severity:  "CRITICAL",
        title:     `Micotoxinas elevadas en lote ${lotCode}`,
        body:      `${material.name}: ${mycotoxinPpb} ppb (límite recomendado: 300 ppb). Revisar antes de usar.`,
        entityId:  lot.id,
        entityType: "RAW_MATERIAL_LOT",
      },
    });
  }

  return NextResponse.json(lot, { status: 201 });
}
