import Link from "next/link";
import { requireAdmin } from "@/lib/admin/acceso";
import { organizacionesPlataforma } from "@/lib/admin/datos";
import { gs } from "@/lib/finanzas/calculos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—";
const TIPO: Record<string, string> = { EMPRESA: "Empresa", INDIVIDUAL: "Productor", VENDEDOR: "Tienda" };

export default async function OrganizacionesAdmin() {
  await requireAdmin(["TOTAL", "SOPORTE"]);
  const orgs = await organizacionesPlataforma();
  return (
    <div style={{ ...tarjeta, overflowX: "auto" }}>
      <table className="kp-table" style={{ minWidth: 980 }}>
        <thead>
          <tr><th>Organización</th><th>Tipo</th><th>Departamento</th><th>Plan</th><th>Estado</th><th style={{ textAlign: "right" }}>Miembros</th><th style={{ textAlign: "right" }}>Granjas</th><th style={{ textAlign: "right" }}>Madres</th><th style={{ textAlign: "right" }}>Ingresos del mes</th><th>Última actividad</th></tr>
        </thead>
        <tbody>
          {orgs.map(o => (
            <tr key={o.id}>
              <td>
                <Link href={`/admin/organizaciones/${o.id}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{o.farmName}</Link>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.ruc ? `RUC ${o.ruc} · ` : ""}alta {fecha(o.createdAt)}</div>
              </td>
              <td>{TIPO[o.tipo] ?? o.tipo}</td>
              <td>{o.departamento ?? "—"}</td>
              <td>{o.plan}</td>
              <td>{o.estado === "ACTIVA" ? "Activa" : o.estado}{o.tipo === "VENDEDOR" && o.verificacion !== "NO_APLICA" ? ` · ${o.verificacion.toLowerCase()}` : ""}</td>
              <td style={{ textAlign: "right" }}>{o.miembros}</td>
              <td style={{ textAlign: "right" }}>{o.granjas}</td>
              <td style={{ textAlign: "right" }}>{o.madres}</td>
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(o.ingresosMesGs)}</td>
              <td>{fecha(o.ultimaActividad)}</td>
            </tr>
          ))}
          {orgs.length === 0 && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Todavía no hay organizaciones.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
