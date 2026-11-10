// Perfil público de una tienda y sus publicaciones (Fase 12).
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MarcoMercado, TarjetaPublicacion, Verificado, tarjetaEstilo } from "@/components/mercado/marco";
import { buscarPublicaciones, tiendaPorSlug } from "@/lib/mercado/consultas";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = await tiendaPorSlug(slug);
  return { title: t ? `${t.org.farmName} · Mercado KurPorc` : "Tienda no disponible · Mercado KurPorc", description: t?.tienda.descripcion?.slice(0, 160) };
}

export default async function TiendaPublica({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await tiendaPorSlug(slug);
  if (!t) notFound();
  const { tarjetas, total } = await buscarPublicaciones({ tienda: slug, orden: "nuevos" });
  const desde = t.org.createdAt.toLocaleDateString("es-PY", { month: "long", year: "numeric" });
  return (
    <MarcoMercado>
      <section style={{ ...tarjetaEstilo, padding: 18, display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        {t.org.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.org.logoUrl} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover" }} />
        )}
        <div style={{ flex: 1, minWidth: 240, display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: "var(--text-primary)" }}>{t.org.farmName} {t.org.verificacion === "VERIFICADA" && <Verificado size={18} />}</h1>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {t.org.departamento ?? "Paraguay"}{t.org.distrito ? `, ${t.org.distrito}` : ""} · en KurPorc desde {desde}
            {t.tienda.totalResenas > 0 ? ` · ★ ${Number(t.tienda.calificacion).toFixed(1)} (${t.tienda.totalResenas} reseñas)` : " · todavía sin reseñas"}
          </div>
          {t.tienda.descripcion && <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{t.tienda.descripcion}</p>}
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            {t.tienda.zonasEntrega.length > 0 && <>Entrega en {t.tienda.zonasEntrega.join(", ")}. </>}
            {t.tienda.horario && <>Horario: {t.tienda.horario}.</>}
          </div>
        </div>
      </section>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{total} publicacion{total === 1 ? "" : "es"} activa{total === 1 ? "" : "s"}</div>
      {tarjetas.length > 0
        ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>{tarjetas.map(x => <TarjetaPublicacion key={x.id} t={x} />)}</div>
        : <div style={{ ...tarjetaEstilo, padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Esta tienda todavía no tiene publicaciones activas.</div>}
    </MarcoMercado>
  );
}
