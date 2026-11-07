import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const soloActivos = req.nextUrl.searchParams.get("soloActivos") === "1";

  const usuarios = await prisma.user.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(soloActivos ? { isActive: true } : {}),
    },
    select: { id: true, name: true, email: true, isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(usuarios);
}
