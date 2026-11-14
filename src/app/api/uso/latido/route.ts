// Fase 15.3 · Recibe el latido de uso y lo suma por persona, día y módulo (registrar_latido en la base).
// En modo plataforma no se cuenta uso. El middleware ya rechaza el POST sin sesión o en modo plataforma.
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { getSession, getUsuario } from "@/lib/auth/config";
import { moduloDeRuta } from "@/lib/modulos";

export const dynamic = "force-dynamic";

const cuerpo = z.object({ ruta: z.string().max(300) });

export async function POST(req: NextRequest) {
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const session = await getSession().catch(() => null);
  if (session?.modoPlataforma) return new NextResponse(null, { status: 204 });
  const p = cuerpo.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  try {
    await prisma.$executeRaw`select public.registrar_latido(${usuario.id}, ${session?.user.tenantId ?? null}, ${moduloDeRuta(p.data.ruta)})`;
  } catch (e) { console.error("[latido]", e); }
  return new NextResponse(null, { status: 204 });
}
