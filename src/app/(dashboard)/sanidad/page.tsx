// Se arma en el servidor con los datos de entrada ya resueltos (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as sanidadVacunas } from "@/app/api/sanidad/vacunas/route";
import { GET as sanidadLotes } from "@/app/api/sanidad/lotes/route";
import { GET as sanidadEventos } from "@/app/api/sanidad/eventos/route";
import { GET as sanidadProtocolos } from "@/app/api/sanidad/protocolos/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const datos = await precargar({
    "/api/sanidad/vacunas": sanidadVacunas,
    "/api/sanidad/lotes": sanidadLotes,
    "/api/sanidad/eventos?hasta=2030-01-01": sanidadEventos,
    "/api/sanidad/protocolos": sanidadProtocolos,
  });
  return <><Semilla datos={datos} /><Pantalla /></>;
}
