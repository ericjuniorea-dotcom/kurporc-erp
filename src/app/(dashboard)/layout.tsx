import { redirect } from "next/navigation";
import { getSession, getUsuario } from "@/lib/auth/config";
import { SesionProvider } from "@/lib/auth/sesion-cliente";
import { Sidebar } from "@/components/layout/sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login");
  if (usuario.faltaSegundoFactor) redirect("/auth/segundo-factor");
  if (usuario.faltaAceptarContrato) redirect("/legal/aceptar");
  // Cuenta gestionada con contraseña temporal: primero la cambia (Fase 3)
  if (usuario.debeCambiarClave) redirect("/cuenta/cambiar-clave");

  const session = await getSession();
  // Autenticado pero sin ninguna organización activa: primeros pasos o su cuenta (Fase 6)
  if (!session) redirect(usuario.onboardingCompleto ? "/cuenta/sin-organizacion" : "/onboarding");
  // Una tienda no usa el ERP productivo: tiene su propio panel
  const activa = session.membresias.find(m => m.organizacionId === session.user.tenantId);
  if (activa?.tipo === "VENDEDOR") redirect("/vendedor");

  return (
    <SesionProvider session={session}>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>
        <Sidebar
          farmName={session.user.farmName}
          userRoles={session.user.roles}
          organizacionActiva={session.user.tenantId}
          membresias={session.membresias}
        />
        <main
          className="sidebar-main"
          style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
        >
          {/* Cada página incluye su propio Topbar + contenido */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {children}
          </div>
        </main>
      </div>
    </SesionProvider>
  );
}
