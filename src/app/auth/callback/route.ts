// Vuelta de Google (OAuth) y de los enlaces de correo (confirmación, recuperación).
// Canjea el código por la sesión y redirige solo a rutas internas (sin redirección abierta).
import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/db/prisma";
import { createClient } from "@/lib/supabase/server";
import { ipDe, registrarAuditoria, userAgentDe } from "@/lib/seguridad/auditoria";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const raw = searchParams.get("next") ?? "/dashboard";
  const next = raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const u = await prisma.user.findUnique({
        where: { authUserId: data.user.id },
        select: { id: true, tenantId: true, isActive: true },
      });
      if (u && !u.isActive) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=inactiva`);
      }
      const proveedor = data.user.app_metadata?.provider ?? "email";
      if (u) {
        await registrarAuditoria("LOGIN", "users", u.id, { metodo: proveedor },
          { actorId: u.id, organizacionId: u.tenantId, ip: ipDe(request.headers), userAgent: userAgentDe(request.headers) });
        await prisma.user.update({
          where: { id: u.id },
          data: {
            ultimoAcceso: new Date(),
            ...(proveedor === "google" ? { proveedorLogin: "google" } : {}),
            ...(data.user.user_metadata?.avatar_url ? { avatarUrl: String(data.user.user_metadata.avatar_url).slice(0, 500) } : {}),
          },
        });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
