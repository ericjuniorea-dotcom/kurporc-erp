// Nutrición · consumo por día, semana, mes o año (lectura).
import type { NextRequest } from "next/server";
import { consumoPeriodo } from "@/app/acciones/nutricion";
import { responder } from "@/lib/nutricion/respuesta";

export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return responder(() => consumoPeriodo({ desde: p.get("desde") ?? "", hasta: p.get("hasta") ?? "", agrupar: (p.get("agrupar") ?? "dia") as "dia" }));
}
