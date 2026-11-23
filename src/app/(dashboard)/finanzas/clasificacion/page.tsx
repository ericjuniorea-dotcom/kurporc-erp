// Finanzas · Revisión de la clasificación (costeo por etapa, Fase 2): subcategoría, etapa o proyecto de cada gasto.
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { PanelClasificacion } from "./panel";

export const metadata = { title: "Revisión de la clasificación · Finanzas · KurPorc" };

export default async function ClasificacionPage() {
  await paginaFinanzas("finanzas.movimientos.ver");
  return <PanelClasificacion />;
}
