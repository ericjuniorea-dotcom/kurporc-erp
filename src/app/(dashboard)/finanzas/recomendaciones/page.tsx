import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { nombreMes } from "@/lib/finanzas/calculos";
import { PanelRecomendaciones } from "./panel";

export const metadata = { title: "Recomendaciones · Finanzas · KurPorc" };

export default async function RecomendacionesPage() {
  const { org, permisos, mesCorte } = await paginaFinanzas("finanzas.recomendaciones.ver");
  const recs = await prisma.recomendacion.findMany({ where: { organizacionId: org }, orderBy: [{ mes: "desc" }, { prioridad: "asc" }, { codigo: "asc" }], take: 200 });
  return (
    <PanelRecomendaciones mesCorte={mesCorte} nombreMesCorte={nombreMes(mesCorte)} gestionar={puede(permisos, "finanzas.recomendaciones.gestionar")}
      recomendaciones={recs.map(r => ({ id: r.id, codigo: r.codigo, mes: nombreMes(r.mes), problema: r.problema, situacion: r.situacion, mejora: r.mejora, impacto: r.impacto, prioridad: r.prioridad, accion: r.accion, estado: r.estado }))} />
  );
}
