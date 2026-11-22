// Diagnóstico: cuando una acción de pantalla recibe una respuesta inesperada del servidor, el navegador deja acá
// qué le llegó (código, tipo, comienzo del texto). Queda en auditoría para encontrar la causa. Sin datos de la granja.
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/config";
import { registrarAuditoria, ipDe, userAgentDe } from "@/lib/seguridad/auditoria";

export async function POST(req: NextRequest) {
  const session = await getSession().catch(() => null);
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  const corto = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : typeof v === "number" || typeof v === "boolean" ? v : null);
  await registrarAuditoria("ERROR_PANTALLA", "accion_servidor", null, {
    ruta: corto(b.ruta, 200), estado: corto(b.estado, 10), tipo: corto(b.tipo, 100), redirigida: corto(b.redirigida, 5),
    urlFinal: corto(b.urlFinal, 200), cabeceras: corto(b.cabeceras, 600), cuerpo: corto(b.cuerpo, 600), accion: corto(b.accion, 60),
  }, { actorId: session?.user.id, organizacionId: session?.user.tenantId, ip: ipDe(req.headers), userAgent: userAgentDe(req.headers) });
  return NextResponse.json({ ok: true });
}
