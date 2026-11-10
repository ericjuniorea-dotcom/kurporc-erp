// Solicitudes de los titulares sobre sus datos (Ley 7593/2025): 30 días corridos para responder.
import prisma from "@/lib/db/prisma";
import { registrarAcceso, requireAdmin } from "@/lib/admin/acceso";
import { RespuestaPrivacidad } from "../formularios";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const TIPO: Record<string, string> = {
  ACCESO: "Ver sus datos", RECTIFICACION: "Corregir datos", SUPRESION: "Borrar sus datos", OPOSICION: "Oponerse a un uso",
  PORTABILIDAD: "Llevarse sus datos", REVOCAR_CONSENTIMIENTO: "Revocar un consentimiento", IMPUGNAR_DECISION_AUTOMATIZADA: "Impugnar una decisión automática",
};
const ESTADO: Record<string, string> = { RECIBIDA: "Recibida", EN_CURSO: "En curso", RESPONDIDA: "Respondida", RECHAZADA_CON_MOTIVO: "Rechazada con motivo", CANCELADA: "Cancelada" };

export default async function PrivacidadAdmin() {
  const a = await requireAdmin(["TOTAL", "SOPORTE"]);
  const solicitudes = await prisma.solicitudPrivacidad.findMany({ orderBy: [{ venceEn: "asc" }], take: 200 });
  const personas = await prisma.user.findMany({ where: { id: { in: Array.from(new Set(solicitudes.map(s => s.userId))) } }, select: { id: true, name: true, email: true } });
  const quien = new Map(personas.map(p => [p.id, p]));
  await registrarAcceso({ adminId: a.usuario.id, organizacionId: null, seccion: "/admin/privacidad", motivo: "CUMPLIMIENTO_LEGAL", filas: solicitudes.length });
  const abiertas = solicitudes.filter(s => s.estado === "RECIBIDA" || s.estado === "EN_CURSO");
  const cerradas = solicitudes.filter(s => !(s.estado === "RECIBIDA" || s.estado === "EN_CURSO")).reverse();
  const hoy = Date.now();
  return (
    <>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Hay 30 días corridos para responder. Al cerrar, la persona recibe un aviso y ve la respuesta en Mi cuenta → Privacidad.</div>
      <div style={{ ...tarjeta, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Abiertas ({abiertas.length})</div>
        {abiertas.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No hay solicitudes pendientes.</div>}
        {abiertas.map(s => {
          const dias = Math.ceil((s.venceEn.getTime() - hoy) / 86_400_000);
          const p = quien.get(s.userId);
          return (
            <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(280px, 2fr)", gap: 12, paddingTop: 12, borderTop: "0.5px solid var(--border-default)" }}>
              <div style={{ fontSize: 12.5, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontWeight: 500 }}>{TIPO[s.tipo] ?? s.tipo}</div>
                <div>{p?.name ?? "—"} <span style={{ color: "var(--text-muted)" }}>{p?.email}</span></div>
                <div style={{ color: "var(--text-muted)" }}>Recibida {fecha(s.createdAt)} · {ESTADO[s.estado]}</div>
                <div style={{ fontWeight: 600, color: dias <= 5 ? "var(--danger-text)" : dias <= 10 ? "var(--warning-text)" : "var(--text-secondary)" }}>
                  {dias < 0 ? `Vencida hace ${-dias} día${dias === -1 ? "" : "s"}` : `Vence en ${dias} día${dias === 1 ? "" : "s"} (${fecha(s.venceEn)})`}
                </div>
                {s.detalle && <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{s.detalle}</div>}
              </div>
              <RespuestaPrivacidad id={s.id} respuestaActual={s.respuesta} />
            </div>
          );
        })}
      </div>
      {cerradas.length > 0 && (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <table className="kp-table">
            <thead><tr><th>Pedido</th><th>Persona</th><th>Recibida</th><th>Cerrada</th><th>Estado</th><th>Respuesta</th></tr></thead>
            <tbody>{cerradas.map(s => (
              <tr key={s.id}><td>{TIPO[s.tipo] ?? s.tipo}</td><td>{quien.get(s.userId)?.email ?? "—"}</td><td>{fecha(s.createdAt)}</td><td>{fecha(s.respondidaEn)}</td><td>{ESTADO[s.estado] ?? s.estado}</td>
                <td style={{ maxWidth: 360, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={s.respuesta ?? ""}>{s.respuesta ?? "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
