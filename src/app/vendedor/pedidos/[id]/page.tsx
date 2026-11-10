// Detalle de un pedido del lado de la tienda: confirmar con fecha, rechazar, despachar, entregado, reseña.
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBrandWhatsapp } from "@tabler/icons-react";
import prisma from "@/lib/db/prisma";
import { contextoTienda } from "@/lib/mercado/vendedor";
import { COLOR_ESTADO, NOMBRE_ESTADO, type Estado } from "@/lib/pedidos/reglas";
import { HistoriaPedido, TablaItems } from "@/components/pedidos/vista";
import { AccionesTienda, ResponderResena } from "./acciones";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 };
const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";
const METODO: Record<string, string> = { TRANSFERENCIA: "Transferencia", EFECTIVO: "Efectivo", CONTRA_ENTREGA: "Pago contra entrega", CREDITO_VENDEDOR: "Crédito de la tienda" };

export default async function PedidoTienda({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = (await contextoTienda())!;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !t.puede("tienda.pedidos.ver")) notFound();
  const p = await prisma.pedido.findUnique({
    where: { id },
    include: { items: true, eventos: { orderBy: { createdAt: "asc" } }, resena: true, organizacion: { select: { farmName: true, departamento: true, whatsapp: true } }, comprador: { select: { name: true } } },
  });
  if (!p || p.tiendaId !== t.org.id || ["BORRADOR", "PENDIENTE_APROBACION"].includes(p.estado)) notFound();
  const estado = p.estado as Estado;
  const actores = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(p.eventos.map(e => e.actorId))) } }, select: { id: true, name: true } });
  const wa = p.organizacion.whatsapp?.replace(/\D/g, "");
  return (
    <>
      <Link href="/vendedor/pedidos" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Pedidos</Link>
      <div style={{ ...tarjeta, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{p.numero}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>{p.organizacion.farmName} ({p.organizacion.departamento ?? "—"}) · {p.comprador.name} · {fecha(p.createdAt)} · {METODO[p.metodoPago]}</div>
          {p.direccion && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Entregar en: {p.direccion}</div>}
          {p.notas && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nota del cliente: {p.notas}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLOR_ESTADO[estado] }}>{NOMBRE_ESTADO[estado]}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Entrega estimada: {fecha(p.fechaEstimada)}</div>
          {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, te escribo de ${t.org.farmName} por el pedido ${p.numero} del Mercado KurPorc.`)}`} target="_blank" rel="noopener noreferrer" className="btn" style={{ height: 30, fontSize: 12, marginTop: 6 }}><IconBrandWhatsapp size={14} style={{ color: "#25D366" }} aria-hidden /> Escribir al cliente</a>}
        </div>
      </div>
      <TablaItems items={p.items} subtotal={p.subtotalGs} envio={p.envioGs} total={p.totalGs} />
      <AccionesTienda id={p.id} estado={estado} fechaEstimada={p.fechaEstimada?.toISOString().slice(0, 10) ?? ""}
        puede={{ confirmar: t.puede("tienda.pedidos.confirmar"), rechazar: t.puede("tienda.pedidos.rechazar"), despachar: t.puede("tienda.pedidos.despachar") }} />
      {p.resena && (
        <div style={{ ...tarjeta, fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
          <div>Reseña del cliente: {"★".repeat(p.resena.calificacion)}{"☆".repeat(5 - p.resena.calificacion)} {p.resena.comentario && <span style={{ color: "var(--text-secondary)" }}>— {p.resena.comentario}</span>}</div>
          {p.resena.respuesta ? <div style={{ color: "var(--text-secondary)" }}>Tu respuesta: {p.resena.respuesta}</div>
            : t.puede("tienda.resenas.responder") && <ResponderResena id={p.resena.id} />}
        </div>
      )}
      <HistoriaPedido eventos={p.eventos} actores={actores} />
    </>
  );
}
