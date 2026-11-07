import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { getUsuario } from "@/lib/auth/config";
import { PanelSeguridad } from "./panel-seguridad";

export const metadata = { title: "Seguridad de la cuenta · KurPorc" };

export default async function SeguridadPage() {
  const usuario = await getUsuario();
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <IconArrowLeft size={14} aria-hidden /> Volver
        </Link>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Seguridad de la cuenta</h1>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{usuario?.email}</div>
        </div>
        <PanelSeguridad esGestionada={!!usuario?.email.endsWith("@usuarios.kurporc.com")} />
      </div>
    </div>
  );
}
