import { after } from "next/server";
import { redirect } from "next/navigation";
import { registrarActividad } from "@/lib/admin/actividad";
import { getSession, getUsuario } from "@/lib/auth/config";
import { SesionProvider } from "@/lib/auth/sesion-cliente";
import { getPermisos } from "@/lib/permisos/servidor";
import { Sidebar } from "@/components/layout/sidebar";
import { AyudaSoporte } from "@/components/layout/ayuda-soporte";

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

  // Uso diario para el panel de plataforma: después de responder, sin demorar la pantalla
  after(() => registrarActividad(usuario.id, session.user.tenantId));

  const permisos = await getPermisos();
  const claves = permisos ? Array.from(permisos.claves) : [];
  const sesionCliente = { ...session, permisos: claves, esPropietario: !!permisos?.esPropietario };

  return (
    <SesionProvider session={sesionCliente}>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>
        <Sidebar
          farmName={session.user.farmName}
          permisos={claves}
          esSuperadmin={usuario.esSuperadmin}
          organizacionActiva={session.user.tenantId}
          membresias={session.membresias}
        />
        <main
          className="sidebar-main"
          style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}
        >
          {permisos && permisos.bloqueadosPorSegundoFactor.length > 0 && (
            <div role="status" style={{ padding: "8px 20px", fontSize: 12, background: "var(--warning-subtle)", color: "var(--warning-text)", borderBottom: "0.5px solid var(--border-default)" }}>
              {permisos.esPropietario
                ? "Tenés acceso a plata, sueldos y permisos del equipo. Protegé tu cuenta activando el segundo factor."
                : `${permisos.bloqueadosPorSegundoFactor.length} permiso(s) sensibles (finanzas, sueldos o equipo) están en pausa hasta que actives el segundo factor.`}{" "}
              <a href="/cuenta/seguridad" style={{ color: "inherit", fontWeight: 500 }}>Activarlo ahora</a>
            </div>
          )}
          {/* Cada página incluye su propio Topbar + contenido */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {children}
          </div>
        </main>
      </div>
      <AyudaSoporte />
    </SesionProvider>
  );
}
