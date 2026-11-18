// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as tareas } from "@/app/api/tareas/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/tareas?periodo=semana": tareas,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
