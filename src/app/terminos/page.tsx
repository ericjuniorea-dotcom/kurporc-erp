import { PaginaDocumento } from "@/components/legal/pagina-documento";

export const dynamic = "force-dynamic";
export const metadata = { title: "Términos y Condiciones · KurPorc", description: "Términos y Condiciones de Uso de KurPorc" };

export default function TerminosPage() {
  return <PaginaDocumento codigo="TERMINOS" />;
}
