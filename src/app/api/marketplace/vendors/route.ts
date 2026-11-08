import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendors = await prisma.marketplaceVendor.findMany({
    where: { isActive: true, isApproved: true },
    include: {
      _count: { select: { productos: { where: { isActive: true } } } },
    },
    orderBy: { empresaNombre: "asc" },
  });
  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = puede(await getPermisos(), "compras.proveedores.editar");
  if (!isAdmin) return NextResponse.json({ error: "Solo administradores pueden registrar proveedores" }, { status: 403 });

  const body = await req.json();
  const { empresaNombre } = body;
  if (!empresaNombre) return NextResponse.json({ error: "Nombre de empresa requerido" }, { status: 400 });

  const vendor = await prisma.marketplaceVendor.create({
    data: { ...body, isApproved: true },
  });
  return NextResponse.json(vendor, { status: 201 });
}
