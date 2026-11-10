// Incidentes (plazo de 72 h para avisar a la agencia), ingresos fallidos y accesos de la plataforma.
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { MOTIVOS, requireAdmin, type Motivo } from "@/lib/admin/acceso";
import { FormIncidente } from "../formularios";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fh = (d: Date | null) => d ? d.toLocaleString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const local = (d: Date | null) => d ? new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16) : ""; // hora de Paraguay (UTC-3)
const H = 3_600_000;

export default async function SeguridadAdmin() {
  await requireAdmin(["TOTAL", "SOPORTE"]);
  const hace7 = new Date(Date.now() - 7 * 24 * H);
  const [incidentes, fallidos, accesos] = await Promise.all([
    prisma.incidenteSeguridad.findMany({ orderBy: [{ estado: "asc" }, { detectadoEn: "desc" }], take: 100 }),
    prisma.auditoria.findMany({ where: { accion: { in: ["LOGIN_FALLIDO", "LOGIN_BLOQUEADO"] }, createdAt: { gte: hace7 } }, select: { accion: true, ip: true, detalle: true, createdAt: true } }),
    prisma.accesoPlataforma.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const porIp = new Map<string, { n: number; bloqueos: number; correos: Set<string>; ultimo: Date }>();
  for (const f of fallidos) {
    const k = f.ip ?? "—";
    const x = porIp.get(k) ?? { n: 0, bloqueos: 0, correos: new Set<string>(), ultimo: f.createdAt };
    x.n++; if (f.accion === "LOGIN_BLOQUEADO") x.bloqueos++;
    const email = (f.detalle as Record<string, unknown> | null)?.email;
    if (typeof email === "string") x.correos.add(email);
    if (f.createdAt > x.ultimo) x.ultimo = f.createdAt;
    porIp.set(k, x);
  }
  const ips = Array.from(porIp, ([ip, x]) => ({ ip, ...x })).sort((a, b) => b.n - a.n).slice(0, 20);
  const admins = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(accesos.map(a => a.adminId))) } }, select: { id: true, name: true } });
  const orgs = await prisma.tenant.findMany({ where: { id: { in: accesos.map(a => a.organizacionId).filter((x): x is string => !!x) } }, select: { id: true, farmName: true } });
  const nAdmin = new Map(admins.map(a => [a.id, a.name])), nOrg = new Map(orgs.map(o => [o.id, o.farmName]));
  const ahora = Date.now();

  return (
    <>
      <div style={{ ...tarjeta, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Incidentes de seguridad</div>
          <FormIncidente titulo="Registrar incidente" />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Ley 7593/2025: si afecta datos personales, hay que avisar a la agencia dentro de las 72 horas desde que se detectó, y a las personas afectadas cuando haya riesgo para ellas.</div>
        {incidentes.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No hay incidentes registrados.</div>}
        {incidentes.map(i => {
          const restante = i.detectadoEn.getTime() + 72 * H - ahora;
          const pendienteAviso = !i.notificadoAgenciaEn && i.estado !== "CERRADO";
          return (
            <div key={i.id} style={{ paddingTop: 10, borderTop: "0.5px solid var(--border-default)", display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, color: i.estado === "ABIERTO" ? "var(--danger-text)" : i.estado === "CONTENIDO" ? "var(--warning-text)" : "var(--text-muted)" }}>{i.estado}</span>
                <span style={{ color: "var(--text-muted)" }}>detectado {fh(i.detectadoEn)}</span>
                {pendienteAviso && (
                  <span style={{ fontWeight: 600, color: restante < 24 * H ? "var(--danger-text)" : "var(--warning-text)" }}>
                    {restante > 0 ? `Quedan ${Math.floor(restante / H)} h para avisar a la agencia` : `Plazo de 72 h vencido hace ${Math.floor(-restante / H)} h`}
                  </span>
                )}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{i.descripcion}</div>
              <div style={{ color: "var(--text-muted)" }}>
                Datos: {i.datosAfectados ?? "—"} · Personas: {i.personasAfectadas ?? "—"} · Agencia: {fh(i.notificadoAgenciaEn)} · Titulares: {fh(i.notificadoTitularesEn)}
              </div>
              {i.medidas && <div style={{ color: "var(--text-secondary)" }}>Medidas: {i.medidas}</div>}
              <div><FormIncidente titulo="Actualizar" inicial={{
                id: i.id, detectadoEn: local(i.detectadoEn), descripcion: i.descripcion, datosAfectados: i.datosAfectados ?? "", personasAfectadas: i.personasAfectadas?.toString() ?? "",
                medidas: i.medidas ?? "", estado: i.estado, notificadoAgenciaEn: local(i.notificadoAgenciaEn), notificadoTitularesEn: local(i.notificadoTitularesEn),
              }} /></div>
            </div>
          );
        })}
      </div>

      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 600 }}>Ingresos fallidos · últimos 7 días ({fallidos.length})</div>
        <table className="kp-table">
          <thead><tr><th>IP</th><th style={{ textAlign: "right" }}>Intentos</th><th style={{ textAlign: "right" }}>Bloqueos</th><th>Correos probados</th><th>Último</th></tr></thead>
          <tbody>
            {ips.map(x => <tr key={x.ip}><td>{x.ip}</td><td style={{ textAlign: "right" }}>{x.n}</td><td style={{ textAlign: "right" }}>{x.bloqueos}</td><td style={{ fontSize: 12 }}>{Array.from(x.correos).slice(0, 4).join(", ")}{x.correos.size > 4 ? ` y ${x.correos.size - 4} más` : ""}</td><td>{fh(x.ultimo)}</td></tr>)}
            {ips.length === 0 && <tr><td colSpan={5} style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>Sin ingresos fallidos.</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 0", fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
          Accesos de la plataforma a datos de organizaciones <Link href="/admin/actividad" style={{ fontSize: 12, fontWeight: 400 }}>Ver toda la actividad →</Link>
        </div>
        <table className="kp-table">
          <thead><tr><th>Cuándo</th><th>Administrador</th><th>Organización</th><th>Sección</th><th>Motivo</th><th style={{ textAlign: "right" }}>Filas</th></tr></thead>
          <tbody>{accesos.map(x => (
            <tr key={x.id}>
              <td style={{ whiteSpace: "nowrap" }}>{fh(x.createdAt)}</td><td>{nAdmin.get(x.adminId) ?? "—"}</td><td>{x.organizacionId ? nOrg.get(x.organizacionId) ?? "—" : "Toda la plataforma"}</td>
              <td style={{ fontSize: 12 }}>{x.seccion}{x.exportacion ? " · exportación" : ""}</td><td style={{ fontSize: 12 }}>{MOTIVOS[x.motivo as Motivo] ?? x.motivo}</td><td style={{ textAlign: "right" }}>{x.filas ?? "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
