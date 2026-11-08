import { redirect } from "next/navigation";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { getSession } from "@/lib/auth/config";
import { asegurarFinanzas } from "@/lib/finanzas/datos";
import { materializarCuotas } from "@/lib/finanzas/plan-datos";
import { NavegacionFinanzas, type SeccionFinanzas } from "./navegacion";

export const dynamic = "force-dynamic";

const SECCIONES: (SeccionFinanzas & { permiso: string })[] = [
  { grupo: "Día a día", href: "/finanzas", label: "Tablero", permiso: "finanzas.tablero.ver" },
  { grupo: "Día a día", href: "/finanzas/movimientos", label: "Movimientos", permiso: "finanzas.movimientos.ver" },
  { grupo: "Día a día", href: "/finanzas/caja-bancos", label: "Caja y bancos", permiso: "finanzas.caja_bancos.ver" },
  { grupo: "Día a día", href: "/finanzas/pagar", label: "Por pagar", permiso: "finanzas.pagar.ver" },
  { grupo: "Día a día", href: "/finanzas/cobrar", label: "Por cobrar", permiso: "finanzas.cobrar.ver" },
  { grupo: "Día a día", href: "/finanzas/ventas", label: "Ventas", permiso: "ventas.ventas.ver" },
  { grupo: "Análisis", href: "/finanzas/estado", label: "Estado financiero", permiso: "finanzas.estado.ver" },
  { grupo: "Análisis", href: "/finanzas/indicadores", label: "Indicadores", permiso: "finanzas.indicadores.ver" },
  { grupo: "Análisis", href: "/finanzas/analisis", label: "Análisis del año", permiso: "finanzas.indicadores.ver" },
  { grupo: "Análisis", href: "/finanzas/costos", label: "Costos", permiso: "finanzas.costos.ver" },
  { grupo: "Análisis", href: "/finanzas/produccion", label: "Producción", permiso: "finanzas.costos.ver" },
  { grupo: "Análisis", href: "/finanzas/alimentacion", label: "Alimentación", permiso: "finanzas.balanceado.ver" },
  { grupo: "Análisis", href: "/finanzas/sanidad", label: "Sanidad", permiso: "finanzas.sanidad_valorizada.ver" },
  { grupo: "Análisis", href: "/finanzas/fijos-variables", label: "Fijos y variables", permiso: "finanzas.fijos_variables.ver" },
  { grupo: "Planificación", href: "/finanzas/presupuesto", label: "Presupuesto", permiso: "finanzas.presupuesto.ver" },
  { grupo: "Planificación", href: "/finanzas/presupuesto-vs-real", label: "Presupuesto vs real", permiso: "finanzas.presupuesto_real.ver" },
  { grupo: "Planificación", href: "/finanzas/proyeccion", label: "Proyección", permiso: "finanzas.proyeccion.ver" },
  { grupo: "Planificación", href: "/finanzas/flujo-caja", label: "Flujo de caja", permiso: "finanzas.flujo_caja.ver" },
  { grupo: "Planificación", href: "/finanzas/inversiones", label: "Inversiones", permiso: "finanzas.inversiones.ver" },
  { grupo: "Planificación", href: "/finanzas/nueva-inversion", label: "Nueva inversión", permiso: "finanzas.inversiones.evaluar" },
  { grupo: "Planificación", href: "/finanzas/deudas", label: "Deudas", permiso: "finanzas.deudas.ver" },
  { grupo: "Control", href: "/finanzas/cierre", label: "Cierre de mes", permiso: "finanzas.cierre.cerrar" },
  { grupo: "Control", href: "/finanzas/recomendaciones", label: "Recomendaciones", permiso: "finanzas.recomendaciones.ver" },
  { grupo: "Control", href: "/finanzas/buenas-practicas", label: "Buenas prácticas", permiso: "finanzas.tablero.ver" },
  { grupo: "Control", href: "/finanzas/parametros", label: "Parámetros", permiso: "finanzas.parametros.ver" },
  { grupo: "Control", href: "/finanzas/importacion", label: "Importación", permiso: "finanzas.importar.ejecutar" },
];

export default async function FinanzasLayout({ children }: { children: React.ReactNode }) {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  const visibles = SECCIONES.filter(s => puede(permisos, s.permiso));
  if (visibles.length === 0) redirect("/dashboard");
  await asegurarFinanzas(session.user.tenantId);
  await materializarCuotas(session.user.tenantId, session.user.id);
  return (
    <>
      <NavegacionFinanzas secciones={visibles.map(({ grupo, href, label }) => ({ grupo, href, label }))} />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 1280 }}>{children}</div>
    </>
  );
}
