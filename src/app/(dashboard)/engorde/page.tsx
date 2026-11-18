// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as engordeKpis } from "@/app/api/engorde/kpis/route";
import { GET as engordeLotes } from "@/app/api/engorde/lotes/route";
import { GET as tareasHoy } from "@/app/api/tareas/hoy/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/engorde/kpis": engordeKpis,
    "/api/engorde/lotes?estado=activo": engordeLotes,
    "/api/tareas/hoy?sector=engorde": tareasHoy,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
