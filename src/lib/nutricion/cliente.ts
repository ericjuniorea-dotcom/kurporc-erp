// Lecturas de Nutrición desde el navegador (GET a /api/nutricion/…), con un reintento y mensaje en castellano.
import type { consumoPeriodo, nutricionDia, planAlimentacion } from "@/app/acciones/nutricion";

async function leer<T>(url: string): Promise<T> {
  let ultimo: unknown;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      const j = await r.json().catch(() => null) as (T & { error?: string }) | null;
      if (r.ok && j) return j;
      if (r.status === 401) { window.location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`; throw new Error("Tu sesión se cerró. Ingresá de nuevo."); }
      throw new Error(j?.error ?? "No se pudo cargar. Probá de nuevo.");
    } catch (e) { ultimo = e; if (i === 0) await new Promise(res => setTimeout(res, 700)); }
  }
  throw ultimo instanceof Error ? ultimo : new Error("No se pudo cargar. Probá de nuevo.");
}

export const leerDia = (fecha: string) => leer<Awaited<ReturnType<typeof nutricionDia>>>(`/api/nutricion/dia?fecha=${fecha}`);
export const leerConsumo = (d: { desde: string; hasta: string; agrupar: string }) => leer<Awaited<ReturnType<typeof consumoPeriodo>>>(`/api/nutricion/consumo?${new URLSearchParams(d)}`);
export const leerPlan = () => leer<Awaited<ReturnType<typeof planAlimentacion>>>("/api/nutricion/plan");
