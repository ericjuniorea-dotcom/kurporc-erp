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
  const verificada = org?.verificacion === "VERIFICADA";
  const rechazada = org?.verificacion === "RECHAZADA";

  return (
    <MarcoAuth titulo={org?.farmName ?? "Mi tienda"} subtitulo={`RUC ${org?.ruc ?? "—"} · ${rechazada ? "Tienda suspendida" : verificada ? "Tienda activa · RUC verificado ✓" : "Tienda activa"}`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
        {!rechazada && (
          <p style={{ margin: 0 }}>
            Tu tienda está <strong>activa</strong>.{" "}
            {verificada
              ? "Tu RUC figura activo en la DNIT: los compradores van a ver el sello de verificada."
              : "Tu RUC todavía no figura activo en el padrón de la DNIT; cuando aparezca, la tienda se verifica sola."}
            {" "}El panel para cargar tus productos llega con el Mercado KurPorc.
          </p>
        )}
        {rechazada && <p style={{ margin: 0 }}>Tu tienda está suspendida. Escribinos para revisarlo.</p>}
        {tieneGranja && <Link href="/dashboard" className="btn" style={{ height: 34, justifyContent: "center" }}>Ir a mi granja</Link>}
        <BotonSalir />
      </div>
    </MarcoAuth>
  );
}
