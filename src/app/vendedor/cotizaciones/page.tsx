// Pedidos de cotización que recibió la tienda (Fase 13).
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { contextoTienda } from "@/lib/mercado/vendedor";
import { tarjetaEstilo } from "@/components/mercado/marco";

const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";

export default async function CotizacionesTienda() {
  const t = (await contextoTienda())!;
  const filas = await prisma.solicitudCotizacionTienda.findMany({
    where: { tiendaId: t.org.id }, orderBy: { solicitud: { createdAt: "desc" } }, take: 200,
    include: { solicitud: { include: { organizacion: { select: { farmName: true } }, items: { include: { producto: { select: { nombre: true } } } }, respuestas: { where: { tiendaId: t.org.id }, include: { pedidos: { select: { id: true } } } } } } },
  });
  return (
    <div style={{ ...tarjetaEstilo, overflowX: "auto" }}>
      <table className="kp-table" style={{ minWidth: 760 }}>
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Productos</th><th>Entrega en</th><th>Estado</th></tr></thead>
        <tbody>
          {filas.map(({ solicitud: s }) => {
            const r = s.respuestas[0];
            const abierta = s.estado === "ABIERTA" && s.venceEn.getTime() > Date.now();
            const estado = r?.pedidos.length ? "Ganaste el pedido" : r ? (abierta ? "Respondida" : "Cerrada") : abierta ? "Sin responder" : "Cerrada sin responder";
            return (
              <tr key={s.id}>
                <td><Link href={`/vendedor/cotizaciones/${s.id}`}>{fecha(s.createdAt)}</Link></td>
                <td>{s.organizacion.farmName}</td>
                <td style={{ fontSize: 12.5 }}>{s.items.map(i => i.producto.nombre).join(", ")}</td>
                <td>{s.departamento}</td>
                <td style={{ fontWeight: estado === "Sin responder" ? 600 : 400, color: estado === "Sin responder" ? "var(--warning-text)" : estado === "Ganaste el pedido" ? "var(--success-text)" : undefined }}>{estado}</td>
              </tr>
            );
          })}
          {filas.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Todavía no recibiste pedidos de cotización. Llegan cuando un productor de tu zona pide algo que vos publicás.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
