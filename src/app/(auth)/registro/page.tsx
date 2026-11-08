import { Suspense } from "react";
import { MarcoAuth } from "@/components/auth/marco-auth";
import { FormularioRegistro } from "./formulario-registro";

export const metadata = { title: "Crear cuenta · KurPorc", description: "Creá tu cuenta gratis en KurPorc" };

export default function RegistroPage() {
  return (
    <MarcoAuth titulo="¿Cómo vas a usar KurPorc?" subtitulo="Elegí una opción. Después podés sumar más con la misma cuenta.">
      <Suspense fallback={null}>
        <FormularioRegistro />
      </Suspense>
    </MarcoAuth>
  );
}
