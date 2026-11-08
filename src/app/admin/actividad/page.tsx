import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/admin/acceso";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const ACCION: Record<string, string> = {
  LOGIN: "Entró", LOGIN_FALLIDO: "Ingreso fallido", LOGIN_BLOQUEADO: "Ingreso bloqueado", LOGOUT: "Salió",
  MIEMBRO_INVITADO: "Sumó a una persona", MIEMBRO_SUSPENDIDO: "Suspendió o quitó a una persona", PERMISOS_CAMBIADOS: "Cambió permisos",
  PROPIEDAD_TRANSFERIDA: "Transfirió la organización", DATO_PERSONAL_VISTO: "Vio datos personales", EXPORTACION: "Exportó datos",
  MOVIMIENTO_ANULADO: "Anuló un movimiento", MES_CERRADO: "Cerró un mes", MES_REABIERTO: "Reabrió un mes",
  CONTRATO_ACEPTADO: "Aceptó los términos", SOLICITUD_PRIVACIDAD: "Pidió algo sobre sus datos", BAJA_SOLICITADA: "Pidió la baja",
};

export default async function ActividadAdmin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(["TOTAL", "SOPORTE"]);
  const sp = await searchParams;
  const accion = sp.accion && sp.accion in ACCION ? sp.accion : undefined;
  const orgId = sp.org || undefined;
  const [eventos, accesos, orgs] = await Promise.all([
    prisma.auditoria.findMany({
      where: { ...(accion ? { accion } : {}), ...(orgId ? { organizacionId: orgId } : {}) },
      orderBy: { createdAt: "desc" }, take: 300,
      select: { id: true, createdAt: true, accion: true, entidad: true, actorId: true, organizacionId: true, ip: true, detalle: true, actorEsPlataforma: true },
    }),
    prisma.accesoPlataforma.findMany({ where: orgId ? { organizacionId: orgId } : {}, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.tenant.findMany({ select: { id: true, farmName: true }, orderBy: { farmName: "asc" } }),
  ]);
  const ids = Array.from(new Set([...eventos.map(e => e.actorId), ...accesos.map(a => a.adminId)].filter((x): x is string => !!x)));
  const personas = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  const quien = new Map(personas.map(p => [p.id, p.name || p.email]));
  const org = new Map(orgs.map(o => [o.id, o.farmName]));
  const detalle = (d: unknown) => {
    if (!d || typeof d !== "object") return "";
    const x = d as Record<string, unknown>;
    return [x.tipo, x.email, x.motivo, x.metodo, x.razon].filter(v => typeof v === "string").join(" · ").replace(/_/g, " ");
  };

  return (
    <>
      <form style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="accion" defaultValue={accion ?? ""} className="kp-input" style={{ maxWidth: 240 }} aria-label="Acción">
          <option value="">Todas las acciones</option>
          {Object.entries(ACCION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="org" defaultValue={orgId ?? ""} className="kp-input" style={{ maxWidth: 260 }} aria-label="Organización">
          <option value="">Todas las organizaciones</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.farmName}</option>)}
        </select>
        <button type="submit" className="btn">Filtrar</button>
        {(accion || orgId) && <Link href="/admin/actividad" className="btn">Limpiar</Link>}
      </form>

      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Lo que hacen las personas en la app (últimos 300)</div>
        <table className="kp-table" style={{ minWidth: 900 }}>
          <thead><tr><th>Cuándo</th><th>Quién</th><th>Organización</th><th>Qué</th><th>Detalle</th><th>IP</th></tr></thead>
          <tbody>
            {eventos.map(e => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{e.createdAt.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td>{e.actorId ? (quien.get(e.actorId) ?? "—") : "Sistema"}{e.actorEsPlataforma ? " (plataforma)" : ""}</td>
                <td>{e.organizacionId ? (org.get(e.organizacionId) ?? "—") : "—"}</td>
                <td style={{ color: e.accion.includes("FALLIDO") || e.accion.includes("BLOQUEADO") ? "var(--warning-text)" : "var(--text-secondary)" }}>{ACCION[e.accion] ?? e.accion}</td>
                <td style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{e.entidad}{detalle(e.detalle) ? ` · ${detalle(e.detalle)}` : ""}</td>
                <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.ip ?? "—"}</td>
              </tr>
            ))}
            {eventos.length === 0 && <tr><td colSpan={6} style={{ padding: 16, color: "var(--text-muted)" }}>Sin eventos con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Accesos de la plataforma a datos de organizaciones</div>
        <table className="kp-table" style={{ minWidth: 700 }}>
          <thead><tr><th>Cuándo</th><th>Administrador</th><th>Organización</th><th>Motivo</th><th>Página</th></tr></thead>
          <tbody>
            {accesos.map(a => (
              <tr key={a.id}>
                <td style={{ whiteSpace: "nowrap" }}>{a.createdAt.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td>{quien.get(a.adminId) ?? "—"}</td>
                <td>{a.organizacionId ? (org.get(a.organizacionId) ?? "—") : "—"}</td>
                <td>{a.motivo.replace(/_/g, " ").toLowerCase()}{a.detalleMotivo ? ` · ${a.detalleMotivo}` : ""}</td>
                <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.seccion}</td>
              </tr>
            ))}
            {accesos.length === 0 && <tr><td colSpan={5} style={{ padding: 16, color: "var(--text-muted)" }}>Todavía no hay accesos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
