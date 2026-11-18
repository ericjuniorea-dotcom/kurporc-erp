// Precarga: el servidor arma cada módulo con los datos de entrada ya resueltos, en un solo viaje.
// Ejecuta en paralelo los mismos GET de /api que la pantalla pediría desde el navegador (con la misma sesión,
// que se valida una sola vez por pedido gracias a React cache) y le pasa las respuestas a <Semilla>.
import "server-only";
import { NextRequest } from "next/server";

type Handler = (req: NextRequest) => Promise<Response> | Response;

/** Recibe { "/api/ruta?query": GET } y devuelve { "/api/ruta?query": cuerpoJSON } de los que respondieron bien. */
export async function precargar(apis: Record<string, Handler>): Promise<Record<string, string>> {
  const salida: Record<string, string> = {};
  await Promise.all(Object.entries(apis).map(async ([url, get]) => {
    try {
      const res = await get(new NextRequest(new URL(url, "http://kurporc.local")));
      if (res.ok && (res.headers.get("content-type") ?? "").includes("application/json")) salida[url] = await res.text();
    } catch (e) {
      // Si falla, la pantalla lo pide sola como siempre (no se rompe nada)
      if (e && typeof e === "object" && "digest" in e) throw e; // redirect()/notFound() de Next.js
      console.error("[precarga]", url, e);
    }
  }));
  return salida;
}
