// Responder un pedido de cotización (Fase 13.2.3).
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { contextoTienda } from "@/lib/mercado/vendedor";
import type { ItemRespuesta } from "@/lib/pedidos/reglas";
import { FormRespuesta } from "./formulario";

const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";

export default async function ResponderCotizacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = (await contextoTienda())!;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const invitada = await prisma.solicitudCotizacionTienda.findUnique({ where: { solicitudId_tiendaId: { solicitudId: id, tiendaId: t.org.id } } });
  if (!invitada) notFound();
  if (!invitada.vistaEn) await prisma.solicitudCotizacionTienda.update({ where: { solicitudId_tiendaId: { solicitudId: id, tiendaId: t.org.id } }, data: { vistaEn: new Date() } });
  const s = await prisma.solicitudCotizacion.findUniqueOrThrow({
    where: { id },
    include: { organizacion: { select: { farmName: true } }, items: { include: { producto: { select: { id: true, nombre: true, unidadBase: true } } } }, respuestas: { where: { tiendaId: t.org.id }, include: { pedidos: { select: { numero: true } } } } },
  });
  const pubs = await prisma.publicacion.findMany({
    where: { tiendaId: t.org.id, estado: { in: ["ACTIVA", "PAUSADA"] }, productoCatalogoId: { in: s.items.map(i => i.productoCatalogoId) } },
    select: { id: true, titulo: true, productoCatalogoId: true, precioGs: true, unidadVenta: true, contenidoBase: true, pedidoMinimo: true, plazoEntregaDias: true },
  });
  const tienda = await prisma.tienda.findUnique({ where: { organizacionId: t.org.id }, select: { zonasEntrega: true } });
  const r = s.respuestas[0];
  const abierta = s.estado === "ABIERTA" && s.venceEn.getTime() > Date.now() && !r?.pedidos.length;
  return (
    <>
      <Link href="/vendedor/cotizaciones" style={{ fontSize: 12, color: "var(--text-muted)" }}>← Cotizaciones</Link>
      <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{s.organizacion.farmName} pide cotización</div>
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Entrega en {s.departamento}{s.fechaRequerida ? ` · lo necesita para el ${fecha(s.fechaRequerida)}` : ""} · respondé antes del {fecha(s.venceEn)}</div>
        {s.nota && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nota: {s.nota}</div>}
        {tienda && !tienda.zonasEntrega.includes(s.departamento) && <div style={{ fontSize: 12, color: "var(--warning-text)" }}>Ojo: {s.departamento} no está entre las zonas de entrega de tu tienda.</div>}
      </div>
      {r?.pedidos.length ? <div style={{ fontSize: 13.5, color: "var(--success-text)" }}>El cliente aceptó tu cotización: pedido {r.pedidos[0].numero}. Lo ves en <Link href="/vendedor/pedidos">Pedidos</Link>.</div> : null}
      {!abierta && !r?.pedidos.length && <div style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Esta solicitud ya está cerrada.</div>}
      {(abierta || r) && (
        <FormRespuesta solicitudId={s.id} abierta={abierta && t.puede("tienda.cotizaciones.responder")}
          items={s.items.map(i => ({ id: i.id, nombre: i.producto.nombre, unidadBase: i.producto.unidadBase, cantidadBase: Number(i.cantidadBase), nota: i.nota, productoId: i.productoCatalogoId }))}
          publicaciones={pubs.map(p => ({ id: p.id, titulo: p.titulo, productoId: p.productoCatalogoId!, precioGs: Number(p.precioGs), unidadVenta: p.unidadVenta, contenidoBase: Number(p.contenidoBase), pedidoMinimo: p.pedidoMinimo, plazo: p.plazoEntregaDias }))}
          previa={r ? { items: r.items as unknown as ItemRespuesta[], costoEnvioGs: Number(r.costoEnvioGs), plazoDias: r.plazoDias, validaHasta: r.validaHasta.toISOString().slice(0, 10), nota: r.nota ?? "" } : null} />
      )}
    </>
  );
}
