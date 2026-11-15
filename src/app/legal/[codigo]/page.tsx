// Enlaces viejos a un documento (/legal/terminos-mercado, etc.) → la página única de condiciones
import { redirect } from "next/navigation";

export default async function DocumentoLegal({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  redirect(`/condiciones?doc=${encodeURIComponent(codigo.toLowerCase().replace(/_/g, "-"))}`);
}
