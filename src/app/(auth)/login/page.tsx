import { Suspense } from "react";
import { MarcoAuth } from "@/components/auth/marco-auth";
import { FormularioIngreso } from "./formulario-ingreso";

export const metadata = { title: "Ingresar · KurPorc" };

export default function LoginPage() {
  return (
    <MarcoAuth titulo="Ingresar a KurPorc" subtitulo="Elegí cómo querés entrar">
      <Suspense fallback={null}>
        <FormularioIngreso />
      </Suspense>
    </MarcoAuth>
  );
}
