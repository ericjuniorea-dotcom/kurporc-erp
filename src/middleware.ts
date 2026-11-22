// Middleware (Fase 3): renueva la sesión de Supabase Auth, protege las rutas
// privadas y agrega la Content-Security-Policy con nonce (Fase 2.2).
//
// Reglas (en orden):
//  1. Rutas públicas: pasan siempre.
//  2. Sin sesión en una ruta privada → /login?next=<ruta> (las API responden 401).
//  3. Lo demás (contraseña temporal, organización activa, permisos) lo valida el
//     servidor con la base de datos: layout del ERP y cada API (getSession).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_ACTIVIDAD, LIMITE_INACTIVIDAD_MS } from "@/lib/sesion/inactividad";

const RUTAS_PUBLICAS = [
  "/login", "/registro", "/recuperar", "/auth/", "/invitacion/",
  "/terminos", "/privacidad", "/condiciones", "/legal/", "/precios", "/mercado", "/tienda/",
  "/api/whatsapp/webhook", "/api/csp-report", "/api/cron/", "/sitemap.xml", "/robots.txt",
];

function esPublica(pathname: string) {
  if (pathname === "/") return true;
  return RUTAS_PUBLICAS.some(r => {
    const base = r.replace(/\/$/, "");
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}

// ── Content-Security-Policy con nonce ───────────────────────────────
// Modo "Report-Only" (informa a /api/csp-report). Para bloquear: CSP_MODO=enforce en Vercel.
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://evpnnotjjhwovirceyyl.supabase.co";
const SUPABASE_WS = SUPABASE.replace(/^https:/, "wss:");
const ES_DEV = process.env.NODE_ENV !== "production";
const TURNSTILE = "https://challenges.cloudflare.com"; // CAPTCHA de Cloudflare (Anexo F.1)

function politica(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${TURNSTILE}${ES_DEV ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // React escribe estilos en línea (style={{…}})
    `img-src 'self' data: blob: ${SUPABASE} https://lh3.googleusercontent.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE} ${SUPABASE_WS} ${TURNSTILE}${ES_DEV ? " ws:" : ""}`,
    `frame-src 'self' ${TURNSTILE}`, // CAPTCHA (Turnstile) se muestra en un iframe
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${SUPABASE}`,
    "report-uri /api/csp-report",
  ].join("; ");
}

const CABECERA_CSP = process.env.CSP_MODO === "enforce"
  ? "Content-Security-Policy"
  : "Content-Security-Policy-Report-Only";

/**
 * Dueño (sub de Supabase) de la marca «Ver ERP», solo si la marca es auténtica (firma HMAC, la misma que valida el
 * servidor en src/lib/admin/modo-plataforma.ts) y no venció. Una marca vieja, vencida o rota da null y se borra:
 * así nunca deja a alguien trabado en «solo lectura» sin estar en ese modo.
 */
async function duenioDeMarca(valor: string): Promise<string | null> {
  try {
    const [cuerpo, firma] = valor.split(".");
    if (!cuerpo || !firma) return null;
    const secreto = process.env.CAMPOS_HMAC_KEY ?? (ES_DEV ? "desarrollo" : null);
    if (!secreto) return null;
    const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(`modo-plataforma:${secreto}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(cuerpo)));
    let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
    const esperada = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (esperada !== firma) return null;
    const b64 = cuerpo.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    if (typeof json.hasta !== "number" || json.hasta <= Date.now()) return null;
    return typeof json.sub === "string" ? json.sub : null;
  } catch { return null; }
}

