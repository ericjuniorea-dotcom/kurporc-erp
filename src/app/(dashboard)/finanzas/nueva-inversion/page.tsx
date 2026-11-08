import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { datosProyeccion } from "@/lib/finanzas/plan-datos";
import { categoriasDe } from "@/lib/finanzas/datos";
import { cuotaFrancesa } from "@/lib/finanzas/planificacion";
import { PanelEvaluaciones } from "./panel";

export const metadata = { title: "Nueva inversión · Finanzas · KurPorc" };

export default async function NuevaInversionPage() {
  const { org, permisos, corte } = await paginaFinanzas("finanzas.inversiones.evaluar");
  const [evs, cats, proy] = await Promise.all([
    prisma.evaluacionInversion.findMany({ where: { organizacionId: org }, orderBy: { createdAt: "desc" } }),
    categoriasDe(org),
    datosProyeccion(org),
  ]);
  const nombreCat = new Map(cats.map(c => [c.id, c.nombre]));
  const flujo = proy.flujoOperativoPromedio, cuotaActual = proy.cuotaActual;
  return (
    <PanelEvaluaciones
      hoy={corte.toISOString().slice(0, 10)}
      puedo={{ evaluar: puede(permisos, "finanzas.inversiones.evaluar"), ejecutar: puede(permisos, "finanzas.inversiones.crear") }}
      flujoPromedio={flujo.toString()} cuotaActual={cuotaActual.toString()}
      categorias={cats.filter(c => c.tipo === "INVERSION").map(c => ({ id: c.id, nombre: c.nombre }))}
      evaluaciones={evs.map(e => {
        const cuota = Math.round(cuotaFrancesa(Number(e.financiamientoGs), e.plazoMeses, e.tasaAnual === null ? null : Number(e.tasaAnual)));
        const contado = Number(e.montoTotalGs - e.financiamientoGs);
        // Corrección respecto de la planilla (8.18): flujo sin aportes y sin restar dos veces las cuotas actuales
        const margen = Number(flujo) - Number(cuotaActual) - cuota;
        const margenPlanilla = Number(flujo) - Number(cuotaActual) - Number(cuotaActual) - cuota;
        return {
          id: e.id, fecha: e.fechaPrevista.toISOString().slice(0, 10), concepto: e.concepto, categoria: nombreCat.get(e.categoriaId) ?? "—",
          montoGs: e.montoTotalGs.toString(), formaPago: e.formaPago, financiamientoGs: e.financiamientoGs.toString(), plazo: e.plazoMeses,
          tasa: e.tasaAnual === null ? null : Number(e.tasaAnual), cuota, contado, margen, margenPlanilla, estado: e.estado,
        };
      })}
    />
  );
}
