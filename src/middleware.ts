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

const RUTAS_PUBLICAS = [
  "/login", "/registro", "/recuperar", "/auth/", "/invitacion/",
  "/terminos", "/privacidad", "/legal/", "/precios", "/mercado", "/tienda/",
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

function politica(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${ES_DEV ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // React escribe estilos en línea (style={{…}})
    `img-src 'self' data: blob: ${SUPABASE} https://lh3.googleusercontent.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE} ${SUPABASE_WS}${ES_DEV ? " ws:" : ""}`,
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
  const conSesion = !!data?.claims?.sub;
  const { pathname, search } = req.nextUrl;

  if (!conSesion && !esPublica(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
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
  if (req.cookies.has("kp_plataforma") && !["GET", "HEAD", "OPTIONS"].includes(req.method)
    && !pathname.startsWith("/admin") && !pathname.startsWith("/auth/")) {
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
