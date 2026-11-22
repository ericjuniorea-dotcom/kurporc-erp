// Cuando se publica una versión nueva, una pantalla que quedó abierta en el celular puede seguir con la versión
// anterior y sus pedidos al servidor fallan ("Server Action not found"). Esto lo detecta y recarga la página
// (una vez por minuto como mucho, para no quedar en un bucle).
export function esVersionVieja(e: unknown): boolean {
  const m = e instanceof Error ? `${e.name} ${e.message}` : String(e ?? "");
  return /server action|failed to find|not found on the server|unexpected response|failed to fetch|load failed|networkerror|chunkloaderror|loading chunk/i.test(m);
}

export function recargarSiVersionVieja(e: unknown): boolean {
  if (typeof window === "undefined" || !esVersionVieja(e)) return false;
  try {
    const ult = Number(sessionStorage.getItem("kp_recarga_version") ?? 0);
    if (Date.now() - ult < 60_000) return false;
    sessionStorage.setItem("kp_recarga_version", String(Date.now()));
  } catch { /* sin almacenamiento: igual recargamos una vez */ }
  window.location.reload();
  return true;
}

/**
 * Mensaje en castellano para un error al llamar al servidor desde una pantalla.
 * · Desvío (sesión cerrada): Next.js ya está llevando a la persona a ingresar → sin mensaje.
 * · Versión vieja: al cargar datos recarga sola; al guardar avisa (para no perder lo escrito).
 * · Cualquier otro: el mensaje por defecto (nunca el texto técnico en inglés).
 */
export function mensajeError(e: unknown, porDefecto: string, { recargar = false } = {}): string {
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (m === "NEXT_REDIRECT" || (e as { digest?: string })?.digest?.startsWith?.("NEXT_REDIRECT")) return "";
  if (esVersionVieja(e)) {
    if (recargar && recargarSiVersionVieja(e)) return "Actualizando la pantalla…";
    return "La pantalla quedó desactualizada o se cortó la conexión. Tocá «Recargar» (o deslizá hacia abajo) y probá de nuevo.";
  }
  return porDefecto;
}
