"use client";
// Pantalla de error del ERP: en vez de la página en blanco («Application error»), un aviso con salida.
// Lo más común: KurPorc se actualizó con la página abierta. Recargar lo resuelve.
import { useEffect } from "react";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

export default function ErrorERP({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[erp]", error); }, [error]);
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 440, background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>
          <IconAlertTriangle size={18} style={{ color: "var(--warning-text)" }} aria-hidden /> Algo no salió bien
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>
          Puede que KurPorc se haya actualizado mientras tenías la página abierta. Recargá la página para seguir.
          Si vuelve a pasar, contanos qué estabas haciendo en «Ayuda y sugerencias».
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()} style={{ height: 34, gap: 6 }}>
            <IconRefresh size={14} aria-hidden /> Recargar la página
          </button>
          <button type="button" className="btn" onClick={() => reset()} style={{ height: 34 }}>Reintentar</button>
        </div>
        {error.digest && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Código: {error.digest}</div>}
      </div>
    </div>
  );
}
