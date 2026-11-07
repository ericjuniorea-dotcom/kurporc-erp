export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const protocolos = await prisma.protocoloSanitario.findMany({
    where: { tenantId, isActive: true },
    include: {
      items: {
        include: { vacuna: { select: { id: true, nombre: true, enfermedad: true, viaAplicacion: true, dosisMl: true } } },
        orderBy: { diaCiclo: "asc" },
      },
    },
    orderBy: { fase: "asc" },
  });

  return NextResponse.json(protocolos.map(p => ({
    ...p,
    items: p.items.map(i => ({ ...i, vacuna: { ...i.vacuna, dosisMl: Number(i.vacuna.dosisMl) } })),
  })));
}
