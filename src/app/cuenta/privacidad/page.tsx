import Link from "next/link";
import { redirect } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import prisma from "@/lib/db/prisma";
import { getUsuario } from "@/lib/auth/config";
import { datosOperador } from "@/lib/legal/documentos";
import { ETIQUETA_ESTADO, ETIQUETA_SOLICITUD } from "@/lib/legal/privacidad";
import { FormPerfil, FormSolicitud, PanelBaja } from "./formularios";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacidad · KurPorc" };

const tarjeta: React.CSSProperties = {
  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
  borderRadius: "var(--radius-lg)", padding: 18, display: "flex", flexDirection: "column", gap: 12,
};
const h2: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 };
const txt: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 };
const celda: React.CSSProperties = { padding: "6px 8px", borderBottom: "0.5px solid var(--border-default)", textAlign: "left", fontSize: 12 };

function fecha(d: Date) {
  return d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Asuncion" });
}

export default async function PrivacidadCuentaPage() {
  const u = await getUsuario();
  if (!u) redirect("/login?next=/cuenta/privacidad");

  const [perfil, aceptaciones, solicitudes, operador] = await Promise.all([
    prisma.user.findUnique({ where: { id: u.id }, select: { name: true, email: true, phone: true, departamento: true, distrito: true, bajaSolicitadaEn: true } }),
    prisma.aceptacionDocumento.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.solicitudPrivacidad.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    datosOperador(),
  ]);
  if (!perfil) redirect("/login");
  const hoy = Date.now();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", padding: "24px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <IconArrowLeft size={14} aria-hidden /> Volver
        </Link>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>Tu privacidad</h1>
          <p style={{ ...txt, marginTop: 4 }}>
            Tus datos, tus derechos. Respondemos cualquier pedido en 30 días corridos, sin costo.
            También podés escribir a <strong>{operador.correo_privacidad}</strong>.
          </p>
        </div>

        <section style={tarjeta}>
          <h2 style={h2}>Tus datos</h2>
          <FormPerfil inicial={{ name: perfil.name, email: perfil.email, phone: perfil.phone ?? "", departamento: perfil.departamento ?? "", distrito: perfil.distrito ?? "" }} />
        </section>

        <section style={tarjeta}>
          <h2 style={h2}>Descargar tus datos</h2>
          <p style={txt}>Un archivo con tu perfil, tus organizaciones, tus aceptaciones, tus solicitudes y tu actividad reciente.</p>
          <a href="/cuenta/privacidad/descargar" className="btn" style={{ alignSelf: "flex-start", height: 32 }}>Descargar (JSON)</a>
        </section>

        <section style={tarjeta}>
          <h2 style={h2}>Lo que aceptaste</h2>
          {aceptaciones.length === 0 ? <p style={txt}>Todavía no aceptaste ningún documento.</p> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-secondary)" }}>
                <thead><tr><th style={celda}>Documento</th><th style={celda}>Versión</th><th style={celda}>Fecha</th><th style={celda}>Desde</th></tr></thead>
                <tbody>
                  {aceptaciones.map(a => (
                    <tr key={a.id}>
                      <td style={celda}><Link href={`/legal/${a.codigo.toLowerCase()}`}>{a.codigo === "TERMINOS" ? "Términos y Condiciones" : a.codigo === "PRIVACIDAD" ? "Política de Privacidad" : a.codigo}</Link></td>
                      <td style={celda}>{a.version}</td>
                      <td style={celda}>{fecha(a.createdAt)}</td>
                      <td style={celda}>{a.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={tarjeta}>
          <h2 style={h2}>Hacer una solicitud</h2>
          <FormSolicitud />
          {solicitudes.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-secondary)" }}>
                <thead><tr><th style={celda}>Pedido</th><th style={celda}>Fecha</th><th style={celda}>Estado</th><th style={celda}>Plazo</th></tr></thead>
                <tbody>
                  {solicitudes.map(s => {
                    const dias = Math.ceil((s.venceEn.getTime() - hoy) / 86400000);
                    const abierta = s.estado === "RECIBIDA" || s.estado === "EN_CURSO";
                    return (
                      <tr key={s.id}>
                        <td style={celda}>{ETIQUETA_SOLICITUD[s.tipo] ?? s.tipo}</td>
                        <td style={celda}>{fecha(s.createdAt)}</td>
                        <td style={celda}>{ETIQUETA_ESTADO[s.estado] ?? s.estado}</td>
                        <td style={celda}>{abierta ? (dias >= 0 ? `Faltan ${dias} día${dias === 1 ? "" : "s"}` : "Vencida") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={tarjeta}>
          <h2 style={h2}>Darte de baja</h2>
          <PanelBaja email={perfil.email} pedida={perfil.bajaSolicitadaEn ? fecha(perfil.bajaSolicitadaEn) : null} />
        </section>
      </div>
    </div>
  );
}
