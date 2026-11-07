// Página pública de un documento legal: lo más importante arriba y el texto completo debajo.
import Link from "next/link";
import { notFound } from "next/navigation";
import { KurPorcLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { documentoVigente } from "@/lib/legal/documentos";
import { Markdown } from "./markdown";

function fecha(d: Date | null) {
  return d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Asuncion" }) : "—";
}

export async function PaginaDocumento({ codigo }: { codigo: string }) {
  const doc = await documentoVigente(codigo);
  if (!doc) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <Link href="/" aria-label="Inicio"><KurPorcLogo size="sm" /></Link>
        <ThemeToggle />
      </header>
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 48px" }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
          Versión {doc.version} · Vigente desde {fecha(doc.vigenteDesde)}
          {!doc.aprobadoPorAsesor && " · Versión preliminar en revisión legal"}
        </div>

        <section aria-label="Lo más importante" style={{
          background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)",
          padding: "14px 18px", marginBottom: 24,
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>Lo más importante</div>
          <Markdown texto={doc.resumen} />
        </section>

        <article>
          <Markdown texto={doc.contenido} />
        </article>

        <footer style={{ marginTop: 32, paddingTop: 14, borderTop: "0.5px solid var(--border-default)", fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/terminos">Términos y Condiciones</Link>
          <Link href="/privacidad">Política de Privacidad</Link>
          <span>Huella del texto: {doc.hashMostrado.slice(0, 16)}</span>
        </footer>
      </main>
    </div>
  );
}
