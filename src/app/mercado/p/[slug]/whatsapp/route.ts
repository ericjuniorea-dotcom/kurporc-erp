// "Consultar por WhatsApp" (Fase 12): solo con sesión. Abre el chat con la tienda y un mensaje armado.
import { NextResponse, type NextRequest } from "next/server";
import { getUsuario } from "@/lib/auth/config";
import { publicacionPorSlug } from "@/lib/mercado/consultas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const volver = `/mercado/p/${slug}`;
  const usuario = await getUsuario();
  if (!usuario) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(volver)}`, req.url));
  const d = await publicacionPorSlug(slug);
  const numero = d?.org.whatsapp?.replace(/\D/g, "");
  if (!d || !numero) return NextResponse.redirect(new URL(volver, req.url));
  const texto = `Hola, vi «${d.p.titulo}» (${d.p.unidadVenta}) en el Mercado KurPorc: ${req.nextUrl.origin}${volver}. ¿Está disponible?`;
  return NextResponse.redirect(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`);
}
