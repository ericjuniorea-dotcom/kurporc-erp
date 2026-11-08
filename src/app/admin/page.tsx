import { requireAdmin } from "@/lib/admin/acceso";
import { resumenPlataforma } from "@/lib/admin/datos";
import { gs, hoyUTC, mesDe, nombreMes } from "@/lib/finanzas/calculos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const TIPOS: Record<string, string> = { EMPRESA: "Granjas (empresa)", INDIVIDUAL: "Granjas (productor)", VENDEDOR: "Tiendas" };

function Tile({ titulo, valor, detalle, alerta }: { titulo: string; valor: string | number; detalle?: string; alerta?: boolean }) {
  return (
    <div style={{ ...tarjeta, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: alerta ? "var(--danger-text)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{valor}</div>
      {detalle && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{detalle}</div>}
    </div>
  );
}

export default async function ResumenAdmin() {
  await requireAdmin();
  const r = await resumenPlataforma();
  const mes = mesDe(hoyUTC());
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        <Tile titulo="Usuarios" valor={r.usuarios} detalle={`${r.nuevos7} nuevos en 7 días`} />
        <Tile titulo="Activos" valor={r.activos7} detalle={`Hoy ${r.activosHoy} · en 30 días ${r.activos30}`} />
        {Object.entries(TIPOS).map(([k, t]) => <Tile key={k} titulo={t} valor={r.orgsPorTipo[k] ?? 0} />)}
        <Tile titulo="Granjas activas" valor={r.granjas} detalle={`${r.madres.toLocaleString("es-PY")} madres en total`} />
        <Tile titulo={`Ingresos registrados · ${nombreMes(mes)}`} valor={gs(r.ingresosMesGs)} detalle="Suma de todas las organizaciones" />
        <Tile titulo="Solicitudes de privacidad abiertas" valor={r.privacidad} alerta={r.privacidad > 0} detalle="Plazo: 30 días" />
        <Tile titulo="Incidentes de seguridad abiertos" valor={r.incidentes} alerta={r.incidentes > 0} detalle="Plazo de aviso: 72 h" />
        <Tile titulo="Ingresos fallidos (24 h)" valor={r.fallidos24} alerta={r.fallidos24 > 20} />
      </div>
      <div style={{ ...tarjeta, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>Altas de los últimos 30 días</div>
        {r.altasPorDia.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Nadie se registró en los últimos 30 días.</div>
        ) : (
          <table className="kp-table">
            <thead><tr><th>Día</th><th style={{ textAlign: "right" }}>Cuentas nuevas</th></tr></thead>
            <tbody>
              {r.altasPorDia.map(([dia, n]) => (
                <tr key={dia}><td>{dia.slice(8, 10)}/{dia.slice(5, 7)}/{dia.slice(0, 4)}</td><td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{n}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
