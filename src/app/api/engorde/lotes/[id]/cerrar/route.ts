import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const body = await req.json();
  const { closedReason } = body;

  const lote = await prisma.growingBatch.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!lote) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });

  const updated = await prisma.growingBatch.update({
    where: { id: params.id },
    data: { status: "CLOSED", isActive: false, closedAt: new Date(), closedReason: closedReason || null },
  });

  return NextResponse.json(updated);
}
