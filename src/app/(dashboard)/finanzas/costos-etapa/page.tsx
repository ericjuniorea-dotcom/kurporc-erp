// Finanzas · Costos por etapa (costeo por etapa, Fase 6).
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { PanelCostosEtapa } from "./panel";

export const metadata = { title: "Costos por etapa · Finanzas · KurPorc" };

export default async function CostosEtapaPage() {
  await paginaFinanzas("finanzas.costos.ver");
  return <PanelCostosEtapa />;
}
