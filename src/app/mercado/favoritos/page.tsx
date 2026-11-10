// Publicaciones guardadas por la persona (Fase 12).
import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";
import { MarcoMercado, TarjetaPublicacion, tarjetaEstilo } from "@/components/mercado/marco";
import { buscarPublicaciones } from "@/lib/mercado/consultas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis favoritos · Mercado KurPorc" };

export default async function Favoritos() {
  const u = await getUsuario();
  if (!u) redirect("/login?next=/mercado/favoritos");
  const favs = await prisma.favorito.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 200, select: { publicacionId: true } });
  const ids = favs.map(f => f.publicacionId);
  const { tarjetas } = ids.length ? await buscarPublicaciones({ ids, orden: "nuevos" }) : { tarjetas: [] };
  const orden = new Map(ids.map((id, i) => [id, i]));
  tarjetas.sort((a, b) => (orden.get(a.id) ?? 0) - (orden.get(b.id) ?? 0));
  return (
    <MarcoMercado>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>Mis favoritos</h1>
      {tarjetas.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>{tarjetas.map(t => <TarjetaPublicacion key={t.id} t={t} />)}</div>}
      {ids.length === 0 && <div style={{ ...tarjetaEstilo, padding: 24, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>Todavía no guardaste publicaciones. Tocá «Guardar» en cualquier publicación del <Link href="/mercado">Mercado</Link>.</div>}
      {ids.length > tarjetas.length && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ids.length - tarjetas.length} de tus favoritos ya no están disponibles.</div>}
    </MarcoMercado>
  );
}
