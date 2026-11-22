// Nutrición · carga del día (lectura). Misma lógica que la acción nutricionDia, por GET (más robusto en el celular).
import type { NextRequest } from "next/server";
import { nutricionDia } from "@/app/acciones/nutricion";
import { responder } from "@/lib/nutricion/respuesta";

export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  return responder(() => nutricionDia(req.nextUrl.searchParams.get("fecha") ?? ""));
}
