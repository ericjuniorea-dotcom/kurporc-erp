// Compras en el Mercado KurPorc (Fase 13): pedidos, cotizaciones y aprobaciones de la organización.
import { Suspense } from "react";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede, puedeAlguno } from "@/lib/permisos/servidor";
import { EncabezadoCompras } from "./encabezado";

export const metadata = { title: "Compras · KurPorc" };

export default async function LayoutCompras({ children }: { children: React.ReactNode }) {
  const permisos = await getPermisos();
  if (!permisos) redirect("/login");
  if (!puedeAlguno(permisos, ["compras.pedidos.ver", "compras.cotizaciones.ver", "compras.necesidades.ver"])) redirect("/dashboard");
  const aprueba = puede(permisos, "compras.pedidos.aprobar");
  const porAprobar = aprueba ? await prisma.pedido.count({ where: { organizacionId: permisos.organizacionId, estado: "PENDIENTE_APROBACION" } }) : -1;
  return (
    <>
      <Suspense><EncabezadoCompras porAprobar={porAprobar} puedeCotizar={puede(permisos, "compras.cotizaciones.crear")} /></Suspense>
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1200 }}>{children}</div>
    </>
  );
}
