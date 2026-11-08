import { datosAnio } from "@/lib/finanzas/anio";
import { hojaFijosVariables } from "@/lib/finanzas/hojas";
import { corteDelAnio, paginaFinanzas } from "@/lib/finanzas/pagina";
import { SelectorAnio, TablaMensual, anioDe, fmt } from "../tabla-mensual";

export const metadata = { title: "Fijos y variables · Finanzas · KurPorc" };
const NAT: Record<string, string> = { FIJO: "Fijo", VARIABLE: "Variable", NO_APLICA: "–" };

export default async function FijosVariables({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, mesCorte } = await paginaFinanzas("finanzas.fijos_variables.ver");
  const anio = anioDe(await searchParams);
  const corte = corteDelAnio(anio, mesCorte);
  const { movs } = await datosAnio(org, anio);
  const h = hojaFijosVariables(movs, corte);
  const pct = (a: bigint, b: bigint) => (b > 0n ? Number(a) / Number(b) : null);
  const sumaF = h.fijos.reduce((s, x) => s + x, 0n), sumaV = h.variables.reduce((s, x) => s + x, 0n);
  return (
    <>
      <SelectorAnio anio={anio} base="/finanzas/fijos-variables" />
      <TablaMensual titulo={`Gastos fijos y variables ${anio}`} mesCorte={corte} filas={[
        { etiqueta: "Gastos fijos", valores: h.fijos, total: sumaF, formato: "gs" },
        { etiqueta: "Gastos variables", valores: h.variables, total: sumaV, formato: "gs" },
        { etiqueta: "Total", valores: h.total, total: h.totalAnio, formato: "gs", nivel: "total" },
        { etiqueta: "% fijos", valores: h.fijos.map((f, i) => pct(f, h.total[i])), total: pct(sumaF, h.totalAnio), formato: "pct" },
        { etiqueta: "% variables", valores: h.variables.map((v, i) => pct(v, h.total[i])), total: pct(sumaV, h.totalAnio), formato: "pct" },
        { etiqueta: "Acumulado del año", valores: h.acumulado, total: h.totalAnio, formato: "gs" },
      ]} />
      <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Detalle por categoría</div>
        <table className="kp-table" style={{ minWidth: 700 }}>
          <thead><tr><th>Categoría</th><th>Naturaleza</th><th>Área</th><th style={{ textAlign: "right" }}>Acumulado del año</th><th style={{ textAlign: "right" }}>% del gasto</th><th style={{ textAlign: "right" }}>Promedio mensual</th></tr></thead>
          <tbody>
            {h.detalle.map(c => (
              <tr key={c.nombre}>
                <td style={{ color: "var(--text-primary)" }}>{c.nombre}</td><td>{NAT[c.naturaleza]}</td><td>{c.area}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.total)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.pct, "pct")}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.promedioMensual)}</td>
              </tr>
            ))}
            {h.detalle.length === 0 && <tr><td colSpan={6} style={{ padding: 16, color: "var(--text-muted)" }}>Sin gastos en {anio}.</td></tr>}
          </tbody>
        </table>
        <div style={{ padding: "8px 14px 12px", fontSize: 11, color: "var(--text-muted)" }}>Promedio mensual = acumulado ÷ meses transcurridos hasta el corte ({corte % 100}).</div>
      </div>
    </>
  );
}
