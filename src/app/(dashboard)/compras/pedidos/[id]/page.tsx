// Detalle de un pedido del lado del comprador: historia, acciones, recepción y reseña.
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconBrandWhatsapp } from "@tabler/icons-react";
import prisma from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/config";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { COLOR_ESTADO, NOMBRE_ESTADO, type Estado } from "@/lib/pedidos/reglas";
import { HistoriaPedido, TablaItems } from "@/components/pedidos/vista";
import { AccionesPedido, FormRecepcion, FormResena, METODOS } from "../../componentes";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 };
const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";

export default async function PedidoComprador({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, permisos] = await Promise.all([getSession(), getPermisos()]);
  if (!session || !permisos || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await prisma.pedido.findUnique({
    where: { id },
    include: {
      items: true, eventos: { orderBy: { createdAt: "asc" } }, resena: true, comprador: { select: { name: true } },
      tienda: { include: { organizacion: { select: { farmName: true, slug: true, whatsapp: true } } } },
    },
  });
  if (!p || p.organizacionId !== permisos.organizacionId) notFound();
  const estado = p.estado as Estado;
  const recibible = ["CONFIRMADO", "EN_CAMINO", "ENTREGADO"].includes(estado) && puede(permisos, "compras.pedidos.recibir");
  const actores = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(p.eventos.map(e => e.actorId))) } }, select: { id: true, name: true } });

  let recepcion: React.ReactNode = null;
  if (recibible) {
    const catIds = p.items.map(i => i.productoCatalogoId).filter((x): x is string => !!x);
    const [productos, unidades, cuentas, aprendidos] = await Promise.all([
      prisma.productoInventario.findMany({ where: { tenantId: p.organizacionId, isActive: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, categoria: true, unidadMedida: true } }),
      prisma.unidadNegocio.findMany({ where: { organizacionId: p.organizacionId, activa: true }, orderBy: { codigo: "asc" }, select: { id: true, nombre: true, granjaId: true } }),
      prisma.cuentaFondos.findMany({ where: { organizacionId: p.organizacionId, activa: true }, select: { id: true, nombre: true } }),
      prisma.stockItemCatalogo.findMany({ where: { organizacionId: p.organizacionId, productoCatalogoId: { in: catIds } } }),
    ]);
    // La unidad de la granja de destino primero
    unidades.sort((a, b) => Number(b.granjaId === p.granjaDestinoId) - Number(a.granjaId === p.granjaDestinoId));
    recepcion = (
      <FormRecepcion pedidoId={p.id} metodoPago={p.metodoPago} puedePagar={puede(permisos, "finanzas.pagar.registrar_pago")}
        unidades={unidades} cuentas={cuentas}
        productos={productos.map(x => ({ id: x.id, nombre: x.nombre, categoria: x.categoria, unidad: x.unidadMedida }))}
        items={p.items.map(i => ({ id: i.id, descripcion: i.descripcion, cantidad: Number(i.cantidad), contenidoBase: Number(i.contenidoBase), unidadBase: i.unidadBase, sugerido: aprendidos.find(a => a.productoCatalogoId === i.productoCatalogoId)?.stockItemId ?? null }))} />
    );
  }
  const wa = p.tienda.organizacion.whatsapp?.replace(/\D/g, "");

  return (
    <>
      <div style={{ ...tarjeta, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{p.numero}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            <Link href={`/tienda/${p.tienda.organizacion.slug}`}>{p.tienda.organizacion.farmName}</Link> · pidió {p.comprador.name} el {fecha(p.createdAt)} · {METODOS.find(m => m[0] === p.metodoPago)?.[1]}{p.pagado ? " · pagado" : ""}
          </div>
          {p.direccion && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Entrega: {p.direccion}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLOR_ESTADO[estado] }}>{NOMBRE_ESTADO[estado]}</div>
          {!["RECIBIDO", "CANCELADO", "RECHAZADO"].includes(estado) && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Entrega estimada: {fecha(p.fechaEstimada)}</div>}
          {wa && <a href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hola, te escribo por el pedido ${p.numero} del Mercado KurPorc.`)}`} target="_blank" rel="noopener noreferrer" className="btn" style={{ height: 30, fontSize: 12, marginTop: 6 }}><IconBrandWhatsapp size={14} style={{ color: "#25D366" }} aria-hidden /> Escribir a la tienda</a>}
        </div>
      </div>
      <TablaItems items={p.items} subtotal={p.subtotalGs} envio={p.envioGs} total={p.totalGs} />
      <AccionesPedido id={p.id} estado={estado} puedeAprobar={puede(permisos, "compras.pedidos.aprobar") && (p.compradorId !== session.user.id || permisos.esPropietario)}
        puedeCancelar={puede(permisos, "compras.pedidos.cancelar")} puedeEnviar={puede(permisos, "compras.pedidos.crear")} />
      {recepcion}
      {estado === "RECIBIDO" && p.movimientoId && puede(permisos, "finanzas.movimientos.ver") && (
        <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>El gasto quedó en <Link href="/finanzas/movimientos">Finanzas → Movimientos</Link>{p.pagado ? "." : " y en Cuentas por pagar."}</div>
      )}
      {estado === "RECIBIDO" && !p.resena && <FormResena pedidoId={p.id} tienda={p.tienda.organizacion.farmName} />}
      {p.resena && (
        <div style={{ ...tarjeta, fontSize: 13 }}>
          Tu reseña: {"★".repeat(p.resena.calificacion)}{"☆".repeat(5 - p.resena.calificacion)} {p.resena.comentario && <span style={{ color: "var(--text-secondary)" }}>— {p.resena.comentario}</span>}
          {p.resena.respuesta && <div style={{ marginTop: 6, color: "var(--text-secondary)" }}>Respuesta de la tienda: {p.resena.respuesta}</div>}
        </div>
      )}
      <HistoriaPedido eventos={p.eventos} actores={actores} />
    </>
  );
}
