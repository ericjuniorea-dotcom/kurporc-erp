// Recibe los informes de violación de la Content-Security-Policy (Fase 2.2).
// Mientras la política está en "Report-Only", acá se ve qué bloquearía.
// Los informes quedan en los logs de Vercel (buscar "[csp]").
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const texto = (await req.text()).slice(0, 4000);
    const cuerpo = JSON.parse(texto || "{}");
    const r = cuerpo["csp-report"] ?? cuerpo;
    console.warn("[csp]", JSON.stringify({
      directiva: r["violated-directive"] ?? r.effectiveDirective,
      bloqueado: r["blocked-uri"] ?? r.blockedURL,
      pagina: r["document-uri"] ?? r.documentURL,
    }));
  } catch {
    // informe mal formado: se ignora
  }
  return new NextResponse(null, { status: 204 });
}
