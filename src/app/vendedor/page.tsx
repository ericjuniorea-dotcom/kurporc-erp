import Link from "next/link";
import { redirect } from "next/navigation";
import { MarcoAuth } from "@/components/auth/marco-auth";
import prisma from "@/lib/db/prisma";
import { getSession, getUsuario } from "@/lib/auth/config";
import { BotonSalir } from "@/app/cuenta/sin-organizacion/boton-salir";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi tienda · KurPorc" };

// Panel de vendedor (el completo llega con el Mercado, Fase 12). Por ahora: estado de la tienda.
export default async function VendedorPage() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login?next=/vendedor");
  if (usuario.faltaAceptarContrato) redirect("/legal/aceptar");
  const session = await getSession();
  const tienda = session?.membresias.find(m => m.tipo === "VENDEDOR");
  if (!tienda) redirect("/onboarding?tipo=VENDEDOR");

  const org = await prisma.tenant.findUnique({ where: { id: tienda.organizacionId }, select: { farmName: true, verificacion: true, ruc: true } });
  const tieneGranja = session?.membresias.some(m => m.tipo !== "VENDEDOR");
  const estado = org?.verificacion === "VERIFICADA" ? "verificada" : org?.verificacion === "RECHAZADA" ? "rechazada" : "en revisión";

  return (
    <MarcoAuth titulo={org?.farmName ?? "Mi tienda"} subtitulo={`RUC ${org?.ruc ?? "—"} · Tienda ${estado}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {estado === "en revisión" && (
          <p style={{ margin: 0 }}>
            Tu tienda está <strong>en revisión</strong>. Vamos a verificar tu RUC y te avisamos. Cuando el Mercado KurPorc esté
            habilitado vas a poder cargar tus productos desde acá.
          </p>
        )}
        {estado === "verificada" && <p style={{ margin: 0 }}>Tu tienda está verificada. El panel para cargar productos llega con el Mercado.</p>}
        {estado === "rechazada" && <p style={{ margin: 0 }}>No pudimos verificar tu tienda. Escribinos para revisarlo.</p>}
        {tieneGranja && <Link href="/dashboard" className="btn" style={{ height: 34, justifyContent: "center" }}>Ir a mi granja</Link>}
        <BotonSalir />
      </div>
    </MarcoAuth>
  );
}
