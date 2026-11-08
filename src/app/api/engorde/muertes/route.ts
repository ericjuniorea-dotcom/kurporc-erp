import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puede(await getPermisos(), "engorde.eventos.crear")) return NextResponse.json({ error: "No tenés permiso para esta acción", permiso: "engorde.eventos.crear" }, { status: 403 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { growingBatchId, deathDate, deathTime, count, cause, employeeId, estimatedWeightKg, notes } = body;

  if (!growingBatchId || !deathDate || !cause || !count) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const lote = await prisma.growingBatch.findFirst({ where: { id: growingBatchId, tenantId } });
  if (!lote) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  const n = Number(count);
  if (n < 1) return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });

  const [muerte] = await prisma.$transaction([
    prisma.growingDeath.create({
      data: {
        tenantId,
        growingBatchId,
        deathDate: new Date(deathDate),
        deathTime: deathTime || null,
        count: n,
        cause,
        employeeId: employeeId || null,
        estimatedWeightKg: estimatedWeightKg ? Number(estimatedWeightKg) : null,
        notes: notes || null,
      },
    }),
    prisma.growingBatch.update({
      where: { id: growingBatchId },
      data: { currentCount: { decrement: n }, updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json(muerte, { status: 201 });
}
