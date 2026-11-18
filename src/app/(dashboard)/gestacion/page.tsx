// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as gestacionKpis } from "@/app/api/gestacion/kpis/route";
import { GET as gestacionVisionGeneral } from "@/app/api/gestacion/vision-general/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/gestacion/kpis": gestacionKpis,
    "/api/gestacion/vision-general": gestacionVisionGeneral,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
