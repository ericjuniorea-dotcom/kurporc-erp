// Sale del modo plataforma ("Ver todo") y vuelve al panel.
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_PLATAFORMA } from "@/lib/admin/modo-plataforma";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/organizaciones", req.url));
  res.cookies.set(COOKIE_PLATAFORMA, "", { path: "/", maxAge: 0 });
  return res;
}
