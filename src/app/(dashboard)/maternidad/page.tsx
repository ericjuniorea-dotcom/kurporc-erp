// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as maternidadKpis } from "@/app/api/maternidad/kpis/route";
import { GET as tareasHoy } from "@/app/api/tareas/hoy/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/maternidad/kpis": maternidadKpis,
    "/api/tareas/hoy?sector=maternidad": tareasHoy,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
