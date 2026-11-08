import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { phaseChangeSchema } from "@/lib/validations/recria";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puede(await getPermisos(), "destete.lotes.editar")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body   = await req.json();
  const parsed = phaseChangeSchema.safeParse({ ...body, nurseryBatchId: params.id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { toPhase, changeDate, reason, triggerWeightKg, notes } = parsed.data;
  const tenantId = session.user.tenantId;

  const batch = await prisma.nurseryBatch.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!batch) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  if (batch.phase === toPhase) {
    return NextResponse.json(
      { error: `El lote ya está en ${toPhase}` },
      { status: 409 }
    );
  }

  const change = await prisma.$transaction(async (tx) => {
    const c = await tx.phaseChange.create({
      data: {
        tenantId,
        nurseryBatchId:  params.id,
        fromPhase:       batch.phase,
        toPhase,
        changeDate:      new Date(changeDate),
        reason,
        triggerWeightKg: triggerWeightKg ?? undefined,
        notes:           notes           ?? undefined,
        employeeId:      session.user.id,
      },
    });

    await tx.nurseryBatch.update({
      where: { id: params.id },
      data:  { phase: toPhase },
    });

    return c;
  });

  return NextResponse.json(change, { status: 201 });
}
