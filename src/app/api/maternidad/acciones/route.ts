// Maternidad · acciones para hoy y los próximos días (destetes, partos, recepciones).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";
import { accionesMaternidad } from "@/lib/maternidad/acciones";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["maternidad.partos.ver", "maternidad.lechones.ver", "maternidad.destetes.ver"])) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  return NextResponse.json(await accionesMaternidad(session.user.tenantId), { headers: { "Cache-Control": "no-store" } });
}