export async function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = politica(nonce);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set(CABECERA_CSP, csp); // Next.js lee el nonce de acá y lo pone en sus <script>
  reqHeaders.set("x-ruta", req.nextUrl.pathname); // para registrar qué vio el modo plataforma

  let res = NextResponse.next({ request: { headers: reqHeaders } });

  // Cliente de Supabase que renueva el token y reescribe las cookies de sesión
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (lista) => {
          lista.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: { headers: reqHeaders } });
          lista.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims valida el JWT y, si venció, lo renueva (no confiar en getSession acá)
  const { data } = await supabase.auth.getClaims();
  let conSesion = !!data?.claims?.sub;
  const { pathname, search } = req.nextUrl;

  // Cierre por inactividad: si pasaron más de 30 min desde el último uso real, la sesión se cierra
  // (se borran las cookies de Supabase). Las precargas automáticas no cuentan como uso.
  let porInactividad = false;
  if (conSesion) {
    const ultima = Number(req.cookies.get(COOKIE_ACTIVIDAD)?.value);
    const ahora = Date.now();
    const precarga = req.headers.get("next-router-prefetch") === "1" || req.headers.get("purpose") === "prefetch";
    if (Number.isFinite(ultima) && ultima > 0 && ahora - ultima > LIMITE_INACTIVIDAD_MS) {
      porInactividad = true;
      conSesion = false;
      for (const c of req.cookies.getAll()) {
        if (c.name.startsWith("sb-")) { req.cookies.delete(c.name); res.cookies.set(c.name, "", { path: "/", maxAge: 0 }); }
      }
      res.cookies.set("kp_plataforma", "", { path: "/", maxAge: 0 });
      res.cookies.set(COOKIE_ACTIVIDAD, "", { path: "/", maxAge: 0 });
    } else if (!precarga && (!Number.isFinite(ultima) || ultima <= 0 || ahora - ultima > 30_000)) {
      res.cookies.set(COOKIE_ACTIVIDAD, String(ahora), { path: "/", httpOnly: true, sameSite: "lax", secure: !ES_DEV, maxAge: 60 * 60 * 24 * 7 });
    }
  } else if (req.cookies.has(COOKIE_ACTIVIDAD)) {
    // Sin sesión: la marca vieja no puede cerrar la próxima sesión apenas se ingrese
    res.cookies.set(COOKIE_ACTIVIDAD, "", { path: "/", maxAge: 0 });
  }

  if (!conSesion && !esPublica(pathname)) {
    if (pathname.startsWith("/api/")) {
      const r401 = NextResponse.json({ error: porInactividad ? "La sesión se cerró por inactividad. Volvé a ingresar." : "No autenticado" }, { status: 401 });
      res.cookies.getAll().forEach(c => r401.cookies.set(c));
      return r401;
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}${porInactividad ? "&error=inactividad" : ""}`;
    // Pedido de una acción de la pantalla (botón, carga de datos): un desvío común le devuelve la página de ingreso
    // y la pantalla muestra «An unexpected response…». Con esta cabecera Next.js lleva a la persona a ingresar.
    if (req.headers.has("next-action")) {
      const r = new NextResponse(null, { status: 200, headers: { "x-action-redirect": `${url.pathname}${url.search};replace`, "content-type": "text/plain" } });
      res.cookies.getAll().forEach(c => r.cookies.set(c));
      return r;
    }
    const redir = NextResponse.redirect(url);
    res.cookies.getAll().forEach(c => redir.cookies.set(c));
    return redir;
  }

  // Ya con sesión, /login no tiene sentido
  if (conSesion && pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    const redir = NextResponse.redirect(url);
    res.cookies.getAll().forEach(c => redir.cookies.set(c));
    return redir;
  }

  // Modo plataforma (Fase 11, "Ver todo"): solo lectura. Toda escritura fuera del panel y de la
  // salida se rechaza acá, antes de llegar a cualquier API o acción de servidor.
  // Ingresar, registrarse y recuperar la clave siempre se permiten: la cookie puede quedar de una sesión anterior.
  // La marca solo vale para el administrador que la creó: si la sesión es de otra persona (o es una marca vieja
  // sin dueño), se ignora y se borra. La validación completa (firma, nivel) la hace el servidor.
  // Solo bloquea una marca auténtica, vigente y de esta misma persona. Cualquier otra (vacía, vieja, de otra
  // cuenta) se borra y no bloquea nada.
  const marca = req.cookies.get("kp_plataforma")?.value;
  const marcaValida = !!marca && !!data?.claims?.sub && (await duenioDeMarca(marca)) === data.claims.sub;
  if (req.cookies.has("kp_plataforma") && !marcaValida) {
    req.cookies.delete("kp_plataforma");
    res.cookies.set("kp_plataforma", "", { path: "/", maxAge: 0 });
  }
  if (marcaValida && !["GET", "HEAD", "OPTIONS"].includes(req.method)
    && !pathname.startsWith("/admin") && !pathname.startsWith("/auth/")
    && !["/login", "/registro", "/recuperar"].some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.json({ error: "Modo plataforma: solo lectura. Salí del modo para hacer cambios." }, { status: 403 });
  }

  res.headers.set(CABECERA_CSP, csp);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|logo|public|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
