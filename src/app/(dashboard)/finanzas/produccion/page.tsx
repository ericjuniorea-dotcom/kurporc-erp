import prisma from "@/lib/db/prisma";
import { datosAnio } from "@/lib/finanzas/anio";
import { div, sumaN } from "@/lib/finanzas/hojas";
import { corteDelAnio, paginaFinanzas } from "@/lib/finanzas/pagina";
import { SelectorAnio, TablaMensual, anioDe, type Fila } from "../tabla-mensual";

export const metadata = { title: "Producción · Finanzas · KurPorc" };
const tarjeta: React.CSSProperties = { background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)" };

export default async function ProduccionFinanzas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, mesCorte } = await paginaFinanzas("finanzas.costos.ver");
  const anio = anioDe(await searchParams);
  const corte = corteDelAnio(anio, mesCorte);
  const [{ prod, matricesHoy }, machos, enMaternidad, enDestete] = await Promise.all([
    datosAnio(org, anio),
    prisma.boar.count({ where: { tenantId: org, isActive: true } }),
    prisma.farrowingEvent.findMany({ where: { tenantId: org, weaning: null }, select: { bornAlive: true, deaths: { select: { quantity: true } } } }),
    prisma.nurseryBatch.aggregate({ where: { tenantId: org, isActive: true }, _sum: { currentCount: true } }),
  ]);
  const lechonesMaternidad = enMaternidad.reduce((s, f) => s + f.bornAlive - f.deaths.reduce((t, d) => t + d.quantity, 0), 0);
  const lechonesDestete = enDestete._sum.currentCount ?? 0;
  const col = (k: keyof (typeof prod)[number]) => prod.map(p => Number(p[k]));
  const fila = (etiqueta: string, k: keyof (typeof prod)[number], formato: Fila["formato"] = "num"): Fila => ({ etiqueta, valores: col(k), total: sumaN(col(k)), formato });
  const T = (k: keyof (typeof prod)[number]) => sumaN(col(k));
  const filas: Fila[] = [
    fila("Servicios", "servicios"), fila("Partos", "partos"), fila("Nacidos totales", "nacidosTotales"), fila("Nacidos vivos", "nacidosVivos"),
    fila("Muertos al nacer", "muertosAlNacer"), fila("Destetados", "destetados"), fila("Muertos en lactancia", "muertosLactancia"),
    fila("Lechones entregados (vendidos)", "entregados"), fila("Kg entregados", "kgEntregados", "kg"),
    { etiqueta: "Mortalidad predestete", formato: "pct", valores: prod.map(p => div(p.muertosLactancia, p.nacidosVivos)), total: div(T("muertosLactancia"), T("nacidosVivos")) },
    { etiqueta: "Nacidos vivos por parto", formato: "dec", valores: prod.map(p => div(p.nacidosVivos, p.partos)), total: div(T("nacidosVivos"), T("partos")) },
    { etiqueta: "Destetados por parto", formato: "dec", valores: prod.map(p => div(p.destetados, p.partos)), total: div(T("destetados"), T("partos")) },
    { etiqueta: "Peso promedio de salida", formato: "dec", valores: prod.map(p => div(p.kgEntregados, p.entregados)), total: div(T("kgEntregados"), T("entregados")), nota: "kg por lechón entregado" },
  ];
  return (
    <>
      <SelectorAnio anio={anio} base="/finanzas/produccion" />
      <div style={{ ...tarjeta, padding: 14, display: "flex", gap: 22, flexWrap: "wrap" }}>
        {[["Matrices activas", matricesHoy], ["Machos reproductores", machos], ["Lechones en maternidad", lechonesMaternidad], ["Lechones en destete", lechonesDestete], ["Total de lechones", lechonesMaternidad + lechonesDestete]].map(([t, v]) => (
          <div key={t as string}><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t} (hoy)</div><div style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>{Number(v).toLocaleString("es-PY")}</div></div>
        ))}
      </div>
      <TablaMensual titulo={`Producción ${anio}`} filas={filas} mesCorte={corte}
        nota="Sale sola de Gestación, Maternidad, Destete y de las ventas de Finanzas: no se carga a mano. Los meses en gris todavía no pasaron." />
    </>
  );
}
