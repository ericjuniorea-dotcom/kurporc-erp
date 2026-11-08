// Fase 7 (parte 2): los montos solo los ve quien tiene `finanzas.costos.ver`.
// Se ocultan en el servidor (la respuesta no los trae), no solo en la pantalla.
import { NextResponse } from "next/server";
import { getPermisos, puede } from "./servidor";

export const PERMISO_MONTOS = "finanzas.costos.ver";

/** Claves de respuesta que llevan plata. */
const CLAVE_MONTO = /^(purchasePriceGs|pricePerDoseGs|pricePerKg|costoUnitario\w*|costos?|valor(Invertido|Total\w*|Stock\w*)?|precio\w*|monto\w*|importe\w*|\w+Gs|\w+Usd)$/;

/** Copia `data` con los montos en null. */
export function quitarMontos<T>(data: T): T {
  if (Array.isArray(data)) return data.map(quitarMontos) as T;
  if (data && typeof data === "object" && !(data instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (CLAVE_MONTO.test(k)) { out[k] = null; continue; }
      // Decimal de Prisma: se serializa solo; no hay que recorrerlo
      out[k] = v && typeof v === "object" && typeof (v as { toFixed?: unknown }).toFixed === "function" ? v : quitarMontos(v);
    }
    return out as T;
  }
  return data;
}

/** Igual que NextResponse.json, pero sin montos si la persona no tiene permiso de costos. */
export async function jsonConMontos(data: unknown, init?: ResponseInit) {
  const ve = puede(await getPermisos(), PERMISO_MONTOS);
  return NextResponse.json(ve ? data : quitarMontos(data), init);
}
