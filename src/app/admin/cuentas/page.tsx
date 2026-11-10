import { requireAdmin } from "@/lib/admin/acceso";
import { cuentasPlataforma } from "@/lib/admin/datos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const fecha = (d: Date | null) => d ? d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const TIPO: Record<string, string> = { EMPRESA: "Empresa", INDIVIDUAL: "Productor", VENDEDOR: "Tienda", COMPRADOR: "Comprador", OPERARIO: "Operario" };
const si = (b: boolean) => <span style={{ color: b ? "var(--success-text)" : "var(--text-muted)" }}>{b ? "Sí" : "No"}</span>;

export default async function CuentasAdmin() {
  await requireAdmin(["TOTAL", "SOPORTE"]);
  const cuentas = await cuentasPlataforma();
  const embudo = [
    ["Registrados", cuentas.length],
    ["Aceptaron los términos", cuentas.filter(c => c.contrato).length],
    ["Terminaron los primeros pasos", cuentas.filter(c => c.onboardingCompleto).length],
    ["Con una organización", cuentas.filter(c => c.organizaciones.length > 0).length],
    ["Activos en 30 días", cuentas.filter(c => c.diasActivo30 > 0).length],
  ] as const;
  return (
    <>
      <div style={{ ...tarjeta, padding: 14, display: "flex", gap: 18, flexWrap: "wrap" }}>
        {embudo.map(([t, n], i) => (
          <div key={t}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{i + 1}. {t}</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
              {n}{i > 0 && embudo[0][1] > 0 && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}> · {Math.round((n / embudo[0][1]) * 100)} %</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 1000 }}>
          <thead>
            <tr><th>Persona</th><th>Tipo</th><th>Ingresa con</th><th>2.º factor</th><th>Términos</th><th>Primeros pasos</th><th>Organizaciones</th><th>Días activo (30)</th><th>Último acceso</th><th>Alta</th></tr>
          </thead>
          <tbody>
            {cuentas.map(c => (
              <tr key={c.id} style={{ opacity: c.isActive ? 1 : 0.5 }}>
                <td>
                  <div style={{ color: "var(--text-primary)" }}>{c.name}{c.adminPlataforma && <span style={{ fontSize: 10.5, color: "var(--danger-text)" }}> · admin {c.adminPlataforma.nivel}</span>}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.tipoAcceso === "GESTIONADA" ? `${c.email.split(".")[0]} (operario)` : c.email}</div>
                </td>
                <td>{TIPO[c.tipoRegistro] ?? c.tipoRegistro}</td>
                <td style={{ textTransform: "capitalize" }}>{c.proveedorLogin}</td>
                <td>{si(c.segundoFactor)}</td>
                <td>{c.contrato ? `v${c.contrato}` : si(false)}</td>
                <td>{si(c.onboardingCompleto)}</td>
                <td style={{ fontSize: 11.5 }}>{c.organizaciones.length ? c.organizaciones.map(o => `${o.nombre}${o.propietario ? " (dueño)" : ""}`).join(", ") : "—"}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.diasActivo30}</td>
                <td>{fecha(c.ultimoAcceso)}</td>
                <td>{fecha(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
