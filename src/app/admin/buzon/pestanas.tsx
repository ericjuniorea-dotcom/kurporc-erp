// Pestañas del buzón: bandeja y hoja de ruta publicada.
import Link from "next/link";

export function PestanasBuzon({ activa }: { activa: "bandeja" | "hoja" }) {
  const estilo = (on: boolean) => ({ padding: "6px 12px", fontSize: 13, textDecoration: "none", color: on ? "var(--text-primary)" : "var(--text-muted)", fontWeight: on ? 500 : 400, borderBottom: `2px solid ${on ? "var(--danger)" : "transparent"}` });
  return (
    <nav aria-label="Buzón" style={{ display: "flex", gap: 4, borderBottom: "0.5px solid var(--border-default)" }}>
      <Link href="/admin/buzon" aria-current={activa === "bandeja" ? "page" : undefined} style={estilo(activa === "bandeja")}>Bandeja</Link>
      <Link href="/admin/buzon/hoja-de-ruta" aria-current={activa === "hoja" ? "page" : undefined} style={estilo(activa === "hoja")}>Hoja de ruta</Link>
    </nav>
  );
}
