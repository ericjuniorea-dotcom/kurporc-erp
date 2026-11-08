import prisma from "@/lib/db/prisma";
import { puede } from "@/lib/permisos/servidor";
import { paginaFinanzas, corteDelAnio } from "@/lib/finanzas/pagina";
import { semaforoDesvio } from "@/lib/finanzas/planificacion";
import { gs, nombreMes } from "@/lib/finanzas/calculos";
import { SelectorAnio, anioDe } from "../tabla-mensual";
import { CampoCausa } from "./causa";

export const metadata = { title: "Presupuesto contra real · Finanzas · KurPorc" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };
const COLOR: Record<string, string> = { OK: "var(--success-text)", "ATENCIÓN": "var(--warning-text)", EXPLICAR: "var(--danger-text)", "–": "var(--text-muted)" };
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("es-PY", { maximumFractionDigits: 1 })} %`);

export default async function PresupuestoVsReal({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, permisos, mesCorte } = await paginaFinanzas("finanzas.presupuesto_real.ver");
  const anio = anioDe(await searchParams);
  const corte = corteDelAnio(anio, mesCorte);
  const desde = anio * 100 + 1;
  const [params, pres, real, causas, cats] = await Promise.all([
    prisma.parametrosFinancieros.findUnique({ where: { organizacionId: org } }),
    prisma.presupuesto.groupBy({ by: ["categoriaId", "mes"], where: { organizacionId: org, mes: { gte: desde, lte: corte } }, _sum: { montoGs: true } }),
    prisma.movimiento.groupBy({ by: ["categoriaId", "mes"], where: { organizacionId: org, estado: { not: "ANULADO" }, esInterno: false, tipo: { in: ["GASTO", "INVERSION"] }, mes: { gte: desde, lte: corte } }, _sum: { montoGs: true } }),
    prisma.causaDesvio.findMany({ where: { organizacionId: org, mes: corte } }),
    prisma.categoriaFinanciera.findMany({ where: { OR: [{ organizacionId: null }, { organizacionId: org }], tipo: { in: ["GASTO", "INVERSION"] } }, orderBy: { orden: "asc" }, select: { id: true, nombre: true, tipo: true } }),
  ]);
  const meta = Number(params?.metaDesvio ?? 0.05), alerta = Number(params?.alertaDesvio ?? 0.1);
  const suma = (xs: typeof pres, cat: string, soloMes?: number) => xs.filter(x => x.categoriaId === cat && (soloMes === undefined || x.mes === soloMes)).reduce((s, x) => s + (x._sum.montoGs ?? 0n), 0n);
  const filas = cats.map(c => {
    const pA = suma(pres, c.id), rA = suma(real, c.id), pM = suma(pres, c.id, corte), rM = suma(real, c.id, corte);
    return { ...c, pA, rA, pM, rM, acum: semaforoDesvio(pA, rA, meta, alerta), delMes: semaforoDesvio(pM, rM, meta, alerta), causa: causas.find(x => x.categoriaId === c.id)?.causa ?? "" };
  }).filter(f => f.pA > 0n || f.rA > 0n);
  const sinCausa = filas.filter(f => f.acum.semaforo === "EXPLICAR" && !f.causa).length;
  const escribe = puede(permisos, "finanzas.presupuesto_real.escribir_causa");

  return (
    <>
      <SelectorAnio anio={anio} base="/finanzas/presupuesto-vs-real" />
      <div style={{ fontSize: 12, color: sinCausa ? "var(--danger-text)" : "var(--text-muted)" }}>
        Acumulado de enero a {nombreMes(corte)}. Diferencia positiva = se gastó más de lo presupuestado. OK ≤ {pct(meta)} · Atención ≤ {pct(alerta)} · Explicar &gt; {pct(alerta)}.
        {sinCausa > 0 && ` Hay ${sinCausa} desvío(s) para explicar: sin la causa escrita el mes no se puede cerrar.`}
      </div>
      <div style={{ ...tarjeta, overflowX: "auto" }}>
        <table className="kp-table" style={{ minWidth: 1150 }}>
          <thead>
            <tr><th>Categoría</th><th style={{ textAlign: "right" }}>Presup. acum.</th><th style={{ textAlign: "right" }}>Real acum.</th><th style={{ textAlign: "right" }}>Diferencia</th><th style={{ textAlign: "right" }}>Desvío</th><th>Estado</th>
              <th style={{ textAlign: "right" }}>Presup. mes</th><th style={{ textAlign: "right" }}>Real mes</th><th style={{ textAlign: "right" }}>Desvío mes</th><th style={{ minWidth: 220 }}>Causa del desvío</th></tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id}>
                <td style={{ color: "var(--text-primary)" }}>{f.nombre}{f.tipo === "INVERSION" && <span style={{ fontSize: 10.5, color: "var(--text-muted)" }}> · inversión</span>}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.pA)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.rA)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: f.acum.diferencia > 0n ? "var(--danger-text)" : undefined }}>{gs(f.acum.diferencia)}</td>
                <td style={{ textAlign: "right" }}>{pct(f.acum.desvio)}</td>
                <td style={{ color: COLOR[f.acum.semaforo], fontWeight: 500, fontSize: 11.5 }}>{f.acum.semaforo}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.pM)}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{gs(f.rM)}</td>
                <td style={{ textAlign: "right", color: COLOR[f.delMes.semaforo] }}>{pct(f.delMes.desvio)}</td>
                <td>{f.acum.semaforo === "EXPLICAR" || f.causa ? <CampoCausa categoriaId={f.id} mes={corte} inicial={f.causa} editable={escribe} /> : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
              </tr>
            ))}
            {filas.length === 0 && <tr><td colSpan={10} style={{ padding: 16, color: "var(--text-muted)" }}>Sin presupuesto ni gastos en {anio}. Cargá el presupuesto para ver los desvíos.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
