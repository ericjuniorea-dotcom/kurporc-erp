// Cómo funcionan todas las granjas (Fase 11, parte 2). Cada visita queda registrada.
import { requireAdmin, registrarAcceso } from "@/lib/admin/acceso";
import { produccionGranjas } from "@/lib/admin/produccion";
import { gs } from "@/lib/finanzas/calculos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const n = (v: number | null, d = 1) => (v === null ? "—" : v.toLocaleString("es-PY", { maximumFractionDigits: d, minimumFractionDigits: d }));
const ESTADOS = [
  ["servidas", "Servidas", "var(--warning)"], ["gestantes", "Gestantes", "var(--success)"], ["lactancia", "Lactancia", "var(--accent)"],
  ["vacias", "Vacías", "var(--danger)"], ["otras", "Otras", "var(--text-muted)"],
] as const;

export default async function ProduccionAdmin() {
  const a = await requireAdmin(["TOTAL", "SOPORTE"]);
  const filas = await produccionGranjas();
  await registrarAcceso({ adminId: a.usuario.id, organizacionId: null, seccion: "/admin/produccion", motivo: "ESTADISTICA", filas: filas.length });
  const deptos = Array.from(new Set(filas.map(f => f.departamento))).map(d => {
    const fs = filas.filter(f => f.departamento === d);
    return { d, granjas: fs.length, madres: fs.reduce((s, f) => s + f.madres, 0), paradas: fs.reduce((s, f) => s + f.paradasHoy, 0), perdida: fs.reduce((s, f) => s + f.perdidaAnioGs, 0) };
  }).sort((x, y) => y.madres - x.madres);
  return (
    <>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Últimos 365 días. Estado de las madres activas hoy; cerdas paradas y plata perdida según la Fase 10 (pérdida del año en curso).</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)" }}>
        {ESTADOS.map(([, l, c]) => <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: c, opacity: 0.55 }} />{l}</span>)}
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 1100 }}>
          <thead><tr><th>Granja</th><th>Departamento</th><th style={{ textAlign: "right" }}>Madres</th><th style={{ width: 180 }}>Estado</th><th style={{ textAlign: "right" }}>Partos</th><th style={{ textAlign: "right" }}>Nac. vivos/parto</th><th style={{ textAlign: "right" }}>Destet./cerda/año</th><th style={{ textAlign: "right" }}>Mort. predestete</th><th style={{ textAlign: "right" }}>DNP/cerda/año</th><th style={{ textAlign: "right" }}>Paradas hoy</th><th style={{ textAlign: "right" }}>Pérdida del año</th></tr></thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id}>
                <td style={{ fontWeight: 500 }}>{f.nombre}</td><td>{f.departamento}</td><td style={{ textAlign: "right" }}>{f.madres}</td>
                <td>
                  <div style={{ display: "flex", height: 12, gap: 2, borderRadius: 3, overflow: "hidden" }} title={ESTADOS.map(([k, l]) => `${l}: ${f.estados[k]}`).join(" · ")}>
                    {ESTADOS.map(([k, , c]) => f.estados[k] > 0 && <div key={k} style={{ flex: f.estados[k], background: c, opacity: 0.55 }} />)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ESTADOS.filter(([k]) => f.estados[k]).map(([k, l]) => `${l} ${f.estados[k]}`).join(" · ")}</div>
                </td>
                <td style={{ textAlign: "right" }}>{f.partos12}</td><td style={{ textAlign: "right" }}>{n(f.nacidosVivosParto)}</td>
                <td style={{ textAlign: "right" }}>{n(f.destetadosCerdaAnio)}</td><td style={{ textAlign: "right" }}>{f.mortalidadPredestete === null ? "—" : `${n(f.mortalidadPredestete * 100)} %`}</td>
                <td style={{ textAlign: "right" }}>{n(f.dnpCerdaAnio, 0)}</td>
                <td style={{ textAlign: "right" }}>{f.paradasHoy}{f.paradasHoy > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{gs(f.perdidaDiaGs)}/día</div>}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.perdidaAnioGs)}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={11} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Ninguna granja tiene madres cargadas.</td></tr>}
          </tbody>
        </table>
      </div>
      {deptos.length > 0 && (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <table className="kp-table">
            <thead><tr><th>Departamento</th><th style={{ textAlign: "right" }}>Granjas</th><th style={{ textAlign: "right" }}>Madres</th><th style={{ textAlign: "right" }}>Cerdas paradas hoy</th><th style={{ textAlign: "right" }}>Pérdida del año</th></tr></thead>
            <tbody>{deptos.map(d => <tr key={d.d}><td>{d.d}</td><td style={{ textAlign: "right" }}>{d.granjas}</td><td style={{ textAlign: "right" }}>{d.madres}</td><td style={{ textAlign: "right" }}>{d.paradas}</td><td style={{ textAlign: "right" }}>{gs(d.perdida)}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
