import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { vistaPendientes } from "@/lib/finanzas/pendientes";
import { CuentasPendientes } from "../cuentas-pendientes";

export const metadata = { title: "Por pagar · Finanzas · KurPorc" };

export default async function PagarPage() {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "finanzas.pagar.ver")) redirect("/finanzas");
  const v = await vistaPendientes(session.user.tenantId, false);
  return <CuentasPendientes {...v} esCobro={false} puedeRegistrar={puede(permisos, "finanzas.pagar.registrar_pago")} />;
}
