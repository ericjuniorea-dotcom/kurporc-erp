import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { prisma } from "@/lib/db/prisma";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";

// Personas de la organización activa (para asignar tareas, etc.). Sale de `miembro`, no del tenantId viejo.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["tareas.tareas.asignar", "equipo.miembros.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });

  const soloActivos = req.nextUrl.searchParams.get("soloActivos") === "1";
  const miembros = await prisma.miembro.findMany({
    where: { organizacionId: session.user.tenantId, ...(soloActivos ? { estado: "ACTIVO" } : {}) },
    select: { estado: true, perfil: { select: { id: true, name: true, email: true } } },
  });
  const usuarios = miembros
    .map(m => ({ id: m.perfil.id, name: m.perfil.name, email: m.perfil.email, isActive: m.estado === "ACTIVO" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json(usuarios);
}
