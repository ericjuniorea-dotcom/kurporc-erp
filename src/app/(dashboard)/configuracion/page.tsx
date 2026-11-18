// Se arma en el servidor con los datos de la pestaña que se abre (un solo viaje): ver src/lib/precarga.
import { precargar } from "@/lib/precarga/servidor";
import { Semilla } from "@/components/precarga/semilla";
import { GET as metas } from "@/app/api/config/metas/route";
import { GET as alertas } from "@/app/api/config/alertas/route";
import { GET as procesos } from "@/app/api/config/procesos/route";
import { GET as genetica } from "@/app/api/config/genetica/route";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const modulo = typeof sp.modulo === "string" && /^[A-Z_]{2,30}$/.test(sp.modulo) ? sp.modulo : "GESTACION";
  const tab = typeof sp.tab === "string" ? sp.tab : "Metas";
  const apis = tab === "Alertas" ? { [`/api/config/alertas?modulo=${modulo}`]: alertas }
    : tab === "Procesos" ? { [`/api/config/procesos?modulo=${modulo}`]: procesos }
    : tab === "Genética" ? { "/api/config/genetica": genetica }
    : { [`/api/config/metas?modulo=${modulo}`]: metas };
  const datos = await precargar(apis);
  return <><Semilla datos={datos} /><Pantalla /></>;
}
