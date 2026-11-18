// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as rrhhFuncionarios } from "@/app/api/rrhh/funcionarios/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/rrhh/funcionarios": rrhhFuncionarios,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
