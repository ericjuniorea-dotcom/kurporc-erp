// Versión publicada (la usa el navegador para saber si quedó con una versión vieja abierta). Sin datos sensibles.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ version: process.env.NEXT_PUBLIC_VERSION ?? "local" }, { headers: { "Cache-Control": "no-store" } });
}
