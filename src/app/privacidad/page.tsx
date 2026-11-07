import { PaginaDocumento } from "@/components/legal/pagina-documento";

export const dynamic = "force-dynamic";
export const metadata = { title: "Política de Privacidad · KurPorc", description: "Cómo KurPorc trata tus datos personales" };

export default function PrivacidadPage() {
  return <PaginaDocumento codigo="PRIVACIDAD" />;
}
