import { sanidadAnio } from "@/lib/finanzas/anio";
import { sumaB } from "@/lib/finanzas/hojas";
import { corteDelAnio, paginaFinanzas } from "@/lib/finanzas/pagina";
import { SelectorAnio, TablaMensual, anioDe, fmt } from "../tabla-mensual";

export const metadata = { title: "Sanidad valorizada · Finanzas · KurPorc" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const COLOR: Record<string, string> = { OK: "var(--success-text)", "Revisar: no cierra": "var(--danger-text)" };

export default async function SanidadFinanzas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, mesCorte } = await paginaFinanzas("finanzas.sanidad_valorizada.ver");
  const anio = anioDe(await searchParams);
  const { filas, usadoPorMes, comprasPorMes } = await sanidadAnio(org, anio);
  const tot = (f: (x: (typeof filas)[number]) => bigint | null) => filas.reduce((s, x) => s + (f(x) ?? 0n), 0n);
  const ml = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("es-PY", { maximumFractionDigits: 1 })} ml`);
  return (
    <>
      <SelectorAnio anio={anio} base="/finanzas/sanidad" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
        {[["Comprado en el año", tot(x => x.compradoGs)], ["Costo de lo usado", tot(x => x.costoUsadoGs)], ["Valor del stock", tot(x => x.valorStockGs)]].map(([t, v]) => (
          <div key={t as string} style={{ ...tarjeta, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t as string}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{fmt(v as bigint)}</div>
          </div>
        ))}
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Por producto</div>
        <table className="kp-table" style={{ minWidth: 1000 }}>
          <thead><tr><th>Producto</th><th style={{ textAlign: "right" }}>Comprado</th><th style={{ textAlign: "right" }}>Precio por ml</th><th style={{ textAlign: "right" }}>Usado</th><th style={{ textAlign: "right" }}>Costo de lo usado</th><th style={{ textAlign: "right" }}>Stock</th><th style={{ textAlign: "right" }}>Valor del stock</th><th>Estado</th></tr></thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id}>
                <td><div style={{ color: "var(--text-primary)" }}>{f.nombre}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.tipo === "VACUNA" ? "Vacuna" : "Medicamento"}</div></td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(f.compradoGs)}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ml(f.compradoMl)}</div></td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{f.precioMl === null ? "—" : fmt(Math.round(f.precioMl))}<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.compradoMl > 0 ? "promedio pagado" : f.precioMl !== null ? "precio de lista" : ""}</div></td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ml(f.usadoMl)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(f.costoUsadoGs)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{ml(f.stockMl)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(f.valorStockGs)}</td>
                <td style={{ fontSize: 11.5, color: COLOR[f.estado] ?? "var(--warning-text)" }}>{f.estado}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={8} style={{ padding: 16, color: "var(--text-muted)" }}>Sin compras ni uso de vacunas o medicamentos en {anio}. Al cargar una compra de Sanidad en Movimientos, elegí el producto y los ml por frasco.</td></tr>}
          </tbody>
        </table>
        <div style={{ padding: "8px 14px 12px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Precio por ml = lo pagado en el año ÷ ml comprados; si no hubo compra, el costo cargado en el lote (precio de lista). Lo usado sale de las aplicaciones registradas en Sanidad; el stock, de los lotes del botiquín.
        </div>
      </div>
      <TablaMensual titulo="Mes a mes" mesCorte={corteDelAnio(anio, mesCorte)} filas={[
        { etiqueta: "Compras de vacunas y medicamentos", valores: comprasPorMes, total: sumaB(comprasPorMes), formato: "gs" },
        { etiqueta: "Costo de lo usado", valores: usadoPorMes, total: sumaB(usadoPorMes), formato: "gs" },
      ]} />
    </>
  );
}
