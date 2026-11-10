// "Pedir" desde una publicación del Mercado.
import Link from "next/link";
import { redirect } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/config";
import { getPermisos } from "@/lib/permisos/servidor";
import { terminosMercadoPendientes } from "@/lib/pedidos/servidor";
import { textoPrecioBase, type UnidadBase } from "@/lib/mercado/calculo";
import { FormPedidoDirecto } from "../../componentes";

export default async function NuevoPedido({ searchParams }: { searchParams: Promise<{ publicacion?: string }> }) {
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos) redirect("/login");
  const { publicacion: slug } = await searchParams;
  const p = slug ? await prisma.publicacion.findUnique({ where: { slug }, include: { tienda: { include: { organizacion: { select: { farmName: true } } } } } }) : null;
  if (!p || p.estado !== "ACTIVA") return <div style={{ fontSize: 13.5 }}>Esa publicación ya no está disponible. <Link href="/mercado">Volver al Mercado</Link></div>;
  if (!permisos.claves.has("compras.pedidos.crear")) return <div style={{ fontSize: 13.5 }}>No tenés permiso para hacer pedidos en esta organización. Pedíselo a quien administra el equipo.</div>;
  const [granjas, terminos] = await Promise.all([
    prisma.granja.findMany({ where: { organizacionId: permisos.organizacionId, activa: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    terminosMercadoPendientes(session.user.id),
  ]);
  const base = textoPrecioBase(p.precioGs, Number(p.contenidoBase), p.unidadBase as UnidadBase);
  return (
    <>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Pedido a <Link href={`/mercado/p/${p.slug}`}>{p.tienda.organizacion.farmName}</Link> · {session.user.farmName}</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "2px 0 0" }}>{p.titulo}</h1>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p.unidadVenta} · Gs {Number(p.precioGs).toLocaleString("es-PY")}{base ? ` (${base})` : ""} · mínimo {p.pedidoMinimo} · entrega en {p.plazoEntregaDias} días</div>
      </div>
      <FormPedidoDirecto granjas={granjas} terminosPendientes={!!terminos} publicacion={{
        id: p.id, titulo: p.titulo, unidadVenta: p.unidadVenta, precioGs: Number(p.precioGs), pedidoMinimo: p.pedidoMinimo, stock: p.stockDisponible,
        contenidoBase: Number(p.contenidoBase), unidadBase: p.unidadBase,
      }} />
    </>
  );
}
