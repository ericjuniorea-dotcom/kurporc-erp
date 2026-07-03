import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const FUNCIONARIOS_INICIALES = [
  {
    name:        "Dr. Alex Joaquín Almada Casco",
    cargo:       "Jefe de Producción",
    category:    "profesional",
    position:    "Jefe de Producción",
    sector:      "all",
    iniciales:   "AA",
    colorBg:     "#1D9E75",
    colorBorder: "#16735A",
    colorText:   "#FFFFFF",
  },
  {
    name:        "Ing. Eric Acosta",
    cargo:       "Administrador",
    category:    "administrativo",
    position:    "Administrador",
    sector:      "admin",
    iniciales:   "EA",
    colorBg:     "#378ADD",
    colorBorder: "#2563B0",
    colorText:   "#FFFFFF",
  },
  {
    name:        "Bartolomé Vera",
    cargo:       "Responsable de Gestación",
    category:    "operativo",
    position:    "Responsable de Gestación",
    sector:      "gestacion",
    iniciales:   "BV",
    colorBg:     "#E07C2E",
    colorBorder: "#B05E1A",
    colorText:   "#FFFFFF",
  },
  {
    name:        "Graciela Duarte",
    cargo:       "Responsable de Maternidad",
    category:    "operativo",
    position:    "Responsable de Maternidad",
    sector:      "maternidad",
    iniciales:   "GD",
    colorBg:     "#D4537E",
    colorBorder: "#A83060",
    colorText:   "#FFFFFF",
  },
  {
    name:        "Dr. Erwin Segovia",
    cargo:       "Veterinario",
    category:    "profesional",
    position:    "Veterinario",
    sector:      "veterinario",
    iniciales:   "ES",
    colorBg:     "#A31621",
    colorBorder: "#7A0F18",
    colorText:   "#FFFFFF",
  },
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = session.user.tenantId;

  const employees = await prisma.employee.findMany({
    where:   { tenantId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, cargo: true, category: true, position: true,
      sector: true, iniciales: true, colorBg: true, colorBorder: true, colorText: true,
      cedula: true, entryDate: true, isActive: true,
    },
  });

  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const allowedRoles = [1, 2, 5];
  if (!session.user.roles.some((r: number) => allowedRoles.includes(r))) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  const body = await req.json();

  if (body.action === "seed") {
    const existing = await prisma.employee.findMany({ where: { tenantId }, select: { name: true } });
    const existingNames = new Set(existing.map((e) => e.name));

    const toCreate = FUNCIONARIOS_INICIALES.filter((f) => !existingNames.has(f.name));
    if (toCreate.length === 0) return NextResponse.json({ message: "Ya inicializados", count: 0 });

    const created = await prisma.employee.createMany({
      data: toCreate.map((f) => ({
        ...f,
        tenantId,
        entryDate:    new Date(),
        baseSalaryGs: 0,
      })),
    });

    return NextResponse.json({ message: "Funcionarios creados", count: created.count });
  }

  // Create individual employee
  const { name, cargo, category, position, sector, iniciales, colorBg, colorBorder, colorText, cedula } = body;
  if (!name) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const employee = await prisma.employee.create({
    data: {
      tenantId, name, cargo, category, position, sector,
      iniciales, colorBg, colorBorder, colorText, cedula,
      entryDate: new Date(), baseSalaryGs: 0,
    },
  });

  return NextResponse.json(employee, { status: 201 });
}
