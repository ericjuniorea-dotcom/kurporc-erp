// Datos del operador (aparecen en los documentos legales), planes y administradores.
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/admin/acceso";
import { FormConfiguracion } from "../formularios";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export default async function ConfiguracionAdmin() {
  const a = await requireAdmin(["TOTAL", "SOPORTE"]);
  const [c, planes, admins] = await Promise.all([
    prisma.configuracionPlataforma.findUnique({ where: { id: 1 } }),
    prisma.tenant.groupBy({ by: ["plan"], _count: { _all: true } }),
    prisma.adminPlataforma.groupBy({ by: ["nivel"], _count: { _all: true } }),
  ]);
  return (
    <>
      <div style={{ ...tarjeta, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Datos del operador</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Completan los documentos legales ({"{{razon_social}}"}, {"{{ruc}}"}, …). Se muestran al público en Términos y Privacidad: usá los datos de la empresa operadora y los correos de KurPorc, no datos personales.
          {a.nivel !== "TOTAL" && " Solo el nivel TOTAL puede cambiarlos."}
        </div>
        <FormConfiguracion puedeEditar={a.nivel === "TOTAL"} inicial={{
          razonSocial: c?.razonSocial ?? "", ruc: c?.ruc ?? "", domicilio: c?.domicilio ?? "", correoContacto: c?.correoContacto ?? "",
          correoPrivacidad: c?.correoPrivacidad ?? "", whatsappSoporte: c?.whatsappSoporte ?? "", ciudadJurisdiccion: c?.ciudadJurisdiccion ?? "Asunción",
        }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div style={{ ...tarjeta, padding: 16, fontSize: 12.5 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Planes</div>
          {planes.map(p => <div key={p.plan} style={{ display: "flex", justifyContent: "space-between" }}><span>{p.plan}</span><span>{p._count._all} organizaciones</span></div>)}
          <div style={{ marginTop: 8, color: "var(--text-muted)" }}>Por ahora todos los planes tienen las mismas funciones; los límites por plan llegan con la facturación de la plataforma.</div>
        </div>
        <div style={{ ...tarjeta, padding: 16, fontSize: 12.5 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Administradores de plataforma</div>
          {admins.map(x => <div key={x.nivel} style={{ display: "flex", justifyContent: "space-between" }}><span>{x.nivel}</span><span>{x._count._all}</span></div>)}
          <Link href="/admin/administradores" style={{ display: "inline-block", marginTop: 8 }}>Gestionar administradores →</Link>
        </div>
      </div>
    </>
  );
}
