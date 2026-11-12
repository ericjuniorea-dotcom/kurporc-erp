// Iniciación → Visión general: lotes abiertos con días de alojamiento, animales y último peso.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";
import { resumenLotesRecria } from "@/lib/recria/lote";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["destete.lotes.ver", "maternidad.destetes.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  return NextResponse.json(await resumenLotesRecria(session.user.tenantId));
}
