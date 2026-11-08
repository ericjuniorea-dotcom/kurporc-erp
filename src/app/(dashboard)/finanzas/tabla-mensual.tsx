// Tabla de 12 meses + total (sirve a todas las hojas de Finanzas). Componente de servidor, sin estado.
import Link from "next/link";
import { gs } from "@/lib/finanzas/calculos";

export type Formato = "gs" | "num" | "kg" | "pct" | "dec";
export type Fila = {
  etiqueta: string; valores: (bigint | number | null)[]; total?: bigint | number | null;
  formato?: Formato; nivel?: "normal" | "sub" | "total" | "titulo"; nota?: string;
};
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function fmt(v: bigint | number | null | undefined, f: Formato = "gs", vacio = "—"): string {
  if (v === null || v === undefined) return vacio;
  if (f === "gs") return gs(typeof v === "number" ? Math.round(v) : v);
  const n = Number(v);
  if (f === "pct") return `${(n * 100).toLocaleString("es-PY", { maximumFractionDigits: 1 })} %`;
  if (f === "kg") return `${n.toLocaleString("es-PY", { maximumFractionDigits: 0 })} kg`;
  if (f === "dec") return n.toLocaleString("es-PY", { maximumFractionDigits: 2 });
  return n.toLocaleString("es-PY", { maximumFractionDigits: 0 });
}

export function TablaMensual({ titulo, filas, mesCorte, columnaTotal = "Año", nota }: {
  titulo?: string; filas: Fila[]; mesCorte?: number; columnaTotal?: string; nota?: string;
}) {
  const corte = mesCorte ? (mesCorte % 100) - 1 : 11;
  return (
    <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", overflowX: "auto" }}>
      {titulo && <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{titulo}</div>}
      <table className="kp-table" style={{ minWidth: 1100 }}>
        <thead>
          <tr>
            <th style={{ position: "sticky", left: 0, background: "var(--bg-surface)", minWidth: 210 }}></th>
            {MESES.map((m, i) => <th key={m} style={{ textAlign: "right", color: i > corte ? "var(--text-muted)" : undefined }}>{m}</th>)}
            <th style={{ textAlign: "right" }}>{columnaTotal}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, k) => {
            if (f.nivel === "titulo") {
              return <tr key={k}><td colSpan={14} style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", paddingTop: 12 }}>{f.etiqueta}</td></tr>;
            }
            const fuerte = f.nivel === "sub" || f.nivel === "total";
            return (
              <tr key={k} style={{ background: f.nivel === "total" ? "var(--bg-elevated)" : undefined }}>
                <td style={{ position: "sticky", left: 0, background: f.nivel === "total" ? "var(--bg-elevated)" : "var(--bg-surface)", color: "var(--text-primary)", fontWeight: fuerte ? 600 : 400 }} title={f.nota}>
                  {f.etiqueta}
                </td>
                {f.valores.map((v, i) => (
                  <td key={i} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: fuerte ? 600 : 400, color: i > corte ? "var(--text-muted)" : undefined }}>
                    {fmt(v, f.formato)}
                  </td>
                ))}
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", fontWeight: 600 }}>{fmt(f.total ?? null, f.formato)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {nota && <div style={{ padding: "8px 14px 12px", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{nota}</div>}
    </div>
  );
}

/** Selector de año como enlaces (sin JavaScript). */
export function SelectorAnio({ anio, base, desde = 2024 }: { anio: number; base: string; desde?: number }) {
  const actual = new Date().getUTCFullYear();
  const anios = Array.from({ length: actual - desde + 2 }, (_, i) => desde + i).reverse();
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Año:</span>
      {anios.map(a => (
        <Link key={a} href={`${base}?anio=${a}`} className="btn" style={{ height: 28, fontSize: 12, borderColor: a === anio ? "var(--accent)" : undefined, color: a === anio ? "var(--accent-text)" : undefined }}>{a}</Link>
      ))}
    </div>
  );
}

export function anioDe(sp: Record<string, string | undefined>): number {
  const a = Number(sp.anio);
  const actual = new Date().getUTCFullYear();
  return Number.isInteger(a) && a >= 2000 && a <= actual + 1 ? a : actual;
}
