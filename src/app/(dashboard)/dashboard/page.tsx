// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as dashboardKpis } from "@/app/api/dashboard/kpis/route";
import { GET as dashboardChartData } from "@/app/api/dashboard/chart-data/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/dashboard/kpis": dashboardKpis,
    "/api/dashboard/chart-data": dashboardChartData,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
