// Moderación del Mercado (Fase 11/12): denuncias, publicaciones rechazadas y productos propuestos.
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { registrarAcceso, requireAdmin } from "@/lib/admin/acceso";
import { ModerarPublicacion, RevisarProducto } from "../formularios";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date) => d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
const MOTIVO: Record<string, string> = { ENGANOSA: "Información engañosa", PROHIBIDA: "Prohibido o sin registro", PRECIO: "Precio que no se respeta", SIN_DOCUMENTACION: "Animales sin documentación", OTRO: "Otro" };

export default async function Moderacion() {
  const a = await requireAdmin(["TOTAL", "SOPORTE", "MODERACION"]);
  const [denuncias, rechazadas, propuestos] = await Promise.all([
    prisma.denunciaPublicacion.findMany({ where: { estado: "ABIERTA" }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.publicacion.findMany({ where: { estado: "RECHAZADA" }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, slug: true, titulo: true, tiendaId: true, motivoRechazo: true, updatedAt: true, estado: true } }),
    prisma.productoCatalogo.findMany({ where: { aprobado: false }, orderBy: { createdAt: "asc" } }),
  ]);
  const pubs = await prisma.publicacion.findMany({ where: { id: { in: denuncias.map(d => d.publicacionId) } }, select: { id: true, slug: true, titulo: true, tiendaId: true, estado: true, precioGs: true, unidadVenta: true } });
  const pendientesProp = propuestos.filter(p => !(p.atributos as { descartado?: boolean } | null)?.descartado);
  const orgIds = Array.from(new Set([...pubs.map(p => p.tiendaId), ...rechazadas.map(p => p.tiendaId), ...pendientesProp.map(p => p.propuestoPor).filter((x): x is string => !!x)]));
  const [orgs, cats] = await Promise.all([
    prisma.tenant.findMany({ where: { id: { in: orgIds } }, select: { id: true, farmName: true } }),
    prisma.categoriaMercado.findMany({ select: { id: true, nombre: true } }),
  ]);
  const nOrg = new Map(orgs.map(o => [o.id, o.farmName])), nCat = new Map(cats.map(c => [c.id, c.nombre]));
  await registrarAcceso({ adminId: a.usuario.id, organizacionId: null, seccion: "/admin/moderacion", motivo: "SOPORTE", filas: denuncias.length + rechazadas.length });
  // Una fila por publicación denunciada, con todas sus denuncias
  const porPub = pubs.map(p => ({ p, ds: denuncias.filter(d => d.publicacionId === p.id) })).sort((x, y) => y.ds.length - x.ds.length);

  return (
    <>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 600 }}>Publicaciones denunciadas ({porPub.length})</div>
        <table className="kp-table" style={{ minWidth: 860 }}>
          <thead><tr><th>Publicación</th><th>Tienda</th><th>Denuncias</th><th>Decisión</th></tr></thead>
          <tbody>
            {porPub.map(({ p, ds }) => (
              <tr key={p.id}>
                <td><Link href={`/mercado/p/${p.slug}`} target="_blank" style={{ fontWeight: 500 }}>{p.titulo}</Link><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.unidadVenta} · Gs {Number(p.precioGs).toLocaleString("es-PY")} · {p.estado}</div></td>
                <td>{nOrg.get(p.tiendaId) ?? "—"}</td>
                <td style={{ fontSize: 12 }}>{ds.map(d => <div key={d.id}>{MOTIVO[d.motivo] ?? d.motivo} · {fecha(d.createdAt)}{d.detalle ? <span style={{ color: "var(--text-muted)" }}> — {d.detalle}</span> : null}</div>)}</td>
                <td><ModerarPublicacion id={p.id} estado={p.estado} denunciaId={ds.length === 1 ? ds[0].id : undefined} /></td>
              </tr>
            ))}
            {porPub.length === 0 && <tr><td colSpan={4} style={{ padding: 18, textAlign: "center", color: "var(--text-muted)" }}>No hay denuncias abiertas.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 600 }}>Productos propuestos por tiendas ({pendientesProp.length})</div>
        <div style={{ padding: "4px 14px 0", fontSize: 12, color: "var(--text-secondary)" }}>Al aprobarlo, entra al catálogo de todas las tiendas con el código que le pongas. Si se descarta, la tienda que lo propuso lo sigue usando.</div>
        <table className="kp-table" style={{ minWidth: 760 }}>
          <thead><tr><th>Producto</th><th>Categoría</th><th>Unidad</th><th>Propuesto por</th><th>Revisión</th></tr></thead>
          <tbody>
            {pendientesProp.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.nombre}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{fecha(p.createdAt)}</div></td>
                <td>{nCat.get(p.categoriaId) ?? "—"}</td><td>{p.unidadBase}</td><td>{p.propuestoPor ? nOrg.get(p.propuestoPor) ?? "—" : "—"}</td>
                <td><RevisarProducto id={p.id} sugerido="" /></td>
              </tr>
            ))}
            {pendientesProp.length === 0 && <tr><td colSpan={5} style={{ padding: 18, textAlign: "center", color: "var(--text-muted)" }}>No hay productos propuestos.</td></tr>}
          </tbody>
        </table>
      </div>

      {rechazadas.length > 0 && (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 600 }}>Publicaciones rechazadas</div>
          <table className="kp-table">
            <thead><tr><th>Publicación</th><th>Tienda</th><th>Motivo</th><th>Fecha</th><th></th></tr></thead>
            <tbody>{rechazadas.map(p => (
              <tr key={p.id}>
                <td><Link href={`/mercado/p/${p.slug}`} target="_blank">{p.titulo}</Link></td><td>{nOrg.get(p.tiendaId) ?? "—"}</td>
                <td style={{ fontSize: 12 }}>{p.motivoRechazo ?? "—"}</td><td>{fecha(p.updatedAt)}</td><td><ModerarPublicacion id={p.id} estado={p.estado} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
