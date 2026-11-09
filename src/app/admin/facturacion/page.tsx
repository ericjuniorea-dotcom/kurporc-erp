// Ranking de granjas por facturación (ventas confirmadas de Finanzas). Cada visita queda registrada.
import { requireAdmin, registrarAcceso } from "@/lib/admin/acceso";
import { facturacionGranjas, IVA_ANIMALES } from "@/lib/admin/produccion";
import { gs, nombreMes } from "@/lib/finanzas/calculos";

const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const derecha: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

export default async function FacturacionAdmin() {
  const a = await requireAdmin(["TOTAL", "SOPORTE"]);
  const { meses, filas, totalPorMes } = await facturacionGranjas();
  await registrarAcceso({ adminId: a.usuario.id, organizacionId: null, seccion: "/admin/facturacion", motivo: "ESTADISTICA", filas: filas.length });
  const total = totalPorMes.reduce((s, x) => s + x, 0);
  return (
    <>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        Ventas confirmadas de los últimos 12 meses. «Sin IVA» descuenta el {IVA_ANIMALES * 100} % de animales vivos; costo y margen por lechón: meses con ventas del año en curso, con la hoja de costos de cada granja.
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 1200 }}>
          <thead><tr><th>Granja</th>{meses.map(m => <th key={m} style={derecha}>{nombreMes(m).slice(0, 3)}</th>)}<th style={derecha}>Total</th><th style={derecha}>Sin IVA</th><th style={derecha}>Lechones</th><th style={derecha}>Precio prom.</th><th style={derecha}>Costo/lechón</th><th style={derecha}>Margen</th></tr></thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id}>
                <td style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{f.nombre}<div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{f.departamento}</div></td>
                {f.porMes.map((v, i) => <td key={i} style={{ ...derecha, color: v ? "var(--text-primary)" : "var(--text-muted)" }}>{v ? gs(v) : "—"}</td>)}
                <td style={{ ...derecha, fontWeight: 500 }}>{gs(f.total)}</td><td style={derecha}>{gs(Math.round(f.sinIva))}</td><td style={derecha}>{f.lechones}</td>
                <td style={derecha}>{f.precio === null ? "—" : gs(Math.round(f.precio))}</td><td style={derecha}>{f.costoLechon === null ? "—" : gs(Math.round(f.costoLechon))}</td>
                <td style={{ ...derecha, color: f.margen !== null && f.margen < 0 ? "var(--danger-text)" : undefined }}>{f.margen === null ? "—" : gs(Math.round(f.margen))}</td>
              </tr>
            ))}
            {filas.length === 0 ? <tr><td colSpan={meses.length + 7} style={{ padding: 20, textAlign: "center", color: "var(--text-muted)" }}>Todavía no hay ventas confirmadas.</td></tr> : (
              <tr style={{ fontWeight: 600 }}><td>Plataforma</td>{totalPorMes.map((v, i) => <td key={i} style={derecha}>{v ? gs(v) : "—"}</td>)}<td style={derecha}>{gs(total)}</td><td style={derecha}>{gs(Math.round(total / (1 + IVA_ANIMALES)))}</td><td style={derecha}>{filas.reduce((s, f) => s + f.lechones, 0)}</td><td colSpan={3}></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
