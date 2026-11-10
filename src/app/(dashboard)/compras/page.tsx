// Listado de pedidos, cotizaciones y pedidos por aprobar.
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { COLOR_ESTADO, NOMBRE_ESTADO, type Estado } from "@/lib/pedidos/reglas";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";
const gs = (v: bigint | number) => `Gs ${Number(v).toLocaleString("es-PY")}`;

export default async function Compras({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const permisos = (await getPermisos())!;
  const org = permisos.organizacionId;
  const { vista } = await searchParams;

  if (vista === "cotizaciones") {
    const sols = await prisma.solicitudCotizacion.findMany({
      where: { organizacionId: org }, orderBy: { createdAt: "desc" }, take: 100,
      include: { items: { include: { producto: { select: { nombre: true } } } }, _count: { select: { tiendas: true, respuestas: true } } },
    });
    return (
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 760 }}>
          <thead><tr><th>Fecha</th><th>Productos</th><th>Entrega en</th><th style={{ textAlign: "right" }}>Respuestas</th><th>Estado</th></tr></thead>
          <tbody>
            {sols.map(s => {
              const vencida = s.estado === "ABIERTA" && s.venceEn.getTime() < Date.now();
              return (
                <tr key={s.id}>
                  <td><Link href={`/compras/cotizaciones/${s.id}`}>{fecha(s.createdAt)}</Link></td>
                  <td style={{ fontSize: 12.5 }}>{s.items.map(i => i.producto.nombre).join(", ")}</td>
                  <td>{s.departamento}</td>
                  <td style={{ textAlign: "right" }}>{s._count.respuestas} de {s._count.tiendas}</td>
                  <td>{vencida ? "Vencida" : s.estado === "ABIERTA" ? "Abierta" : s.estado === "CERRADA" ? "Pedido hecho" : "Cancelada"}</td>
                </tr>
              );
            })}
            {sols.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              Todavía no pediste cotizaciones. {puede(permisos, "compras.cotizaciones.crear") && <Link href="/compras/cotizaciones/nueva">Pedí la primera</Link>} y compará precios de hasta 10 tiendas.
            </td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  const soloAprobar = vista === "aprobar";
  const pedidos = await prisma.pedido.findMany({
    where: { organizacionId: org, ...(soloAprobar ? { estado: "PENDIENTE_APROBACION" } : {}) }, orderBy: { createdAt: "desc" }, take: 200,
    include: { tienda: { include: { organizacion: { select: { farmName: true } } } }, comprador: { select: { name: true } }, _count: { select: { items: true } } },
  });
  return (
    <>
      {!soloAprobar && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Lo que pedís en el Mercado entra solo a tu stock y a Finanzas cuando lo recibís. Si un pedido supera tu límite de compra, lo aprueba alguien con permiso antes de llegar a la tienda.
        </div>
      )}
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 820 }}>
          <thead><tr><th>Pedido</th><th>Fecha</th><th>Tienda</th><th>Pidió</th><th style={{ textAlign: "right" }}>Total</th><th>Estado</th><th>Entrega estimada</th></tr></thead>
          <tbody>
            {pedidos.map(p => (
              <tr key={p.id}>
                <td><Link href={`/compras/pedidos/${p.id}`} style={{ fontWeight: 500 }}>{p.numero}</Link><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p._count.items} producto{p._count.items > 1 ? "s" : ""}</div></td>
                <td>{fecha(p.createdAt)}</td>
                <td>{p.tienda.organizacion.farmName}</td>
                <td>{p.comprador.name}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(p.totalGs)}</td>
                <td style={{ color: COLOR_ESTADO[p.estado as Estado], fontWeight: 500 }}>{NOMBRE_ESTADO[p.estado as Estado]}</td>
                <td>{["RECIBIDO", "CANCELADO", "RECHAZADO"].includes(p.estado) ? "—" : fecha(p.fechaEstimada)}</td>
              </tr>
            ))}
            {pedidos.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              {soloAprobar ? "No hay pedidos esperando aprobación." : <>Todavía no hiciste pedidos. Buscá lo que necesitás en el <Link href="/mercado">Mercado</Link>.</>}
            </td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
