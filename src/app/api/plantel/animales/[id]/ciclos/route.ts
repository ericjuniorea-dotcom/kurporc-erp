// Línea de tiempo de los ciclos de una cerda (ficha → Ciclos).
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";
import { ciclosDeCerda } from "@/lib/plantel/ciclos-datos";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["plantel.animales.ver", "gestacion.servicios.ver", "maternidad.partos.ver"])) return NextResponse.json({ error: "No tenés permiso para ver esto" }, { status: 403 });
  const r = await ciclosDeCerda(session.user.tenantId, id);
  return r ? NextResponse.json(r) : NextResponse.json({ error: "No encontrado" }, { status: 404 });
}
