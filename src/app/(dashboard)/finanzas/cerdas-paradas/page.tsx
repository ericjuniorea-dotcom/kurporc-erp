import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { puede } from "@/lib/permisos/servidor";
import { detalleCerda, resumenParadas, sinDiagnostico } from "@/lib/cerdas-paradas/datos";
import { VistaParadas } from "@/components/cerdas-paradas/vista";

export const metadata = { title: "Cerdas paradas · Finanzas · KurPorc" };

export default async function CerdasParadasFinanzas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, permisos } = await paginaFinanzas("finanzas.cerdas_paradas.ver");
  const sp = await searchParams;
  const [r, detalle, ecografias] = await Promise.all([resumenParadas(org), sp.cerda ? detalleCerda(org, sp.cerda) : null, sinDiagnostico(org)]);
  return <VistaParadas r={r} conMontos base="/finanzas/cerdas-paradas" puedeTarea={puede(permisos, "tareas.tareas.crear")} detalle={detalle} ecografias={ecografias} />;
}
