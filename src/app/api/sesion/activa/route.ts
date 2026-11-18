// Señal de «sigo usando KurPorc»: no hace nada; el middleware renueva la marca de actividad al pasar por acá.
export const dynamic = "force-dynamic";
export function GET() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
