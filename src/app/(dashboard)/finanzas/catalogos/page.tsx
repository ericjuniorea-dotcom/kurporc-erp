// Finanzas · Catálogos de costos (costeo por etapa, Fase 1): etapas, categorías y subcategorías, ítems y proyectos.
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { PanelCatalogos } from "./panel";

export const metadata = { title: "Catálogos de costos · Finanzas · KurPorc" };

export default async function CatalogosPage() {
  await paginaFinanzas("finanzas.movimientos.ver");
  return <PanelCatalogos />;
}
