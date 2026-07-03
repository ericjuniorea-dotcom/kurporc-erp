import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";

// Historial de versiones de una fórmula
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const tenantId = session.user.tenantId;

  const formula = await prisma.formula.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!formula) return NextResponse.json({ error: "Fórmula no encontrada" }, { status: 404 });

  const versions = await prisma.formulaVersion.findMany({
    where:   { formulaId: params.id, tenantId },
    include: {
      ingredients: {
        include: {
          rawMaterial: { select: { name: true, materialType: true } },
        },
      },
      approvedBy: { select: { name: true } },
    },
    orderBy: { versionNumber: "desc" },
  });

  return NextResponse.json(versions);
}
