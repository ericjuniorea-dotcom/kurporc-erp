// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as nurseryBatches } from "@/app/api/nursery-batches/route";
import { GET as recriaResumen } from "@/app/api/recria/resumen/route";
import { GET as tareasHoy } from "@/app/api/tareas/hoy/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/nursery-batches?active=true": nurseryBatches,
    "/api/recria/resumen": recriaResumen,
    "/api/tareas/hoy?sector=iniciacion": tareasHoy,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
