import { redirect } from "next/navigation";
import { MarcoAuth } from "@/components/auth/marco-auth";
import { getUsuario } from "@/lib/auth/config";
import { pendientesPersona } from "@/lib/legal/documentos";
import { FormularioAceptacion } from "./formulario-aceptacion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Términos y Privacidad · KurPorc" };

export default async function AceptarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const destino = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const usuario = await getUsuario();
  if (!usuario) redirect("/login?next=/legal/aceptar");
  const pendientes = await pendientesPersona(usuario.id);
  if (pendientes.length === 0) redirect(destino);

  return (
    <MarcoAuth
      titulo="Antes de empezar"
      subtitulo="Un único paso: aceptar nuestras condiciones. No te lo vamos a volver a pedir."
    >
      <FormularioAceptacion destino={destino} documentos={pendientes.map(p => ({ id: p.id, hash: p.hashMostrado, codigo: p.codigo, titulo: p.titulo, version: p.version }))} />
    </MarcoAuth>
  );
}
