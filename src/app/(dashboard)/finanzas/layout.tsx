import { redirect } from "next/navigation";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { getSession } from "@/lib/auth/config";
import { asegurarFinanzas } from "@/lib/finanzas/datos";
import { NavegacionFinanzas, type SeccionFinanzas } from "./navegacion";

export const dynamic = "force-dynamic";

const SECCIONES: (SeccionFinanzas & { permiso: string })[] = [
  { href: "/finanzas", label: "Tablero", permiso: "finanzas.tablero.ver" },
  { href: "/finanzas/movimientos", label: "Movimientos", permiso: "finanzas.movimientos.ver" },
  { href: "/finanzas/caja-bancos", label: "Caja y bancos", permiso: "finanzas.caja_bancos.ver" },
  { href: "/finanzas/pagar", label: "Por pagar", permiso: "finanzas.pagar.ver" },
  { href: "/finanzas/cobrar", label: "Por cobrar", permiso: "finanzas.cobrar.ver" },
  { href: "/finanzas/ventas", label: "Ventas", permiso: "ventas.ventas.ver" },
  { href: "/finanzas/produccion", label: "Producción", permiso: "finanzas.costos.ver" },
  { href: "/finanzas/alimentacion", label: "Alimentación", permiso: "finanzas.balanceado.ver" },
  { href: "/finanzas/sanidad", label: "Sanidad", permiso: "finanzas.sanidad_valorizada.ver" },
  { href: "/finanzas/costos", label: "Costos", permiso: "finanzas.costos.ver" },
  { href: "/finanzas/fijos-variables", label: "Fijos y variables", permiso: "finanzas.fijos_variables.ver" },
  { href: "/finanzas/parametros", label: "Parámetros", permiso: "finanzas.parametros.ver" },
];

export default async function FinanzasLayout({ children }: { children: React.ReactNode }) {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  const visibles = SECCIONES.filter(s => puede(permisos, s.permiso));
  if (visibles.length === 0) redirect("/dashboard");
  await asegurarFinanzas(session.user.tenantId);
  return (
    <>
      <NavegacionFinanzas secciones={visibles.map(({ href, label }) => ({ href, label }))} />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1280 }}>{children}</div>
    </>
  );
}
