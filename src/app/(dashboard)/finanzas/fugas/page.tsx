// Finanzas · Fugas (costeo por etapa, Fase 7).
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { PanelFugas } from "./panel";

export const metadata = { title: "Fugas · Finanzas · KurPorc" };

export default async function FugasPage() {
  await paginaFinanzas("finanzas.costos.ver");
  return <PanelFugas />;
}
