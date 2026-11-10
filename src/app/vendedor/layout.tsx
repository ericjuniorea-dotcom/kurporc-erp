// Panel de vendedor (Fase 12): Inicio · Productos · Mi tienda. Pedidos y cotizaciones llegan con la Fase 13.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getUsuario } from "@/lib/auth/config";
import { contextoTienda } from "@/lib/mercado/vendedor";
import { KurPorcLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AyudaSoporte } from "@/components/layout/ayuda-soporte";
import { Verificado } from "@/components/mercado/marco";
import { NavVendedor, Salir } from "./nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi tienda · KurPorc" };

export default async function LayoutVendedor({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login?next=/vendedor");
  if (usuario.faltaSegundoFactor) redirect("/auth/segundo-factor");
  if (usuario.faltaAceptarContrato) redirect("/legal/aceptar");
  const t = await contextoTienda();
  if (!t) redirect("/onboarding?tipo=VENDEDOR");
  const session = await getSession();
  const tieneGranja = session?.membresias.some(m => m.tipo !== "VENDEDOR");
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <header style={{ background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border-default)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Link href="/vendedor" aria-label="Mi tienda"><KurPorcLogo size="sm" /></Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{t.org.farmName} {t.org.verificacion === "VERIFICADA" && <Verificado />}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Panel de vendedor · RUC {t.org.ruc ?? "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5 }}>
            <Link href={`/tienda/${t.org.slug}`} style={{ color: "var(--text-secondary)" }}>Ver mi tienda pública</Link>
            {tieneGranja && <Link href="/dashboard" style={{ color: "var(--text-secondary)" }}>Mi granja</Link>}
            <ThemeToggle />
            <Salir />
          </div>
        </div>
        <NavVendedor />
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
        {t.org.verificacion === "RECHAZADA" && (
          <div style={{ padding: "10px 14px", fontSize: 13, borderRadius: "var(--radius-md)", background: "var(--danger-subtle)", color: "var(--danger-text)" }}>
            Tu tienda está suspendida y sus publicaciones no se muestran. Escribinos a soporte@kurporc.com para revisarlo.
          </div>
        )}
        {t.org.verificacion === "PENDIENTE" && (
          <div style={{ padding: "10px 14px", fontSize: 13, borderRadius: "var(--radius-md)", background: "var(--warning-subtle)", color: "var(--warning-text)" }}>
            Tu tienda todavía no está verificada: podés cargar tus productos, pero quedan en borrador hasta que tu RUC figure activo en la DNIT o el equipo de KurPorc la verifique.
          </div>
        )}
        {children}
      </main>
      <AyudaSoporte />
    </div>
  );
}
