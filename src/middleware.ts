import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

function isPublicRoute(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/whatsapp/webhook")
  );
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    if (isPublicRoute(pathname)) return NextResponse.next();
    if (!token) return NextResponse.redirect(new URL("/login", req.url));

    // Super Admin puede acceder a todo
    if (token.roles?.includes(1)) return NextResponse.next();

    if (pathname.startsWith("/admin")) {
      if (!token.roles?.some((r: number) => [1, 2].includes(r)))
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (pathname.startsWith("/financiero")) {
      if (!token.roles?.some((r: number) => [1, 2, 9].includes(r)))
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (pathname.startsWith("/mi-portal")) {
      if (!token.roles?.some((r: number) => [1, 2, 14].includes(r)))
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
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
