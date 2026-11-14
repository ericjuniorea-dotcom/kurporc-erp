// Fase 15.2: la bandeja ahora es /admin/buzon. La ruta vieja redirige conservando los filtros.
import { redirect } from "next/navigation";

export default async function SugerenciasViejo({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  redirect(`/admin/buzon${q ? `?${q}` : ""}`);
}
