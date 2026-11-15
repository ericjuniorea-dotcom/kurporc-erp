// «Condiciones y políticas de KurPorc»: una sola página pública con todos los documentos.
// Índice a un costado y el documento elegido al lado. No está dentro de la app: se aceptan una vez al crear la cuenta.
import Link from "next/link";
import { notFound } from "next/navigation";
import { KurPorcLogo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { documentoVigente } from "@/lib/legal/documentos";
import { CORREO_INFO } from "@/lib/contacto";
import { Markdown } from "@/components/legal/markdown";

export const dynamic = "force-dynamic";
export const metadata = { title: "Condiciones y políticas · KurPorc", description: "Condiciones de uso y políticas de KurPorc" };

const DOCUMENTOS = [
  { slug: "terminos", codigo: "TERMINOS", titulo: "Condiciones de uso" },
  { slug: "privacidad", codigo: "PRIVACIDAD", titulo: "Política de privacidad" },
  { slug: "acuerdo-organizacion", codigo: "ACUERDO_ORGANIZACION", titulo: "Acuerdo para granjas y organizaciones" },
  { slug: "terminos-mercado", codigo: "TERMINOS_MERCADO", titulo: "Mercado KurPorc" },
  { slug: "terminos-vendedor", codigo: "TERMINOS_VENDEDOR", titulo: "Tiendas del Mercado" },
] as const;

export default async function Condiciones({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc } = await searchParams;
  const elegido = DOCUMENTOS.find(d => d.slug === doc) ?? DOCUMENTOS[0];
  const documento = await documentoVigente(elegido.codigo);
  if (!documento) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <Link href="/" aria-label="Inicio"><KurPorcLogo size="sm" /></Link>
        <ThemeToggle />
      </header>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 16px 56px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Condiciones y políticas de KurPorc</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: "6px 0 24px", maxWidth: 680 }}>
          Acá contamos, en palabras simples, cómo funciona KurPorc y cómo cuidamos tu información.
        </p>
        <div className="kp-condiciones" style={{ display: "grid", gridTemplateColumns: "minmax(0, 240px) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
          <nav aria-label="Documentos" className="kp-condiciones-indice" style={{ position: "sticky", top: 16, display: "flex", flexDirection: "column", gap: 2 }}>
            {DOCUMENTOS.map(d => {
              const on = d.slug === elegido.slug;
              return (
                <Link key={d.slug} href={`/condiciones?doc=${d.slug}`} aria-current={on ? "page" : undefined}
                  style={{ padding: "9px 12px", borderRadius: "var(--radius-md)", fontSize: 14, textDecoration: "none", whiteSpace: "nowrap",
                    color: on ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: on ? 500 : 400, background: on ? "var(--bg-surface)" : "transparent",
                    border: `0.5px solid ${on ? "var(--border-default)" : "transparent"}` }}>
                  {d.titulo}
                </Link>
              );
            })}
          </nav>
          <main style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: "22px 24px", minWidth: 0 }}>
            <h2 style={{ fontSize: 19, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 14px" }}>{elegido.titulo}</h2>
            <section aria-label="En pocas palabras" style={{ background: "var(--bg-base)", borderRadius: "var(--radius-md)", padding: "12px 16px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>En pocas palabras</div>
              <Markdown texto={documento.resumen} />
            </section>
            <article><Markdown texto={documento.contenido} /></article>
          </main>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 28 }}>
          ¿Tenés alguna consulta sobre estas condiciones o sobre tus datos? Escribinos a <a href={`mailto:${CORREO_INFO}`} style={{ color: "var(--accent-text, var(--accent))" }}>{CORREO_INFO}</a> y te ayudamos.
        </p>
      </div>
      <style>{`@media (max-width: 760px) {
        .kp-condiciones { grid-template-columns: minmax(0, 1fr) !important; gap: 14px !important; }
        .kp-condiciones-indice { position: static !important; flex-direction: row !important; overflow-x: auto; }
      }`}</style>
    </div>
  );
}
