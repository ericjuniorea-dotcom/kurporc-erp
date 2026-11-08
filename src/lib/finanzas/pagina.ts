// Acceso común a las páginas de Finanzas: sesión, permiso y organización.
import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { hoyUTC, mesDe } from "./calculos";

export async function paginaFinanzas(permiso: string) {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  if (!puede(permisos, permiso)) redirect("/finanzas");
  const corte = hoyUTC();
  return { session, permisos, org: session.user.tenantId, corte, mesCorte: mesDe(corte) };
}

/** Mes de corte para un año: el actual si es este año, diciembre si es un año pasado. */
export function corteDelAnio(anio: number, mesHoy: number) {
  const actual = Math.floor(mesHoy / 100);
  return anio < actual ? anio * 100 + 12 : anio > actual ? anio * 100 + 1 : mesHoy;
}
