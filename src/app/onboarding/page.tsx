import { redirect } from "next/navigation";
import { MarcoAuth } from "@/components/auth/marco-auth";
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";
import { documentoVigente } from "@/lib/legal/documentos";
import { Asistente } from "./asistente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Primeros pasos · KurPorc" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login?next=/onboarding");
  if (usuario.faltaSegundoFactor) redirect("/auth/segundo-factor");
  if (usuario.faltaAceptarContrato) redirect("/legal/aceptar");

  const [{ tipo }, perfil, acuerdoOrg, acuerdoVendedor] = await Promise.all([
    searchParams,
    prisma.user.findUnique({ where: { id: usuario.id }, select: { name: true, phone: true, departamento: true, distrito: true } }),
    documentoVigente("ACUERDO_ORGANIZACION"),
    documentoVigente("TERMINOS_VENDEDOR"),
  ]);
  const tipoInicial = ["COMPRADOR", "INDIVIDUAL", "EMPRESA", "VENDEDOR"].includes((tipo ?? "").toUpperCase())
    ? (tipo!.toUpperCase() as "COMPRADOR" | "INDIVIDUAL" | "EMPRESA" | "VENDEDOR") : null;

  return (
    <MarcoAuth titulo="Primeros pasos" subtitulo="Dos minutos y empezás a usar KurPorc">
      <Asistente
        tipoInicial={tipoInicial}
        perfil={{ nombre: perfil?.name ?? "", telefono: perfil?.phone ?? "", departamento: perfil?.departamento ?? "", distrito: perfil?.distrito ?? "" }}
        acuerdos={{
          organizacion: acuerdoOrg ? { hash: acuerdoOrg.hashMostrado, titulo: acuerdoOrg.titulo } : null,
          vendedor: acuerdoVendedor ? { hash: acuerdoVendedor.hashMostrado, titulo: acuerdoVendedor.titulo } : null,
        }}
      />
    </MarcoAuth>
  );
}
