"use client";
// Precarga (cliente): guarda las respuestas que el servidor ya trajo y se las entrega al primer fetch("/api/...")
// de la pantalla, sin volver a la red. Cada respuesta se usa una sola vez y vence a los 20 s: después, todo
// (actualizar, guardar, cambiar de pestaña) va al servidor como siempre. Además une pedidos GET idénticos en curso.
const semillas = new Map<string, { cuerpo: string; vence: number }>();
const enCurso = new Map<string, Promise<Response>>();
let instalado = false;
const usados = new WeakSet<object>(); // cada envío del servidor se siembra una sola vez

function clave(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin || !u.pathname.startsWith("/api/")) return null;
    return u.pathname + u.search;
  } catch { return null; }
}

function instalar() {
  if (instalado || typeof window === "undefined") return;
  instalado = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const metodo = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const k = metodo === "GET" && !init?.body ? clave(input) : null;
    if (!k) {
      // Cualquier cambio (POST, PATCH, DELETE…) descarta lo precargado: lo próximo se pide fresco
      if (metodo !== "GET" && metodo !== "HEAD") semillas.clear();
      return original(input, init);
    }
    const s = semillas.get(k);
    if (s) {
      semillas.delete(k);
      if (s.vence > Date.now()) return Promise.resolve(new Response(s.cuerpo, { status: 200, headers: { "content-type": "application/json" } }));
    }
    // El mismo GET ya en camino: se comparte la respuesta
    const previo = enCurso.get(k);
    if (previo) return previo.then(r => r.clone());
    const p = original(input, init);
    enCurso.set(k, p);
    const limpiar = () => { enCurso.delete(k); };
    p.then(limpiar, limpiar);
    return p.then(r => r.clone());
  };
}

export function Semilla({ datos }: { datos: Record<string, string> }) {
  // En el servidor no se guarda nada (el Map sería compartido entre personas)
  if (typeof window === "undefined") return null;
  instalar();
  if (usados.has(datos)) return null;
  usados.add(datos);
  const vence = Date.now() + 20_000;
  for (const [k, cuerpo] of Object.entries(datos)) semillas.set(clave(k) ?? k, { cuerpo, vence });
  return null;
}
