// Dashboard: se calcula en el servidor y llega armado en un solo viaje (sin pedidos desde el navegador).
import { getSession } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { tableroGranja } from "@/lib/indicadores/granja";
import Pantalla from "./pantalla";

export const dynamic = "force-dynamic";

export default async function Pagina() {
  const session = await getSession();
  if (!session) redirect("/login");
  const datos = await tableroGranja(session.user.tenantId);
  return <Pantalla datos={datos} />;
}
