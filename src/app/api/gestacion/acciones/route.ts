// Gestación · manejo pendiente (traslados, control de celo, diagnósticos, servicios) para Órdenes de trabajo.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";
import { accionesGestacion } from "@/lib/gestacion/acciones";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["gestacion.servicios.ver", "gestacion.diagnosticos.ver", "plantel.animales.ver"])) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  return NextResponse.json(await accionesGestacion(session.user.tenantId), { headers: { "Cache-Control": "no-store" } });
}
