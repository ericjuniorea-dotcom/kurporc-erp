export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const medicamentos = await prisma.medicine.findMany({
    where:   { tenantId, isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(medicamentos.map(m => ({
    id: m.id, name: m.name, activeIngredient: m.activeIngredient,
    defaultDoseMl: m.defaultDoseMl ? Number(m.defaultDoseMl) : null,
    withdrawalDays: m.withdrawalDays,
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId } = session.user;

  const body = await req.json();
  const { name, activeIngredient, defaultDoseMl, withdrawalDays } = body;
  if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });

  const medicamento = await prisma.medicine.create({
    data: {
      tenantId, name, activeIngredient,
      defaultDoseMl: defaultDoseMl ?? undefined,
      withdrawalDays: withdrawalDays ?? 0,
    },
  });

  return NextResponse.json(medicamento, { status: 201 });
}
