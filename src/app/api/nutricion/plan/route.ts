// Nutrición · plan de alimentación (lectura).
import { planAlimentacion } from "@/app/acciones/nutricion";
import { responder } from "@/lib/nutricion/respuesta";

export const dynamic = "force-dynamic";
export function GET() {
  return responder(() => planAlimentacion());
}
