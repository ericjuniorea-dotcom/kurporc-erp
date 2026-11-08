import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { vistaPendientes } from "@/lib/finanzas/pendientes";
import { CuentasPendientes } from "../cuentas-pendientes";

export const metadata = { title: "Por cobrar · Finanzas · KurPorc" };

export default async function CobrarPage() {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, "finanzas.cobrar.ver")) redirect("/finanzas");
  const v = await vistaPendientes(session.user.tenantId, true);
  return <CuentasPendientes {...v} esCobro puedeRegistrar={puede(permisos, "finanzas.cobrar.registrar_cobro")} />;
}
