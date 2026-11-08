import prisma from "@/lib/db/prisma";
import { paginaFinanzas } from "@/lib/finanzas/pagina";
import { gs } from "@/lib/finanzas/calculos";

export const metadata = { title: "Inversiones · Finanzas · KurPorc" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export default async function InversionesPage() {
  const { org, corte } = await paginaFinanzas("finanzas.inversiones.ver");
  const [movs, params, matricesHoy, unidades] = await Promise.all([
    prisma.movimiento.findMany({
      where: { organizacionId: org, tipo: "INVERSION", estado: { not: "ANULADO" } }, orderBy: { fecha: "asc" },
      select: { id: true, fecha: true, concepto: true, subcategoria: true, montoGs: true, cantidad: true, unidadId: true, categoria: { select: { nombre: true, vidaUtil: true } } },
    }),
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.sow.count({ where: { tenantId: org, isActive: true } }),
    prisma.unidadNegocio.findMany({ where: { organizacionId: org }, select: { id: true, tipo: true, nombre: true } }),
  ]);
  const tipoUnidad = new Map(unidades.map(u => [u.id, u.tipo]));
  const historica = (m: (typeof movs)[number]) => m.fecha.getTime() <= corte.getTime();
  const grupos = new Map<string, { categoria: string; detalle: string; hist: bigint; nueva: bigint }>();
  for (const m of movs) {
    const k = `${m.categoria.nombre}|${m.subcategoria ?? ""}`;
    const g = grupos.get(k) ?? { categoria: m.categoria.nombre, detalle: m.subcategoria ?? "—", hist: 0n, nueva: 0n };
    if (historica(m)) g.hist += m.montoGs; else g.nueva += m.montoGs;
    grupos.set(k, g);
  }
  const filas = Array.from(grupos.values()).sort((a, b) => a.categoria.localeCompare(b.categoria));
  const total = movs.reduce((s, m) => s + m.montoGs, 0n);
  const hist = movs.filter(historica).reduce((s, m) => s + m.montoGs, 0n);
  const granja = movs.filter(m => tipoUnidad.get(m.unidadId) === "GRANJA").reduce((s, m) => s + m.montoGs, 0n);
  const matrices = params?.matricesActivasManual ?? matricesHoy;
  const pct = (v: bigint) => (total > 0n ? `${(Number(v) * 100 / Number(total)).toLocaleString("es-PY", { maximumFractionDigits: 1 })} %` : "—");

  // Fichas de activo (amortización por activo): valor, vida, amortización acumulada al corte, valor neto
  const vida = (v: string | null) => v === "OBRA" ? (params?.vidaObraAnios ?? 20) * 12 : v === "EQUIPOS" ? (params?.vidaEquiposAnios ?? 10) * 12 : v === "MATRIZ" && params?.amortizarMatrices ? (params?.vidaMatrizMeses ?? 36) : 0;
  const mesesHasta = (f: Date) => Math.max(0, (corte.getUTCFullYear() - f.getUTCFullYear()) * 12 + corte.getUTCMonth() - f.getUTCMonth());
  const fichas = movs.filter(historica).map(m => {
    const v = vida(m.categoria.vidaUtil);
    const acumulada = v ? (m.montoGs * BigInt(Math.min(v, mesesHasta(m.fecha)))) / BigInt(v) : 0n;
    return { ...m, vidaMeses: v, acumulada, neto: m.montoGs - acumulada };
  });

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {([["Inversión histórica", gs(hist)], ["Nueva (prevista)", gs(total - hist)], ["Total", gs(total)], ["De la granja", gs(granja)], ["Común (terreno, electricidad, vehículos)", gs(total - granja)],
          ["Inversión por matriz", matrices ? gs(Number(total) / matrices) : "—"]] as const).map(([t, v]) => (
          <div key={t} style={{ ...tarjeta, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>¿Cuánto costó poner en marcha la granja?</div>
        <table className="kp-table" style={{ minWidth: 700 }}>
          <thead><tr><th>Categoría</th><th>Detalle</th><th style={{ textAlign: "right" }}>Histórica</th><th style={{ textAlign: "right" }}>Nueva</th><th style={{ textAlign: "right" }}>Total</th><th style={{ textAlign: "right" }}>%</th></tr></thead>
          <tbody>
            {filas.map(f => (
              <tr key={`${f.categoria}|${f.detalle}`}>
                <td style={{ color: "var(--text-primary)" }}>{f.categoria}</td><td>{f.detalle}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.hist)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.nueva)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{gs(f.hist + f.nueva)}</td>
                <td style={{ textAlign: "right" }}>{pct(f.hist + f.nueva)}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={6} style={{ padding: 16, color: "var(--text-muted)" }}>Sin inversiones cargadas. Se cargan en Movimientos con tipo «Inversión».</td></tr>}
          </tbody>
        </table>
      </div>
      {fichas.length > 0 && (
        <div style={{ ...tarjeta, overflowX: "auto" }}>
          <div style={{ padding: "12px 14px 4px", fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>Fichas de activo</div>
          <table className="kp-table" style={{ minWidth: 800 }}>
            <thead><tr><th>Fecha</th><th>Activo</th><th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>Vida útil</th><th style={{ textAlign: "right" }}>Amortización acumulada</th><th style={{ textAlign: "right" }}>Valor neto</th></tr></thead>
            <tbody>
              {fichas.map(f => (
                <tr key={f.id}>
                  <td>{f.fecha.toISOString().slice(0, 10).split("-").reverse().join("/")}</td>
                  <td><div style={{ color: "var(--text-primary)" }}>{f.concepto}</div><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{f.categoria.nombre}</div></td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.montoGs)}</td>
                  <td style={{ textAlign: "right" }}>{f.vidaMeses ? `${f.vidaMeses / 12} años` : "No se amortiza"}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.acumulada)}</td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{gs(f.neto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
