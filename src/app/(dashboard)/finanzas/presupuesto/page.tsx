import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { categoriasDe } from "@/lib/finanzas/datos";
import { SelectorAnio, anioDe } from "../tabla-mensual";
import { GrillaPresupuesto } from "./grilla";

export const metadata = { title: "Presupuesto · Finanzas · KurPorc" };

export default async function PresupuestoPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, permisos, mesCorte } = await paginaFinanzas("finanzas.presupuesto.ver");
  const anio = anioDe(await searchParams);
  const [cats, pres] = await Promise.all([
    categoriasDe(org),
    prisma.presupuesto.groupBy({ by: ["categoriaId", "mes"], where: { organizacionId: org, mes: { gte: anio * 100 + 1, lte: anio * 100 + 12 } }, _sum: { montoGs: true } }),
  ]);
  const valores: Record<string, string[]> = {};
  for (const p of pres) {
    valores[p.categoriaId] ??= Array(12).fill("");
    valores[p.categoriaId][(p.mes % 100) - 1] = (p._sum.montoGs ?? 0n).toString();
  }
  return (
    <>
      <SelectorAnio anio={anio} base="/finanzas/presupuesto" desde={Math.floor(mesCorte / 100) - 2} />
      <GrillaPresupuesto
        anio={anio} mesCorte={mesCorte} editable={puede(permisos, "finanzas.presupuesto.editar")}
        categorias={cats.filter(c => c.tipo === "GASTO" || c.tipo === "INVERSION").map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo }))}
        valores={valores}
      />
    </>
  );
}
