// Documentos legales: versiones, aprobación del asesor, publicación y quién falta aceptar.
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/admin/acceso";
import { AccionesDocumento } from "../formularios";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const COLOR: Record<string, string> = { PUBLICADO: "var(--success-text)", BORRADOR: "var(--warning-text)", RETIRADO: "var(--text-muted)" };

export default async function LegalAdmin() {
  const a = await requireAdmin(["TOTAL", "SOPORTE"]);
  const [docs, aceptaciones, usuarios] = await Promise.all([
    prisma.documentoLegal.findMany({ orderBy: [{ codigo: "asc" }, { createdAt: "desc" }], select: { id: true, codigo: true, version: true, titulo: true, estado: true, aprobadoPorAsesor: true, obligatorio: true, requiereReaceptacion: true, vigenteDesde: true, resumenCambios: true, createdAt: true } }),
    prisma.aceptacionDocumento.groupBy({ by: ["documentoId", "aceptado"], _count: { _all: true } }),
    prisma.user.findMany({ where: { isActive: true, tipoAcceso: { not: "GESTIONADA" } }, select: { id: true, name: true, email: true } }),
  ]);
  const vigentes = docs.filter(d => d.estado === "PUBLICADO" && d.obligatorio);
  // Quién falta aceptar la versión vigente de cada documento obligatorio
  const faltan = await Promise.all(vigentes.map(async d => {
    const ok = await prisma.aceptacionDocumento.findMany({ where: { documentoId: d.id, aceptado: true }, select: { userId: true }, distinct: ["userId"] });
    const set = new Set(ok.map(x => x.userId));
    return { d, faltan: usuarios.filter(u => !set.has(u.id)) };
  }));
  const n = (id: string, ac: boolean) => aceptaciones.find(x => x.documentoId === id && x.aceptado === ac)?._count._all ?? 0;
  const codigos = Array.from(new Set(docs.map(d => d.codigo)));

  return (
    <>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Los textos viven en la base: un documento publicado no se puede editar, los cambios van en una versión nueva. Solo se publica una versión que el asesor legal aprobó{a.nivel === "TOTAL" ? "" : " (publicar es del nivel TOTAL)"}.
      </div>
      {codigos.map(c => (
        <div key={c} style={{ ...tarjeta, overflowX: "auto" }}>
          <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 600 }}>{docs.find(d => d.codigo === c)?.titulo} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>· {c}</span></div>
          <table className="kp-table" style={{ minWidth: 760 }}>
            <thead><tr><th>Versión</th><th>Estado</th><th>Vigente desde</th><th style={{ textAlign: "right" }}>Aceptaron</th><th style={{ textAlign: "right" }}>Rechazaron</th><th>Cambios</th><th>Acciones</th></tr></thead>
            <tbody>{docs.filter(d => d.codigo === c).map(d => (
              <tr key={d.id}>
                <td>{d.version}</td>
                <td style={{ color: COLOR[d.estado], fontWeight: 500 }}>{d.estado}</td>
                <td>{fecha(d.vigenteDesde)}</td>
                <td style={{ textAlign: "right" }}>{n(d.id, true)}</td><td style={{ textAlign: "right" }}>{n(d.id, false)}</td>
                <td style={{ fontSize: 12, maxWidth: 260 }}>{d.resumenCambios ?? "—"}</td>
                <td>{a.nivel === "TOTAL" ? <AccionesDocumento id={d.id} estado={d.estado} aprobado={d.aprobadoPorAsesor} /> : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.aprobadoPorAsesor ? "Aprobado por el asesor" : "Sin aprobación"}</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ))}
      {codigos.length === 0 && <div style={{ ...tarjeta, padding: 16, fontSize: 13, color: "var(--text-muted)" }}>Todavía no hay documentos legales cargados.</div>}
      {faltan.map(({ d, faltan }) => (
        <details key={d.id} style={{ ...tarjeta, padding: 14 }}>
          <summary style={{ fontSize: 13, cursor: "pointer" }}>
            <strong>{d.titulo} v{d.version}</strong>: {usuarios.length - faltan.length} de {usuarios.length} cuentas aceptaron · faltan {faltan.length}
          </summary>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)", columns: "260px", lineHeight: 1.7 }}>
            {faltan.map(u => <div key={u.id}>{u.name} <span style={{ color: "var(--text-muted)" }}>{u.email}</span></div>)}
          </div>
        </details>
      ))}
    </>
  );
}
