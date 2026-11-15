"use client";
// Pantalla de error común. Caso más frecuente: KurPorc se publicó de nuevo con la página abierta y el navegador
// usa una versión vieja (Next.js cambia los identificadores de las acciones en cada publicación).
// En ese caso recarga sola una vez; si vuelve a fallar, muestra el aviso con el botón.
import { useEffect } from "react";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

const CLAVE = "kp-recarga-por-version";
export const esErrorDeVersion = (e: unknown) =>
  /Server Action|server action|Failed to find|ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch/i.test(e instanceof Error ? `${e.name} ${e.message}` : String(e));

export function PantallaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[kurporc]", error);
    if (!esErrorDeVersion(error)) return;
    try {
      const ultima = Number(sessionStorage.getItem(CLAVE) ?? 0);
      if (Date.now() - ultima > 60_000) { sessionStorage.setItem(CLAVE, String(Date.now())); window.location.reload(); }
    } catch { /* sin almacenamiento: queda el botón */ }
  }, [error]);
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 440, background: "var(--bg-surface, #fff)", border: "0.5px solid var(--border-default, #ddd)", borderRadius: "var(--radius-lg, 12px)", padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 500, color: "var(--text-primary, #222)" }}>
          <IconAlertTriangle size={18} style={{ color: "var(--warning-text, #a60)" }} aria-hidden /> Algo no salió bien
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary, #555)", lineHeight: 1.55 }}>
          Puede que KurPorc se haya actualizado mientras tenías la página abierta. Recargá la página para seguir.
          Si vuelve a pasar, escribinos a soporte@kurporc.com contando qué estabas haciendo.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()} style={{ height: 34, gap: 6 }}>
            <IconRefresh size={14} aria-hidden /> Recargar la página
          </button>
          <button type="button" className="btn" onClick={() => reset()} style={{ height: 34 }}>Reintentar</button>
        </div>
        {error.digest && <div style={{ fontSize: 11, color: "var(--text-muted, #888)" }}>Código: {error.digest}</div>}
      </div>
    </div>
  );
}
