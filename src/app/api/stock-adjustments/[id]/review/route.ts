import { NextRequest, NextResponse } from "next/server";
import { getSession, canApproveStockAdjustments } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { z } from "zod";
import { getPermisos, puede } from "@/lib/permisos/servidor";

const reviewSchema = z.object({
  decision:    z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().optional(),
});

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), "stock.ajustes.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "stock.ajustes.crear" }, { status: 403 });

  // REGLA 2: Solo Jefe de producción, Admin o Super Admin puede aprobar
  if (!canApproveStockAdjustments(session.user.roles)) {
    return NextResponse.json(
      { error: "Solo el Jefe de Producción puede aprobar ajustes de stock" },
      { status: 403 }
    );
  }

  const body   = await req.json();
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const adj = await prisma.stockAdjustmentRequest.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId, status: "PENDING" },
  });
  if (!adj) {
    return NextResponse.json({ error: "Ajuste no encontrado o ya procesado" }, { status: 404 });
  }

  const updated = await prisma.stockAdjustmentRequest.update({
    where: { id: params.id },
    data:  {
      status:       parsed.data.decision,
      reviewedById: session.user.id,
      reviewedAt:   new Date(),
      reviewNotes:  parsed.data.reviewNotes ?? undefined,
    },
  });

  // Resolver la alerta asociada
  await prisma.alert.updateMany({
    where: { tenantId: session.user.tenantId, entityId: params.id, entityType: "STOCK_ADJUSTMENT" },
    data:  { isResolved: true, resolvedAt: new Date() },
  });

  return NextResponse.json(updated);
}
