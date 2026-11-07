import { withAuth } from "next-auth/middleware";
import { NextResponse, type NextRequest } from "next/server";

function isPublicRoute(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/whatsapp/webhook") ||
    pathname.startsWith("/api/csp-report")
  );
}

// ── Content-Security-Policy con nonce (Fase 2.2) ─────────────────────
// Arranca en modo "Report-Only" (solo informa a /api/csp-report, no bloquea).
// Después de una semana sin violaciones legítimas: CSP_MODO=enforce en Vercel.
const SUPABASE = "https://evpnnotjjhwovirceyyl.supabase.co";
const ES_DEV = process.env.NODE_ENV !== "production";

function politica(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${ES_DEV ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // React escribe estilos en línea (style={{…}})
    `img-src 'self' data: blob: ${SUPABASE} https://*.s3.amazonaws.com https://lh3.googleusercontent.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE} wss://evpnnotjjhwovirceyyl.supabase.co${ES_DEV ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report",
  ].join("; ");
}

function cabeceraCsp(): string {
  return process.env.CSP_MODO === "enforce"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}

/** Devuelve NextResponse.next() con el nonce disponible para Next.js y la CSP en la respuesta. */
function siguienteConCsp(req: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = politica(nonce);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set(cabeceraCsp(), csp); // Next.js lee el nonce de acá y lo pone en sus <script>
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set(cabeceraCsp(), csp);
  return res;
}

function redirigir(req: NextRequest, ruta: string): NextResponse {
  return NextResponse.redirect(new URL(ruta, req.url));
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (isPublicRoute(pathname)) return siguienteConCsp(req);
    if (!token) return redirigir(req, "/login");

    // Super Admin puede acceder a todo
    if (token.roles?.includes(1)) return siguienteConCsp(req);

    if (pathname.startsWith("/admin")) {
      if (!token.roles?.some((r: number) => [1, 2].includes(r))) return redirigir(req, "/dashboard");
    }

    if (pathname.startsWith("/financiero")) {
      if (!token.roles?.some((r: number) => [1, 2, 9].includes(r))) return redirigir(req, "/dashboard");
    }

    if (pathname.startsWith("/mi-portal")) {
      if (!token.roles?.some((r: number) => [1, 2, 14].includes(r))) return redirigir(req, "/dashboard");
    }

    return siguienteConCsp(req);
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Rutas públicas siempre permitidas (evita bucle de redirección)
        if (isPublicRoute(req.nextUrl.pathname)) return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo|public).*)",
  ],
};
