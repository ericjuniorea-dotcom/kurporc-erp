import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, ROLES } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { approveFormulaSchema } from "@/lib/validations/balanceado";

// REGLA 1: Solo el Jefe Veterinario (roleId=4) puede aprobar cambios de fórmula.
// Esta restricción es ABSOLUTA y no puede ser delegada.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // REGLA 1 enforcement
  if (!session.user.roles.includes(ROLES.VET_CHIEF)) {
    return NextResponse.json(
      { error: "Solo el Jefe Veterinario puede aprobar cambios de fórmula (Regla 1)" },
      { status: 403 }
    );
  }

  const body   = await req.json();
  const parsed = approveFormulaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { approvalNotes } = parsed.data;
  const versionId         = params.id;
  const tenantId          = session.user.tenantId;

  const version = await prisma.formulaVersion.findFirst({
    where:   { id: versionId, tenantId },
    include: { formula: { select: { id: true, name: true, tenantId: true } } },
  });

  if (!version) return NextResponse.json({ error: "Versión no encontrada" }, { status: 404 });
  if (version.formula.tenantId !== tenantId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  if (version.status === "ACTIVE") {
    return NextResponse.json({ error: "Esta versión ya está activa" }, { status: 409 });
  }
  if (version.status === "SUPERSEDED") {
    return NextResponse.json({ error: "Esta versión fue reemplazada" }, { status: 409 });
  }

  const [approved] = await prisma.$transaction([
    // Activar la nueva versión
    prisma.formulaVersion.update({
      where: { id: versionId },
      data:  {
        status:       "ACTIVE",
        approvedById: session.user.id,
        approvedAt:   new Date(),
        approvalNotes: approvalNotes ?? undefined,
      },
    }),
    // Archivar las versiones activas previas
    prisma.formulaVersion.updateMany({
      where: {
        formulaId: version.formulaId,
        id:        { not: versionId },
        status:    "ACTIVE",
      },
      data: { status: "SUPERSEDED" },
    }),
  ]);

  // Resolver alertas pendientes de aprobación de fórmula
  await prisma.alert.updateMany({
    where: {
      tenantId,
      alertType:  "FORMULA_PENDING_APPROVAL",
      entityId:   versionId,
      isResolved: false,
    },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
    },
  });

  return NextResponse.json(approved);
}
