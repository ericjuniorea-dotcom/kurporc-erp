// Productos de la tienda (Fase 12).
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { contextoTienda } from "@/lib/mercado/vendedor";
import { tarjetaEstilo, gsTexto } from "@/components/mercado/marco";
import { textoPrecioBase, type UnidadBase } from "@/lib/mercado/calculo";
import { CambiarEstado } from "./formulario";

const ESTADO: Record<string, [string, string]> = {
  ACTIVA: ["Activa", "var(--success-text)"], BORRADOR: ["Borrador", "var(--warning-text)"],
  PAUSADA: ["Pausada", "var(--text-muted)"], RECHAZADA: ["Rechazada", "var(--danger-text)"],
};

export default async function ProductosVendedor() {
  const t = (await contextoTienda())!;
  const pubs = await prisma.publicacion.findMany({ where: { tiendaId: t.org.id }, orderBy: [{ estado: "asc" }, { updatedAt: "desc" }] });
  const cats = await prisma.categoriaMercado.findMany({ where: { id: { in: Array.from(new Set(pubs.map(p => p.categoriaId))) } }, select: { id: true, nombre: true } });
  const cat = new Map(cats.map(c => [c.id, c.nombre]));
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{pubs.length} producto{pubs.length === 1 ? "" : "s"}</div>
        {t.puede("tienda.publicaciones.crear") && <Link href="/vendedor/productos/nuevo" className="btn btn-primary" style={{ height: 34 }}>Nuevo producto</Link>}
      </div>
      <div style={{ ...tarjetaEstilo, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 760 }}>
          <thead><tr><th>Producto</th><th>Categoría</th><th style={{ textAlign: "right" }}>Precio</th><th style={{ textAlign: "right" }}>Por unidad</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {pubs.map(p => (
              <tr key={p.id}>
                <td>
                  <Link href={`/vendedor/productos/${p.id}`} style={{ fontWeight: 500, color: "var(--text-primary)" }}>{p.titulo}</Link>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.unidadVenta}{p.fotos.length ? ` · ${p.fotos.length} foto${p.fotos.length > 1 ? "s" : ""}` : " · sin fotos"}</div>
                  {p.estado === "RECHAZADA" && p.motivoRechazo && <div style={{ fontSize: 11.5, color: "var(--danger-text)" }}>Motivo: {p.motivoRechazo}</div>}
                </td>
                <td>{cat.get(p.categoriaId) ?? "—"}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gsTexto(p.precioGs)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)" }}>{textoPrecioBase(p.precioGs, Number(p.contenidoBase), p.unidadBase as UnidadBase) ?? "—"}</td>
                <td style={{ color: ESTADO[p.estado][1], fontWeight: 500 }}>{ESTADO[p.estado][0]}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <Link href={`/mercado/p/${p.slug}`} style={{ fontSize: 12 }}>Ver</Link>
                    {t.puede("tienda.publicaciones.pausar") && p.estado !== "RECHAZADA" && <CambiarEstado id={p.id} estado={p.estado} />}
                  </span>
                </td>
              </tr>
            ))}
            {pubs.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>Todavía no cargaste productos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
