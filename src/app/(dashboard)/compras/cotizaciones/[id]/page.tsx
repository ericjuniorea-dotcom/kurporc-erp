// Comparativa de cotizaciones: productos × tiendas, precio por unidad base, envío, plazo y total (13.2.4).
import Link from "next/link";
import { notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import { getPermisos, puede } from "@/lib/permisos/servidor";
import { hoyUTC } from "@/lib/finanzas/calculos";
import { compararRespuestas, type ItemRespuesta } from "@/lib/pedidos/reglas";
import { AceptarCotizacion } from "../../componentes";
import { CancelarSolicitud } from "./cancelar";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";
const gs = (v: number) => `Gs ${Math.round(v).toLocaleString("es-PY")}`;
const marca: React.CSSProperties = { background: "var(--success-subtle)", color: "var(--success-text)" };

export default async function Comparativa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const permisos = await getPermisos();
  if (!permisos || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const s = await prisma.solicitudCotizacion.findUnique({
    where: { id },
    include: {
      items: { include: { producto: { select: { nombre: true, unidadBase: true } } } },
      tiendas: { include: { tienda: { include: { organizacion: { select: { farmName: true } } } } } },
      respuestas: { include: { tienda: { include: { organizacion: { select: { farmName: true } } } }, pedidos: { select: { id: true, numero: true } } } },
    },
  });
  if (!s || s.organizacionId !== permisos.organizacionId) notFound();
  const itemIds = s.items.map(i => i.id);
  const c = compararRespuestas(itemIds, s.respuestas.map(r => ({
    id: r.id, tiendaId: r.tiendaId, tienda: r.tienda.organizacion.farmName, items: r.items as unknown as ItemRespuesta[],
    costoEnvioGs: Number(r.costoEnvioGs), plazoDias: r.plazoDias, validaHasta: r.validaHasta,
  })), hoyUTC());
  const abierta = s.estado === "ABIERTA" && s.venceEn.getTime() > Date.now();
  const pedido = s.respuestas.flatMap(r => r.pedidos)[0];
  const sinResponder = s.tiendas.filter(t => !s.respuestas.some(r => r.tiendaId === t.tiendaId));
  const puedePedir = puede(permisos, "compras.pedidos.crear");

  return (
    <>
      <div style={{ ...tarjeta, padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Cotización del {fecha(s.createdAt)}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            Entrega en {s.departamento}{s.fechaRequerida ? ` · para el ${fecha(s.fechaRequerida)}` : ""} · enviada a {s.tiendas.length} tienda{s.tiendas.length > 1 ? "s" : ""} · {s.respuestas.length} respondi{s.respuestas.length === 1 ? "ó" : "eron"}
          </div>
          {s.nota && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Nota: {s.nota}</div>}
        </div>
        <div style={{ textAlign: "right", fontSize: 12.5 }}>
          {pedido ? <>Pedido hecho: <Link href={`/compras/pedidos/${pedido.id}`}>{pedido.numero}</Link></>
            : abierta ? <>Abierta hasta el {fecha(s.venceEn)}{puede(permisos, "compras.cotizaciones.crear") && <div style={{ marginTop: 6 }}><CancelarSolicitud id={s.id} /></div>}</>
            : s.estado === "CANCELADA" ? "Cancelada" : "Vencida"}
        </div>
      </div>

      {s.respuestas.length === 0 ? (
        <div style={{ ...tarjeta, padding: 24, fontSize: 13.5, color: "var(--text-secondary)", textAlign: "center" }}>Todavía ninguna tienda respondió. Te avisamos apenas llegue la primera respuesta.</div>
      ) : (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <table className="kp-table" style={{ minWidth: 300 + c.columnas.length * 180 }}>
            <thead>
              <tr><th>Producto</th>{c.columnas.map(col => (
                <th key={col.r.id} style={{ textAlign: "right" }}>
                  {col.r.tienda}
                  <div style={{ fontWeight: 400, fontSize: 11, color: "var(--text-muted)" }}>{col.completa ? "cotizó todo" : `cotizó ${col.cotizados} de ${itemIds.length}`}{col.vencida ? " · vencida" : ""}</div>
                </th>
              ))}</tr>
            </thead>
            <tbody>
              {s.items.map(it => (
                <tr key={it.id}>
                  <td>{it.producto.nombre}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{Number(it.cantidadBase).toLocaleString("es-PY")} {it.producto.unidadBase.toLowerCase()}</div></td>
                  {c.columnas.map(col => {
                    const ce = col.celdas[it.id];
                    return (
                      <td key={col.r.id} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", ...(c.mejorPorItem[it.id] === col.r.id && c.columnas.length > 1 ? marca : {}) }}>
                        {ce ? <>
                          {gs(ce.subtotal)}
                          <div style={{ fontSize: 11, color: "inherit", opacity: 0.85 }}>{gs(ce.precioBase)}/{it.producto.unidadBase.toLowerCase()} · {ce.item.cantidad} × {ce.item.unidadVenta}</div>
                        </> : <span style={{ color: "var(--text-muted)" }}>no cotiza</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr><td style={{ color: "var(--text-secondary)" }}>Envío</td>{c.columnas.map(col => <td key={col.r.id} style={{ textAlign: "right" }}>{col.r.costoEnvioGs ? gs(col.r.costoEnvioGs) : "Sin cargo"}</td>)}</tr>
              <tr><td style={{ color: "var(--text-secondary)" }}>Plazo</td>{c.columnas.map(col => <td key={col.r.id} style={{ textAlign: "right", ...(c.menorPlazo === col.r.id && c.columnas.length > 1 ? marca : {}) }}>{col.r.plazoDias} día{col.r.plazoDias === 1 ? "" : "s"}</td>)}</tr>
              <tr><td style={{ color: "var(--text-secondary)" }}>Válida hasta</td>{c.columnas.map(col => <td key={col.r.id} style={{ textAlign: "right", color: col.vencida ? "var(--danger-text)" : undefined }}>{fecha(col.r.validaHasta)}</td>)}</tr>
              <tr style={{ fontWeight: 600 }}><td>Total</td>{c.columnas.map(col => <td key={col.r.id} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", ...(c.menorTotal === col.r.id && c.columnas.length > 1 ? marca : {}) }}>{gs(col.total)}</td>)}</tr>
              {abierta && !pedido && puedePedir && (
                <tr><td></td>{c.columnas.map(col => <td key={col.r.id} style={{ textAlign: "right" }}>{!col.vencida && <AceptarCotizacion respuestaId={col.r.id} tienda={col.r.tienda} total={col.total} />}</td>)}</tr>
              )}
            </tbody>
          </table>
          {s.respuestas.some(r => r.nota) && (
            <div style={{ padding: "8px 14px 14px", fontSize: 12, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 3 }}>
              {s.respuestas.filter(r => r.nota).map(r => <div key={r.id}><strong>{r.tienda.organizacion.farmName}:</strong> {r.nota}</div>)}
            </div>
          )}
        </div>
      )}
      {c.columnas.length > 1 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>En verde: el menor total y el menor plazo entre las tiendas que cotizaron más productos, y el menor precio por unidad de cada producto.</div>}
      {sinResponder.length > 0 && abierta && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin responder todavía: {sinResponder.map(t => t.tienda.organizacion.farmName).join(", ")}.</div>}
    </>
  );
}
