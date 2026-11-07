// "Descargar mis datos" (portabilidad, Fase 4.3): todo lo de la persona en un JSON.
// Los datos de las organizaciones se exportan aparte, con permiso (Fase 4.4 / 7).
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";
import { consumirIntento } from "@/lib/seguridad/limites";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = await getUsuario();
  if (!u) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!(await consumirIntento("exportaciones", u.id))) {
    return NextResponse.json({ error: "Llegaste al límite de descargas de hoy. Probá mañana." }, { status: 429 });
  }

  const [perfil, membresias, aceptaciones, solicitudes, actividad] = await Promise.all([
    prisma.user.findUnique({
      where: { id: u.id },
      select: {
        id: true, email: true, name: true, phone: true, departamento: true, distrito: true, avatarUrl: true,
        language: true, proveedorLogin: true, tipoRegistro: true, createdAt: true, ultimoAcceso: true, bajaSolicitadaEn: true,
      },
    }),
    prisma.miembro.findMany({
      where: { userId: u.id },
      select: {
        cargo: true, esPropietario: true, estado: true, createdAt: true,
        organizacion: { select: { farmName: true, tipo: true } }, rol: { select: { nombre: true } },
      },
    }),
    prisma.aceptacionDocumento.findMany({
      where: { userId: u.id },
      select: { codigo: true, version: true, hashSha256: true, aceptado: true, textoCasilla: true, ip: true, userAgent: true, metodo: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.solicitudPrivacidad.findMany({ where: { userId: u.id }, orderBy: { createdAt: "asc" } }),
    prisma.auditoria.findMany({
      where: { actorId: u.id }, orderBy: { createdAt: "desc" }, take: 1000,
      select: { accion: true, entidad: true, ip: true, userAgent: true, createdAt: true },
    }),
  ]);

  await registrarAuditoria("EXPORTACION", "users", u.id, { tipo: "mis_datos" },
    { actorId: u.id, ip: ipDe(req.headers), userAgent: userAgentDe(req.headers) });

  const json = JSON.stringify({
    generado: new Date().toISOString(),
    nota: "Datos personales de tu cuenta en KurPorc. Los datos productivos y financieros pertenecen a cada organización y se exportan desde ella.",
    perfil, membresias, aceptaciones, solicitudes, actividad,
  }, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kurporc-mis-datos-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
