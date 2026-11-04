import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { rawMaterialLotSchema } from "@/lib/validations/balanceado";
import { invalidateInventario } from "@/lib/cache";

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

  // Verificar en paralelo que la materia prima pertenece al tenant y que no
  // existe ya el mismo código de lote (son consultas independientes)
  const [material, exists] = await Promise.all([
    prisma.productoInventario.findFirst({ where: { id: rawMaterialId, tenantId, categoria: "MATERIA_PRIMA" } }),
    prisma.loteInventario.findFirst({ where: { vacunaId: rawMaterialId, numeroLote: lotCode } }),
  ]);
  if (!material) return NextResponse.json({ error: "Materia prima no encontrada" }, { status: 404 });
  if (exists) {
    return NextResponse.json({ error: "Ya existe un lote con ese código para esta materia prima" }, { status: 409 });
  }

  const lot = await prisma.loteInventario.create({
    data: {
      tenantId,
      vacunaId:         rawMaterialId,
      numeroLote:       lotCode,
      fechaIngreso:     new Date(receivedDate),
      cantidadInicial:  quantityKg,
      cantidadActual:   quantityKg, // inicia con todo disponible
      // sin vencimiento informado → placeholder lejano, no bloquea la lógica de "no vencido"
      fechaVencimiento: expiryDate ? new Date(expiryDate) : new Date(new Date(receivedDate).getFullYear() + 3, 0, 1),
      costoUnitario:    pricePerKg, // espejo del precio/kg — permite comparar costos entre categorías desde Logística
      proveedor:        undefined,
      nutricion: {
        create: {
          supplierId:              supplierId              ?? undefined,
          pricePerKg,
          invoiceNumber:           invoiceNumber           ?? undefined,
          crudProteinPct:          crudProteinPct          ?? undefined,
          metabolizableEnergyKcal: metabolizableEnergyKcal ?? undefined,
          lysinePct:               lysinePct               ?? undefined,
          methioninePct:           methioninePct           ?? undefined,
          calciumPct:              calciumPct              ?? undefined,
          phosphorusPct:           phosphorusPct           ?? undefined,
          moisturePct:             moisturePct             ?? undefined,
          mycotoxinPpb:            mycotoxinPpb            ?? undefined,
        },
      },
    },
    include: { nutricion: true },
  });
  await prisma.movimientoInventario.create({
    data: { tenantId, productoId: rawMaterialId, loteId: lot.id, tipo: "ENTRADA", cantidad: quantityKg, origen: "COMPRA", referenciaId: lot.id },
  });
  invalidateInventario(tenantId);

  // Alertar si las micotoxinas superan el umbral (300 ppb es el típico de la industria porcina)
  if (mycotoxinPpb && mycotoxinPpb > 300) {
    await prisma.alert.create({
      data: {
        tenantId,
        alertType: "MYCOTOXIN_LIMIT_EXCEEDED",
        severity:  "CRITICAL",
        title:     `Micotoxinas elevadas en lote ${lotCode}`,
        body:      `${material.nombre}: ${mycotoxinPpb} ppb (límite recomendado: 300 ppb). Revisar antes de usar.`,
        entityId:  lot.id,
        entityType: "RAW_MATERIAL_LOT",
      },
    });
  }

  return NextResponse.json({
    id: lot.id, lotCode: lot.numeroLote, receivedDate: lot.fechaIngreso,
    quantityKg: Number(lot.cantidadInicial), remainingKg: Number(lot.cantidadActual),
    pricePerKg: lot.nutricion?.pricePerKg ?? null,
  }, { status: 201 });
}
