// Pedidos recibidos por la tienda (Fase 13).
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { contextoTienda } from "@/lib/mercado/vendedor";
import { COLOR_ESTADO, NOMBRE_ESTADO, type Estado } from "@/lib/pedidos/reglas";
import { tarjetaEstilo, gsTexto } from "@/components/mercado/marco";

const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";
const ABIERTOS = ["ENVIADO", "CONFIRMADO", "EN_CAMINO", "ENTREGADO"] as const;

export default async function PedidosTienda({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const t = (await contextoTienda())!;
  if (!t.puede("tienda.pedidos.ver")) return <div style={{ fontSize: 13.5 }}>No tenés permiso para ver los pedidos de la tienda.</div>;
  const { todos } = await searchParams;
  // La tienda no ve borradores ni pedidos que esperan la aprobación interna del comprador
  const pedidos = await prisma.pedido.findMany({
    where: { tiendaId: t.org.id, estado: todos ? { notIn: ["BORRADOR", "PENDIENTE_APROBACION"] } : { in: [...ABIERTOS] } },
    orderBy: { createdAt: "desc" }, take: 200,
    include: { organizacion: { select: { farmName: true, departamento: true } }, _count: { select: { items: true } } },
  });
  return (
    <>
      <div style={{ display: "flex", gap: 8, fontSize: 12.5 }}>
        <Link href="/vendedor/pedidos" style={{ fontWeight: todos ? 400 : 600 }}>En curso</Link>·<Link href="/vendedor/pedidos?todos=1" style={{ fontWeight: todos ? 600 : 400 }}>Todos</Link>
      </div>
      <div style={{ ...tarjetaEstilo, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 760 }}>
          <thead><tr><th>Pedido</th><th>Fecha</th><th>Cliente</th><th style={{ textAlign: "right" }}>Total</th><th>Estado</th><th>Entrega estimada</th></tr></thead>
          <tbody>
            {pedidos.map(p => (
              <tr key={p.id}>
                <td><Link href={`/vendedor/pedidos/${p.id}`} style={{ fontWeight: 500 }}>{p.numero}</Link><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p._count.items} producto{p._count.items > 1 ? "s" : ""}</div></td>
                <td>{fecha(p.createdAt)}</td>
                <td>{p.organizacion.farmName}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.organizacion.departamento ?? ""}</div></td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gsTexto(p.totalGs)}</td>
                <td style={{ color: COLOR_ESTADO[p.estado as Estado], fontWeight: 500 }}>{p.estado === "ENVIADO" ? "Nuevo: confirmá o rechazá" : NOMBRE_ESTADO[p.estado as Estado]}</td>
                <td>{fecha(p.fechaEstimada)}</td>
              </tr>
            ))}
            {pedidos.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>{todos ? "Todavía no recibiste pedidos." : "No hay pedidos en curso."}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
