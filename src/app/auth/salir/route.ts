// Cerrar sesión. ?alcance=global la cierra en todos los dispositivos (Fase 2.10 / 3).
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuario } from "@/lib/auth/config";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const global = request.nextUrl.searchParams.get("alcance") === "global";
  const usuario = await getUsuario();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: global ? "global" : "local" });
  if (usuario) {
    await registrarAuditoria("LOGOUT", "users", usuario.id, { global },
      { actorId: usuario.id, ip: ipDe(request.headers), userAgent: userAgentDe(request.headers) });
  }
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete("kp_org");
  return res;
}
