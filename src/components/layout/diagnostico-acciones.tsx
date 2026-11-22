"use client";
// Si una acción de pantalla (botón, carga) recibe del servidor algo que no es su respuesta normal, se registra
// qué llegó para poder encontrar la causa. No cambia nada del pedido ni de la respuesta.
import { useEffect } from "react";

let instalado = false;
export function DiagnosticoAcciones() {
  useEffect(() => {
    if (instalado) return;
    instalado = true;
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = await original(input, init);
      try {
        const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        const accion = h.get("next-action");
        const tipo = r.headers.get("content-type") ?? "";
        if (accion && !tipo.startsWith("text/x-component") && !r.headers.get("x-action-redirect")) {
          const cuerpo = await r.clone().text().catch(() => "");
          const cabeceras = Array.from(r.headers.entries()).filter(([k]) => !/cookie/i.test(k)).map(([k, v]) => `${k}: ${v}`).join("\n");
          original("/api/diagnostico", { method: "POST", headers: { "content-type": "application/json" }, keepalive: true,
            body: JSON.stringify({ ruta: location.pathname + location.search, estado: r.status, tipo, redirigida: r.redirected, urlFinal: r.url, cabeceras, cuerpo: cuerpo.slice(0, 600), accion: accion.slice(0, 60) }) }).catch(() => {});
        }
      } catch { /* el diagnóstico nunca rompe el pedido */ }
      return r;
    };
  }, []);
  return null;
}
