// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as logisticaInventario } from "@/app/api/logistica/inventario/route";
import { GET as logisticaMovimientos } from "@/app/api/logistica/movimientos/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/logistica/inventario": logisticaInventario,
    "/api/logistica/movimientos": logisticaMovimientos,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
