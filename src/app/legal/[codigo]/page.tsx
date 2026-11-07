import { notFound } from "next/navigation";
import { PaginaDocumento } from "@/components/legal/pagina-documento";

export const dynamic = "force-dynamic";

const PERMITIDOS = ["TERMINOS", "PRIVACIDAD", "ACUERDO_ORGANIZACION", "TERMINOS_VENDEDOR", "TERMINOS_MERCADO"];

export default async function DocumentoLegalPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const c = codigo.toUpperCase().replace(/-/g, "_");
  if (!PERMITIDOS.includes(c)) notFound();
  return <PaginaDocumento codigo={c} />;
}
