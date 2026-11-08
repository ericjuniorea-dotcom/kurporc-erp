import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { conActor } from "@/lib/db/actor";
import { cifrar, descifrar, enmascarar, huella, ErrorCifrado } from "@/lib/seguridad/cifrado";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";
import { getPermisos, puede } from "@/lib/permisos/servidor";

export const dynamic = "force-dynamic";

const FUNCIONARIOS_INICIALES = [
  {
    name:        "Jefatura de Producción",
    cargo:       "Jefe de Producción",
    category:    "profesional",
    position:    "Jefe de Producción",
    sector:      "all",
    iniciales:   "JP",
    colorBg:     "#1D9E75",
    colorBorder: "#16735A",
    colorText:   "#FFFFFF",
  },
  {
    name:        "Administración",
    cargo:       "Administrador",
    category:    "administrativo",
    position:    "Administrador",
    sector:      "admin",
    iniciales:   "AD",
    colorBg:     "#378ADD",
    colorBorder: "#2563B0",
    colorText:   "#FFFFFF",
  },
  {
    name:        "Encargado de Gestación",
    cargo:       "Responsable de Gestación",
    category:    "operativo",
    position:    "Responsable de Gestación",
    sector:      "gestacion",
    iniciales:   "GE",
    colorBg:     "#E07C2E",
    colorBorder: "#B05E1A",
    colorText:   "#FFFFFF",
  },
  {
    name:        "Encargado de Maternidad",
    cargo:       "Responsable de Maternidad",
    category:    "operativo",
    position:    "Responsable de Maternidad",
    sector:      "maternidad",
    iniciales:   "MA",
    colorBg:     "#D4537E",
    colorBorder: "#A83060",
    colorText:   "#FFFFFF",
  },
  {
    name:        "Veterinario",
    cargo:       "Veterinario",
    category:    "profesional",
    position:    "Veterinario",
    sector:      "veterinario",
    iniciales:   "VE",
    colorBg:     "#A31621",
    colorBorder: "#7A0F18",
    colorText:   "#FFFFFF",
  },
];

// Ven la cédula completa quienes tienen rrhh.datos_personales.ver (Fase 7).

const funcionarioSchema = z.object({
  name:        z.string().trim().min(1, "Nombre requerido").max(120),
  cargo:       z.string().trim().max(80).optional().nullable(),
  category:    z.string().trim().max(40).optional().nullable(),
  position:    z.string().trim().max(80).optional().nullable(),
  sector:      z.string().trim().max(40).optional().nullable(),
  iniciales:   z.string().trim().max(4).optional().nullable(),
  colorBg:     z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  colorBorder: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  colorText:   z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  cedula:      z.string().trim().regex(/^[0-9.\-\s]{5,15}$/, "Cédula inválida").optional().nullable(),
}).strict();

function cedulaVisible(valor: string | null, completa: boolean): string | null {
  if (!valor) return null;
  try {
    const clara = descifrar(valor);
    return completa ? clara : enmascarar(clara);
  } catch {
    return completa ? "(no se pudo descifrar)" : "•••";
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const tenantId = session.user.tenantId;
  const completa = puede(await getPermisos(), "rrhh.datos_personales.ver");

  const employees = await prisma.employee.findMany({
    where:   { tenantId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, cargo: true, category: true, position: true,
      sector: true, iniciales: true, colorBg: true, colorBorder: true, colorText: true,
      cedula: true, entryDate: true, isActive: true,
    },
  });

  if (completa && employees.some(e => e.cedula)) {
    await registrarAuditoria("DATO_PERSONAL_VISTO", "employees", null,
      { campo: "cedula", cantidad: employees.filter(e => e.cedula).length },
      { actorId: session.user.id, organizacionId: tenantId, ip: ipDe(req.headers), userAgent: userAgentDe(req.headers) });
  }

  return NextResponse.json(employees.map(e => ({ ...e, cedula: cedulaVisible(e.cedula, completa) })));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!puede(await getPermisos(), "rrhh.funcionarios.crear")) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  const body = await req.json().catch(() => ({}));

  if (body?.action === "seed") {
    const existing = await prisma.employee.findMany({ where: { tenantId }, select: { name: true } });
    const existingNames = new Set(existing.map((e) => e.name));

    const toCreate = FUNCIONARIOS_INICIALES.filter((f) => !existingNames.has(f.name));
    if (toCreate.length === 0) return NextResponse.json({ message: "Ya inicializados", count: 0 });

    const created = await conActor(session.user.id, tx => tx.employee.createMany({
      data: toCreate.map((f) => ({
        ...f,
        tenantId,
        entryDate:    new Date(),
        baseSalaryGs: 0,
      })),
    }));

    return NextResponse.json({ message: "Funcionarios creados", count: created.count });
  }

  // Create individual employee
  const parsed = funcionarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }
  const { cedula, ...datos } = parsed.data;

  let cedulaCifrada: string | null = null;
  let cedulaHash: string | null = null;
  if (cedula) {
    try {
      cedulaCifrada = cifrar(cedula);
      cedulaHash = huella(cedula);
    } catch (e) {
      if (e instanceof ErrorCifrado) {
        console.error("[rrhh]", e.message);
        return NextResponse.json({ error: "El servidor no tiene configurado el cifrado de datos personales" }, { status: 500 });
      }
      throw e;
    }
  }

  const employee = await conActor(session.user.id, tx => tx.employee.create({
    data: {
      ...datos, tenantId, cedula: cedulaCifrada, cedulaHash,
      entryDate: new Date(), baseSalaryGs: 0,
    },
    select: { id: true, name: true, cargo: true, category: true, position: true, sector: true, iniciales: true, entryDate: true, isActive: true },
  }));

  return NextResponse.json({ ...employee, cedula: cedula ? enmascarar(cedula) : null }, { status: 201 });
}
