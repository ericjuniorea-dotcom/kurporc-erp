// Finanzas · Fugas (costeo por etapa, Fase 7): dónde se pierde plata en el período. Solo lectura.
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puedeAlguno } from "@/lib/permisos/servidor";
import { fugas } from "@/lib/finanzas/costeo/fugas";

export const dynamic = "force-dynamic";
const valido = (m: number) => Number.isInteger(m) && m >= 200001 && m <= 210012 && m % 100 >= 1 && m % 100 <= 12;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!puedeAlguno(await getPermisos(), ["finanzas.costos.ver"])) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const hoy = new Date(); const actual = hoy.getUTCFullYear() * 100 + hoy.getUTCMonth() + 1;
  const desde = Number(req.nextUrl.searchParams.get("desde") ?? actual), hasta = Number(req.nextUrl.searchParams.get("hasta") ?? actual);
  if (!valido(desde) || !valido(hasta) || desde > hasta) return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  return NextResponse.json(await fugas(session.user.tenantId, desde, hasta), { headers: { "Cache-Control": "no-store" } });
}
