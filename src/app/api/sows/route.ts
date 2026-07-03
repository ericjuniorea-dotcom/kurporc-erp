import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("q") ?? "";
  const isActive = searchParams.get("active") !== "false";

  const sows = await prisma.sow.findMany({
    where: {
      tenantId: session.user.tenantId,
      isActive,
      ...(search
        ? { identCode: { contains: search, mode: "insensitive" } }
        : {}),
    },
    orderBy: { identCode: "asc" },
    select: {
      id:                true,
      identCode:         true,
      breed:             true,
      currentParityCount: true,
      isActive:          true,
      serviceEvents: {
        orderBy: { serviceDate: "desc" },
        take: 1,
        select: {
          id:          true,
          serviceDate: true,
          serviceType: true,
          farrowing: {
            select: { id: true, startDatetime: true },
          },
        },
      },
    },
    take: 100,
  });

  return NextResponse.json(sows);
}

const createSowSchema = z.object({
  identCode: z.string().min(1),
  breed:     z.string().optional(),
  birthDate: z.string().optional(),
  entryDate: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Solo Admin, Gerente, Jefes de producción/gestación
  const allowed = [1, 2, 3, 4, 5, 11];
  if (!session.user.roles.some((r) => allowed.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { identCode, breed, birthDate, entryDate } = parsed.data;

  const existing = await prisma.sow.findUnique({
    where: { tenantId_identCode: { tenantId: session.user.tenantId, identCode } },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una cerda con ese código" }, { status: 409 });
  }

  const sow = await prisma.sow.create({
    data: {
      tenantId:  session.user.tenantId,
      identCode,
      breed,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      entryDate: entryDate ? new Date(entryDate) : new Date(),
    },
  });

  return NextResponse.json(sow, { status: 201 });
}
