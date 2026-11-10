// Inicio del panel de vendedor (Fase 12).
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { contextoTienda } from "@/lib/mercado/vendedor";
import { tarjetaEstilo } from "@/components/mercado/marco";

function Dato({ t, v, sub }: { t: string; v: React.ReactNode; sub?: string }) {
  return (
    <div style={{ ...tarjetaEstilo, padding: 14 }}>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

export default async function InicioVendedor() {
  const t = (await contextoTienda())!;
  const [porEstado, tienda, favoritos] = await Promise.all([
    prisma.publicacion.groupBy({ by: ["estado"], where: { tiendaId: t.org.id }, _count: { _all: true } }),
    prisma.tienda.findUnique({ where: { organizacionId: t.org.id } }),
    prisma.favorito.count({ where: { publicacionId: { in: (await prisma.publicacion.findMany({ where: { tiendaId: t.org.id }, select: { id: true } })).map(p => p.id) } } }),
  ]);
  const [pedidosNuevos, enCurso, sinResponder] = await Promise.all([
    prisma.pedido.count({ where: { tiendaId: t.org.id, estado: "ENVIADO" } }),
    prisma.pedido.count({ where: { tiendaId: t.org.id, estado: { in: ["CONFIRMADO", "EN_CAMINO"] } } }),
    prisma.solicitudCotizacionTienda.count({ where: { tiendaId: t.org.id, solicitud: { estado: "ABIERTA", venceEn: { gt: new Date() }, respuestas: { none: { tiendaId: t.org.id } } } } }),
  ]);
  const n = (e: string) => porEstado.find(x => x.estado === e)?._count._all ?? 0;
  const total = porEstado.reduce((s, x) => s + x._count._all, 0);
  const faltaPerfil = !tienda?.descripcion || !t.org.whatsapp;
  return (
    <>
      {(pedidosNuevos > 0 || sinResponder > 0) && (
        <div style={{ padding: "10px 14px", fontSize: 13, borderRadius: "var(--radius-md)", background: "var(--accent-subtle, var(--bg-subtle))", display: "flex", gap: 14, flexWrap: "wrap" }}>
          {pedidosNuevos > 0 && <Link href="/vendedor/pedidos" style={{ fontWeight: 600 }}>{pedidosNuevos} pedido{pedidosNuevos > 1 ? "s" : ""} nuevo{pedidosNuevos > 1 ? "s" : ""} para confirmar →</Link>}
          {sinResponder > 0 && <Link href="/vendedor/cotizaciones" style={{ fontWeight: 600 }}>{sinResponder} cotizaci{sinResponder > 1 ? "ones" : "ón"} sin responder →</Link>}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <Dato t="Pedidos en curso" v={pedidosNuevos + enCurso} sub={pedidosNuevos ? `${pedidosNuevos} sin confirmar` : undefined} />
        <Dato t="Publicaciones activas" v={n("ACTIVA")} sub={`${total} en total`} />
        <Dato t="En borrador" v={n("BORRADOR")} sub={n("PAUSADA") ? `${n("PAUSADA")} pausadas` : undefined} />
        <Dato t="Guardadas como favorito" v={favoritos} />
        <Dato t="Calificación" v={tienda && tienda.totalResenas > 0 ? `★ ${Number(tienda.calificacion).toFixed(1)}` : "—"} sub={tienda?.totalResenas ? `${tienda.totalResenas} reseñas` : "Todavía sin reseñas"} />
      </div>
      <div style={{ ...tarjetaEstilo, padding: 16, display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Primeros pasos</div>
        <div>{faltaPerfil ? "1. Completá tu tienda: descripción, zonas de entrega y WhatsApp." : "✓ Tu tienda tiene descripción y WhatsApp."} <Link href="/vendedor/tienda">Mi tienda →</Link></div>
        <div>{total === 0 ? "2. Cargá tu primer producto. Elegilo del catálogo para que los productores lo encuentren al comparar." : `✓ Tenés ${total} producto${total === 1 ? "" : "s"} cargado${total === 1 ? "" : "s"}.`} <Link href="/vendedor/productos/nuevo">Nuevo producto →</Link></div>
        <div>3. Cuando un productor de tu zona pide cotización de algo que publicás, te llega un aviso: respondé rápido, pesa en el orden de las tiendas.</div>
      </div>
      {n("RECHAZADA") > 0 && (
        <div style={{ padding: "10px 14px", fontSize: 13, borderRadius: "var(--radius-md)", background: "var(--danger-subtle)", color: "var(--danger-text)" }}>
          Moderación rechazó {n("RECHAZADA")} publicación{n("RECHAZADA") > 1 ? "es" : ""}. Mirá el motivo en <Link href="/vendedor/productos" style={{ color: "inherit", fontWeight: 600 }}>Productos</Link>.
        </div>
      )}
    </>
  );
}
