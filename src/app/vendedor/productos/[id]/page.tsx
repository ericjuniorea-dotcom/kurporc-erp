import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { contextoTienda } from "@/lib/mercado/vendedor";
import type { UnidadBase } from "@/lib/mercado/calculo";
import { datosFormulario } from "../datos";
import { FormularioPublicacion } from "../formulario";

export default async function EditarProducto({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = (await contextoTienda())!;
  const p = /^[0-9a-f-]{36}$/i.test(id) ? await prisma.publicacion.findUnique({ where: { id } }) : null;
  if (!p || p.tiendaId !== t.org.id) notFound();
  const { categorias, productos } = await datosFormulario(t.org.id);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
        <Link href="/vendedor/productos" style={{ color: "var(--text-muted)" }}>← Productos</Link>
        <Link href={`/mercado/p/${p.slug}`}>Ver cómo se ve →</Link>
      </div>
      {p.estado === "RECHAZADA" && (
        <div style={{ padding: "10px 14px", fontSize: 13, borderRadius: "var(--radius-md)", background: "var(--danger-subtle)", color: "var(--danger-text)" }}>
          Moderación rechazó esta publicación{p.motivoRechazo ? `: ${p.motivoRechazo}` : ""}. Corregila y escribinos a soporte@kurporc.com para que la revisemos.
        </div>
      )}
      <FormularioPublicacion categorias={categorias} productos={productos} verificada={t.org.verificacion === "VERIFICADA"} inicial={{
        id: p.id, productoCatalogoId: p.productoCatalogoId, categoriaId: p.categoriaId, titulo: p.titulo, descripcion: p.descripcion ?? "", marca: p.marca ?? "",
        precioGs: p.precioGs.toString(), unidadVenta: p.unidadVenta, unidadBase: p.unidadBase as UnidadBase, contenidoBase: p.contenidoBase.toString(),
        pedidoMinimo: String(p.pedidoMinimo), stockDisponible: p.stockDisponible?.toString() ?? "", plazoEntregaDias: String(p.plazoEntregaDias),
        zonasEntrega: p.zonasEntrega, fotos: p.fotos, declaracionSanitaria: p.declaracionSanitaria, estado: p.estado,
      }} />
    </>
  );
}
