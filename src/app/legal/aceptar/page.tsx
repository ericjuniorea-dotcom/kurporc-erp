import { redirect } from "next/navigation";
import { MarcoAuth } from "@/components/auth/marco-auth";
import { getUsuario } from "@/lib/auth/config";
import { pendientesPersona } from "@/lib/legal/documentos";
import { FormularioAceptacion } from "./formulario-aceptacion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Términos y Privacidad · KurPorc" };

export default async function AceptarPage() {
  const usuario = await getUsuario();
  if (!usuario) redirect("/login?next=/legal/aceptar");
  const pendientes = await pendientesPersona(usuario.id);
  if (pendientes.length === 0) redirect("/dashboard");

  const actualizacion = pendientes.some(p => p.version !== "1.0");
  return (
    <MarcoAuth
      titulo={actualizacion ? "Actualizamos nuestros términos" : "Antes de empezar"}
      subtitulo={actualizacion
        ? "Para seguir usando KurPorc, aceptá la versión nueva."
        : "Para usar KurPorc necesitamos que aceptes nuestros términos."}
    >
      <FormularioAceptacion documentos={pendientes.map(p => ({ id: p.id, hash: p.hashMostrado, codigo: p.codigo, titulo: p.titulo, version: p.version }))} />
    </MarcoAuth>
  );
}
