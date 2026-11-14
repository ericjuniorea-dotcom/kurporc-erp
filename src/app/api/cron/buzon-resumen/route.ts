// Fase 15.2 · Resumen diario del buzón (Vercel Cron, 11:00 UTC = 08:00 en Asunción).
// Solo avisa: tipo, módulo y organización, nunca el texto del cliente. Los problemas ya avisaron al momento.
// Protegido con CRON_SECRET (Vercel manda "Authorization: Bearer <CRON_SECRET>"). Sin novedades no manda nada.
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/db/prisma";
import { enviarAviso, SITIO } from "@/lib/correo/enviar";
import { CORREO_SOPORTE } from "@/lib/contacto";
import { etiquetaModulo } from "@/lib/modulos";

export const dynamic = "force-dynamic";

const TIPO: Record<string, string> = { CONSULTA: "Duda", SUGERENCIA: "Idea", FUNCION_NUEVA: "Función nueva" };

function autorizado(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const dado = Buffer.from(req.headers.get("authorization") ?? ""), esperado = Buffer.from(`Bearer ${secreto}`);
  return dado.length === esperado.length && timingSafeEqual(dado, esperado);
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const desde = new Date(Date.now() - 24 * 3_600_000);
  const nuevas = await prisma.sugerencia.findMany({
    where: { createdAt: { gte: desde }, tipo: { not: "PROBLEMA" } },
    select: { tipo: true, modulo: true, organizacionId: true },
  });
  if (nuevas.length === 0) return NextResponse.json({ enviados: 0, nuevas: 0 });
  const orgs = await prisma.tenant.findMany({ where: { id: { in: Array.from(new Set(nuevas.map(n => n.organizacionId).filter((x): x is string => !!x))) } }, select: { id: true, farmName: true } });
  const nombre = new Map(orgs.map(o => [o.id, o.farmName]));
  const lineas = nuevas.map(n => `- ${TIPO[n.tipo] ?? n.tipo} · ${etiquetaModulo(n.modulo)} · ${n.organizacionId ? nombre.get(n.organizacionId) ?? "—" : "sin organización"}`);
  const ok = await enviarAviso({
    para: CORREO_SOPORTE,
    asunto: `Buzón: ${nuevas.length} mensaje${nuevas.length === 1 ? "" : "s"} nuevo${nuevas.length === 1 ? "" : "s"} en las últimas 24 h`,
    texto: `Llegaron al buzón en las últimas 24 horas:\n\n${lineas.join("\n")}\n\nVerlos: ${SITIO}/admin/buzon?estado=NUEVA\n`,
  });
  return NextResponse.json({ enviados: ok ? 1 : 0, nuevas: nuevas.length });
}
