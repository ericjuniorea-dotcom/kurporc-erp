import prisma from "@/lib/db/prisma";
import { datosAnio, sanidadAnio } from "@/lib/finanzas/anio";
import { hojaCostos, sumaB, sumaN } from "@/lib/finanzas/hojas";
import { corteDelAnio, paginaFinanzas } from "@/lib/finanzas/pagina";
import { flujoReal, mesDeFecha } from "@/lib/finanzas/planificacion";
import { gs } from "@/lib/finanzas/calculos";
import { SelectorAnio, TablaMensual, anioDe } from "../tabla-mensual";

export const metadata = { title: "Análisis del año · Finanzas · KurPorc" };

export default async function AnalisisPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, mesCorte } = await paginaFinanzas("finanzas.indicadores.ver");
  const anio = anioDe(await searchParams);
  const corte = corteDelAnio(anio, mesCorte);
  const [d, san, pagos, cuentas] = await Promise.all([
    datosAnio(org, anio), sanidadAnio(org, anio),
    prisma.pagoMovimiento.findMany({ where: { movimiento: { organizacionId: org, estado: { not: "ANULADO" } } }, select: { fechaPago: true, montoGs: true, movimiento: { select: { signo: true, tipo: true, esInterno: true, categoria: { select: { nombre: true } } } } } }),
    prisma.cuentaFondos.aggregate({ where: { organizacionId: org }, _sum: { saldoInicialGs: true } }),
  ]);
  const c = hojaCostos(d.movs, d.inversiones, d.prod, d.matricesPorMes, d.params, anio, san.usadoPorMes, corte);
  const meses = Array.from({ length: 12 }, (_, i) => anio * 100 + i + 1);
  const porMes = (f: (m: (typeof d.movs)[number]) => boolean) => meses.map(mes => d.movs.filter(m => m.mes === mes && !m.esInterno && f(m)).reduce((s, m) => s + m.montoGs, 0n));
  const ingresos = porMes(m => m.tipo === "INGRESO");
  const balanceado = porMes(m => m.tipo === "GASTO" && m.categoria.grupoCosto === "ALIMENTACION");
  const resto = porMes(m => m.tipo === "GASTO" && m.categoria.grupoCosto !== "ALIMENTACION");
  const inversion = porMes(m => m.tipo === "INVERSION");
  const deuda = porMes(m => m.tipo === "FINANCIAMIENTO" && m.categoria.nombre === "Pago de cuota de préstamo");
  const lista = pagos.map(p => ({ fechaPago: p.fechaPago, montoGs: p.montoGs, signo: p.movimiento.signo, tipo: p.movimiento.tipo, categoria: p.movimiento.categoria.nombre, esInterno: p.movimiento.esInterno }));
  const primero = lista.length ? Math.min(...lista.map(p => mesDeFecha(p.fechaPago))) : anio * 100 + 1;
  const flujo = flujoReal(lista, Math.min(primero, anio * 100 + 1), anio * 100 + 12, cuentas._sum.saldoInicialGs ?? 0n).filter(m => Math.floor(m.mes / 100) === anio);
  // Distribución del gasto operativo del año por categoría
  const cats = new Map<string, bigint>();
  for (const m of d.movs) if (m.tipo === "GASTO" && !m.esInterno) cats.set(m.categoria.nombre, (cats.get(m.categoria.nombre) ?? 0n) + m.montoGs);
  const dist = Array.from(cats.entries()).sort((a, b) => (b[1] > a[1] ? 1 : -1));
  const totalGasto = dist.reduce((s, [, v]) => s + v, 0n);
  const max = dist[0]?.[1] ?? 0n;

  return (
    <>
      <SelectorAnio anio={anio} base="/finanzas/analisis" />
      <TablaMensual titulo={`Análisis ${anio}`} mesCorte={corte} filas={[
        { etiqueta: "Ingresos", valores: ingresos, total: sumaB(ingresos), formato: "gs" },
        { etiqueta: "Gastos de la granja sin balanceado", valores: resto, total: sumaB(resto), formato: "gs" },
        { etiqueta: "Balanceado", valores: balanceado, total: sumaB(balanceado), formato: "gs" },
        { etiqueta: "Inversión", valores: inversion, total: sumaB(inversion), formato: "gs" },
        { etiqueta: "Pago de deuda", valores: deuda, total: sumaB(deuda), formato: "gs" },
        { etiqueta: "Flujo del mes (real)", valores: flujo.map(m => m.flujoNeto), total: sumaB(flujo.map(m => m.flujoNeto)), formato: "gs", nivel: "sub" },
        { etiqueta: "Saldo de caja", valores: flujo.map(m => m.saldoFinal), total: flujo.at(-1)?.saldoFinal ?? null, formato: "gs" },
        { etiqueta: "Lechones entregados", valores: d.prod.map(p => p.entregados), total: sumaN(d.prod.map(p => p.entregados)), formato: "num" },
        { etiqueta: "Costo por lechón", valores: c.unit.costoPorEntregado, total: null, formato: "gs" },
        { etiqueta: "Precio por lechón", valores: c.unit.precioPromedio, total: null, formato: "gs" },
      ]} />
      <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 10 }}>Distribución del gasto operativo de {anio}</div>
        {dist.length === 0 ? <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin gastos en {anio}.</div> : (
          <table className="kp-table">
            <tbody>
              {dist.map(([nombre, v]) => (
                <tr key={nombre} title={`${nombre}: ${gs(v)}`}>
                  <td style={{ color: "var(--text-primary)", width: 220 }}>{nombre}</td>
                  <td aria-hidden><div style={{ height: 8, borderRadius: 4, background: "var(--accent)", opacity: 0.85, width: max > 0n ? `${Math.max(1, Number((v * 1000n) / max) / 10)}%` : 0 }} /></td>
                  <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{gs(v)}</td>
                  <td style={{ textAlign: "right", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{totalGasto > 0n ? `${(Number(v) * 100 / Number(totalGasto)).toLocaleString("es-PY", { maximumFractionDigits: 1 })} %` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
