import { datosAnio } from "@/lib/finanzas/anio";
import { DIETAS, DIETAS_LECHONES, NOMBRE_DIETA, div, hojaAlimentacion, sumaB, sumaN } from "@/lib/finanzas/hojas";
import { corteDelAnio, paginaFinanzas } from "@/lib/finanzas/pagina";
import { SelectorAnio, TablaMensual, anioDe, type Fila } from "../tabla-mensual";

export const metadata = { title: "Alimentación · Finanzas · KurPorc" };

export default async function AlimentacionFinanzas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, mesCorte } = await paginaFinanzas("finanzas.balanceado.ver");
  const anio = anioDe(await searchParams);
  const corte = corteDelAnio(anio, mesCorte);
  const { movs, prod, matricesPorMes, matricesManual, matricesHoy } = await datosAnio(org, anio);
  const a = hojaAlimentacion(movs, prod, matricesPorMes);
  const usadas = DIETAS.filter(d => a.gs[d].some(v => v > 0n) || a.kg[d].some(v => v > 0));
  const totalGs = sumaB(a.totalGs), totalKg = sumaN(a.totalKg);
  const conPrecio = (xs: (number | null)[]) => xs.slice(0, (corte % 100)).filter((x): x is number => x !== null);
  const promedio = (xs: (number | null)[]) => { const v = conPrecio(xs); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const matrices = matricesPorMes[0] || 0;
  const mesesCorridos = corte % 100;
  const destetados = sumaN(prod.map(p => p.destetados)), entregados = sumaN(prod.map(p => p.entregados)), kgEnt = sumaN(prod.map(p => p.kgEntregados));

  const precio: Fila[] = usadas.map(d => ({ etiqueta: NOMBRE_DIETA[d], valores: a.precio[d], total: promedio(a.precio[d]), formato: "gs" }));
  const kilos: Fila[] = [
    ...usadas.map(d => ({ etiqueta: NOMBRE_DIETA[d], valores: a.kg[d], total: sumaN(a.kg[d]), formato: "kg" as const })),
    { etiqueta: "Total", valores: a.totalKg, total: totalKg, formato: "kg", nivel: "total" },
    { etiqueta: "Kilos por matriz al mes", valores: a.indicadores.kgPorMatriz, total: div(totalKg, matrices * mesesCorridos), formato: "dec" },
  ];
  const plata: Fila[] = [
    ...usadas.map(d => ({ etiqueta: NOMBRE_DIETA[d], valores: a.gs[d], total: sumaB(a.gs[d]), formato: "gs" as const })),
    { etiqueta: "Subtotal lechones", valores: a.lechonesGs, total: sumaB(a.lechonesGs), formato: "gs", nivel: "sub", nota: DIETAS_LECHONES.map(d => NOMBRE_DIETA[d]).join(" + ") },
    { etiqueta: "Total en alimento", valores: a.totalGs, total: totalGs, formato: "gs", nivel: "total" },
    ...usadas.map(d => ({ etiqueta: `% ${NOMBRE_DIETA[d]}`, valores: a.gs[d].map((g, i) => (a.totalGs[i] > 0n ? Number(g) / Number(a.totalGs[i]) : null)), total: totalGs > 0n ? Number(sumaB(a.gs[d])) / Number(totalGs) : null, formato: "pct" as const })),
  ];
  const ind: Fila[] = [
    { etiqueta: "Alimento por matriz al mes", valores: a.indicadores.porMatriz, total: div(totalGs, matrices * mesesCorridos), formato: "gs" },
    { etiqueta: "Alimento de las matrices por matriz", valores: a.indicadores.matricesPorMatriz, total: div(sumaB(a.matricesGs), matrices * mesesCorridos), formato: "gs", nota: "Gestación + lactación ÷ matrices" },
    { etiqueta: "Alimento por lechón destetado", valores: a.indicadores.porDestetado, total: div(sumaB(a.lechonesGs), destetados), formato: "gs" },
    { etiqueta: "Alimento por lechón entregado", valores: a.indicadores.porEntregado, total: div(totalGs, entregados), formato: "gs" },
    { etiqueta: "Alimento por kg entregado", valores: a.indicadores.porKgEntregado, total: div(totalGs, kgEnt), formato: "gs" },
  ];
  return (
    <>
      <SelectorAnio anio={anio} base="/finanzas/alimentacion" />
      {usadas.length === 0 ? (
        <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", padding: 16, fontSize: 13, color: "var(--text-secondary)" }}>
          No hay compras de balanceado en {anio}. Cargalas en Movimientos con su categoría (Balanceado de gestación, Lactación, Vilo Baby…) y la <strong>cantidad en kg</strong>: de ahí salen el precio por kilo y todos los indicadores.
        </div>
      ) : (
        <>
          <TablaMensual titulo="Precio por kilo por dieta" filas={precio} mesCorte={corte} columnaTotal="Promedio"
            nota="Gs ÷ kg del mes. Un mes sin compras repite el precio del mes anterior (sirve para proyectar)." />
          <TablaMensual titulo="Kilos por dieta" filas={kilos} mesCorte={corte} />
          <TablaMensual titulo="Guaraníes por dieta" filas={plata} mesCorte={corte} />
          <TablaMensual titulo="Indicadores" filas={ind} mesCorte={corte} columnaTotal="Prom. mensual"
            nota={`Matrices activas: ${matrices}${matricesManual === null ? ` (las activas de Plantel hoy; podés fijar otro número en Parámetros)` : " (cargado en Parámetros)"}. En la columna del año, los guaraníes son promedio mensual. El alimento entra al costo por lo comprado en el mes.${matricesHoy === 0 ? " Sin matrices cargadas, los indicadores por matriz quedan vacíos." : ""}`} />
        </>
      )}
    </>
  );
}
