// Fase 15.2 · Hoja de ruta para clientes: lo que el equipo publicó, con texto reescrito. Se puede votar.
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { getSession, getUsuario } from "@/lib/auth/config";
import { hojaDeRuta } from "@/app/acciones/sugerencias";
import { HojaDeRuta } from "@/components/buzon/hoja-de-ruta";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hoja de ruta · KurPorc" };

export default async function HojaDeRutaCliente() {
  const u = await getUsuario();
  if (!u) redirect("/login?next=/cuenta/hoja-de-ruta");
  const session = await getSession().catch(() => null);
  const items = await hojaDeRuta();
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <IconArrowLeft size={14} aria-hidden /> Volver
        </Link>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Hoja de ruta</h1>
          <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5, margin: "4px 0 0" }}>
            Las funciones que nos pidieron y en qué estado están. Si alguna te sirve, marcá «Yo también la quiero»: contamos una vez por granja.
            Para pedir algo nuevo usá «Ayuda y sugerencias» → «Quiero una función nueva».
          </p>
        </div>
        {items.length === 0
          ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Todavía no publicamos ninguna función. Pronto vas a ver acá lo que estamos preparando.</div>
          : <HojaDeRuta items={items} votar={!session?.modoPlataforma} />}
      </div>
    </div>
  );
}
