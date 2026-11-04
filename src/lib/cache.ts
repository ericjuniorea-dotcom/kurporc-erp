/**
 * Cache en memoria con TTL corto — para agregaciones que se piden varias
 * veces por navegación (ej. el forecast de stock lo llaman Sanidad, Balanceado
 * y Logística por separado) y no necesitan ser exactas al milisegundo. Cada
 * consulta a Supabase paga ~200ms de latencia de red fija; un TTL de unos
 * segundos evita repetir ese costo sin arriesgar datos viejos de verdad.
 *
 * Vive en memoria del proceso — se resetea solo al reiniciar el server, y no
 * se comparte entre instancias si algún día se corre con más de un proceso.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/** Invalida todas las entradas cuya key empieza con `prefix` (ej. por tenant). */
export function invalidate(prefix: string) {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Se llama después de cualquier escritura sobre ProductoInventario/LoteInventario/MovimientoInventario. */
export function invalidateInventario(tenantId: string) {
  invalidate(`stock:${tenantId}`);
  invalidate(`vacunas:${tenantId}`);
  invalidate(`stockAlertas:${tenantId}`);
}
