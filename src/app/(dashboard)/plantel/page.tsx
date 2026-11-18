// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as maternidadHembrasDetail } from "@/app/api/maternidad/hembras-detail/route";
import { GET as plantelStats } from "@/app/api/plantel/stats/route";
import { GET as plantelHembras } from "@/app/api/plantel/hembras/route";
import { GET as configGenetica } from "@/app/api/config/genetica/route";
import { GET as configProcesos } from "@/app/api/config/procesos/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/maternidad/hembras-detail": maternidadHembrasDetail,
    "/api/plantel/stats": plantelStats,
    "/api/plantel/hembras": plantelHembras,
    "/api/config/genetica?funcion=MATERNA&activas=1": configGenetica,
    "/api/config/procesos?modulo=PLANTEL": configProcesos,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
