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
