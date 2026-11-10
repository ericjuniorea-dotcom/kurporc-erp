// Aviso del tablero (Fase 14.5): "3 productos se terminan esta semana", de la última foto del motor de necesidades.
import Link from "next/link";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { seTerminanEstaSemana } from "@/lib/necesidades/datos";

export default async function LayoutTablero({ children }: { children: React.ReactNode }) {
  const permisos = await getPermisos();
  const lista = permisos && puede(permisos, "compras.necesidades.ver") ? await seTerminanEstaSemana(permisos.organizacionId).catch(() => []) : [];
  const criticas = lista.filter(x => x.urgencia === "CRITICA").length;
  return (
    <>
      {lista.length > 0 && (
        <Link href="/compras/necesidades" role="status"
          style={{ display: "block", padding: "8px 20px", fontSize: 12.5, textDecoration: "none", borderBottom: "0.5px solid var(--border-default)",
            background: criticas ? "var(--danger-subtle)" : "var(--warning-subtle)", color: criticas ? "var(--danger-text)" : "var(--warning-text)" }}>
          <strong>{lista.length} producto{lista.length > 1 ? "s" : ""} se termina{lista.length > 1 ? "n" : ""} esta semana</strong>
          {criticas ? ` · ${criticas} ya no llega${criticas > 1 ? "n" : ""} a tiempo si no pedís hoy` : ""} · Ver «Lo que te va a faltar» →
        </Link>
      )}
      {children}
    </>
  );
}
