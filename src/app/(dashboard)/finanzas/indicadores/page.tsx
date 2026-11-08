import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { indicadores, type Indicador } from "@/lib/finanzas/control";
import { gs } from "@/lib/finanzas/calculos";

export const metadata = { title: "Indicadores · Finanzas · KurPorc" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflowX: "auto" };
const ESTADO = { ok: ["✓ En la meta", "var(--success-text)"], atencion: ["! Atención", "var(--warning-text)"], mal: ["✗ Actuar", "var(--danger-text)"] } as const;

function Grupo({ titulo, filas }: { titulo: string; filas: Indicador[] }) {
  return (
    <div style={tarjeta}>
      <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{titulo}</div>
      <table className="kp-table" style={{ minWidth: 760 }}>
        <thead><tr><th>Indicador</th><th>Cómo se calcula</th><th style={{ textAlign: "right" }}>Valor</th><th>Meta</th><th>Estado</th></tr></thead>
        <tbody>
          {filas.map(f => (
            <tr key={f.nombre}>
              <td style={{ color: "var(--text-primary)" }}>{f.nombre}</td>
              <td style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{f.calculo}</td>
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, whiteSpace: "nowrap" }}>{f.valor}</td>
              <td style={{ fontSize: 11.5 }}>{f.meta ?? "—"}</td>
              <td style={{ fontSize: 11.5, color: f.estado ? ESTADO[f.estado][1] : "var(--text-muted)", whiteSpace: "nowrap" }}>{f.estado ? ESTADO[f.estado][0] : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function IndicadoresPage() {
  const { org } = await paginaFinanzas("finanzas.indicadores.ver");
  const r = await indicadores(org);
  return (
    <>
      <Grupo titulo="1 · Operación" filas={r.operacion} />
      <Grupo titulo="2 · Producción, alimentación y margen (mes en curso)" filas={r.produccion} />
      <Grupo titulo="3 · Caja, deuda y liquidez" filas={r.caja} />
      <Grupo titulo="4 · Retorno de la inversión (separado de la operación diaria)" filas={r.retorno} />
      <div style={{ ...tarjeta, padding: 14, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        Flujos usados: {r.flujos.map((f, i) => `año ${i}: ${gs(Math.round(f))}`).join(" · ")}.
        {r.notaTir && " Si el año 1 da negativo, la TIR no se puede calcular: no es un error, es el estado real del negocio hoy."}
      </div>
    </>
  );
}
