import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/admin/acceso";
import { NavegacionAdmin } from "./navegacion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plataforma · KurPorc", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  // Un usuario común recibe 404: no se revela que el panel existe
  if (!admin) notFound();

  if (!admin.verificado) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg-base)" }}>
        <div style={{ maxWidth: 440, background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Activá el segundo factor</div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            El panel de plataforma muestra los datos de todas las organizaciones. Para entrar, tu cuenta tiene que tener el segundo factor
            activado (una app como Google Authenticator) y verificado en esta sesión. Si alguien consiguiera tu contraseña, igual no podría entrar.
          </p>
          <Link href="/cuenta/seguridad" className="btn btn-primary" style={{ height: 36, justifyContent: "center" }}>Activarlo ahora</Link>
          <Link href="/dashboard" className="btn" style={{ height: 34, justifyContent: "center" }}>Volver</Link>
        </div>
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <NavegacionAdmin nombre={admin.usuario.name} nivel={admin.nivel} />
      <main style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1320 }}>{children}</main>
    </div>
  );
}
