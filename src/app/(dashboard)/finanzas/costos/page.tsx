import { datosAnio, sanidadAnio } from "@/lib/finanzas/anio";
import { div, hojaCostos, sumaB, sumaN } from "@/lib/finanzas/hojas";
import { corteDelAnio, paginaFinanzas } from "@/lib/finanzas/pagina";
import { SelectorAnio, TablaMensual, anioDe, type Fila } from "../tabla-mensual";

export const metadata = { title: "Costos de producción · Finanzas · KurPorc" };

export default async function CostosFinanzas({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org, mesCorte } = await paginaFinanzas("finanzas.costos.ver");
  const anio = anioDe(await searchParams);
  const corte = corteDelAnio(anio, mesCorte);
  const [d, san] = await Promise.all([datosAnio(org, anio), sanidadAnio(org, anio)]);
  const c = hojaCostos(d.movs, d.inversiones, d.prod, d.matricesPorMes, d.params, anio, san.usadoPorMes);
  const total = sumaB(c.conAmort);
  const pct = (v: bigint) => (total > 0n ? Number(v) / Number(total) : null);
  const bloque = (fs: typeof c.directos): Fila[] => fs.map(f => ({ etiqueta: f.etiqueta, valores: f.valores, total: sumaB(f.valores), formato: "gs" }));
  const T = (k: "entregados" | "kgEntregados" | "destetados") => sumaN(d.prod.map(p => p[k]));
  const ingresos = sumaB(d.prod.map(p => p.ingresosLechonesGs));
  const matrices = d.matricesPorMes[0] || 0;
  const mesesCorridos = corte % 100;
  const precioAnio = div(ingresos, T("entregados")), costoAnio = div(total, T("entregados"));

  const filas: Fila[] = [
    { etiqueta: "1 · Alimentación", valores: [], nivel: "titulo" },
    ...bloque(c.filasAlim),
    { etiqueta: "Subtotal alimentación", valores: c.subAlim, total: sumaB(c.subAlim), formato: "gs", nivel: "sub" },
    { etiqueta: "2 · Otros costos productivos directos", valores: [], nivel: "titulo" },
    ...bloque(c.directos),
    { etiqueta: "Subtotal directos", valores: c.subDirectos, total: sumaB(c.subDirectos), formato: "gs", nivel: "sub" },
    { etiqueta: "3 · Estructura y administración", valores: [], nivel: "titulo" },
    ...bloque(c.estructura),
    { etiqueta: "Subtotal estructura", valores: c.subEstructura, total: sumaB(c.subEstructura), formato: "gs", nivel: "sub" },
    { etiqueta: "4 · Amortización", valores: c.amortizacion, total: sumaB(c.amortizacion), formato: "gs", nivel: "sub", nota: d.params.modoAmortizacion === "PLANILLA" ? "Como la planilla: todo lo invertido en obra y equipos, desde enero" : "Cada inversión desde el mes siguiente, con su vida útil" },
    { etiqueta: "Costo total sin amortización", valores: c.sinAmort, total: sumaB(c.sinAmort), formato: "gs", nivel: "total" },
    { etiqueta: "Costo total con amortización", valores: c.conAmort, total, formato: "gs", nivel: "total" },
    { etiqueta: "% del costo total", valores: [], nivel: "titulo" },
    { etiqueta: "Alimentación", valores: c.subAlim.map((v, i) => (c.conAmort[i] > 0n ? Number(v) / Number(c.conAmort[i]) : null)), total: pct(sumaB(c.subAlim)), formato: "pct", nota: "Referencia 65 % a 75 %: si es mucho menor, la estructura fija es grande para la cantidad de animales" },
    { etiqueta: "Directos", valores: c.subDirectos.map((v, i) => (c.conAmort[i] > 0n ? Number(v) / Number(c.conAmort[i]) : null)), total: pct(sumaB(c.subDirectos)), formato: "pct" },
    { etiqueta: "Estructura", valores: c.subEstructura.map((v, i) => (c.conAmort[i] > 0n ? Number(v) / Number(c.conAmort[i]) : null)), total: pct(sumaB(c.subEstructura)), formato: "pct" },
  ];
  const unit: Fila[] = [
    { etiqueta: "Lechones entregados", valores: c.unit.entregados, total: T("entregados"), formato: "num" },
    { etiqueta: "Kg entregados", valores: c.unit.kgEntregados, total: T("kgEntregados"), formato: "kg" },
    { etiqueta: "Lechones destetados", valores: c.unit.destetados, total: T("destetados"), formato: "num" },
    { etiqueta: "Ingreso por venta de lechones", valores: c.unit.ingresos, total: ingresos, formato: "gs" },
    { etiqueta: "Precio promedio por lechón", valores: c.unit.precioPromedio, total: precioAnio, formato: "gs" },
    { etiqueta: "Costo por lechón entregado", valores: c.unit.costoPorEntregado, total: costoAnio, formato: "gs", nivel: "sub" },
    { etiqueta: "Costo por kg entregado", valores: c.unit.costoPorKg, total: div(total, T("kgEntregados")), formato: "gs" },
    { etiqueta: "Costo total por matriz al mes", valores: c.unit.costoPorMatriz, total: div(total, matrices * mesesCorridos), formato: "gs", nivel: "sub" },
    { etiqueta: "Costo por lechón destetado", valores: c.unit.costoPorDestetado, total: div(total, T("destetados")), formato: "gs" },
    { etiqueta: "Margen por lechón", valores: c.unit.margenPorLechon, total: precioAnio !== null && costoAnio !== null ? precioAnio - costoAnio : null, formato: "gs", nivel: "sub" },
    { etiqueta: "Margen sobre el precio", valores: c.unit.margenSobrePrecio, total: precioAnio && costoAnio !== null ? (precioAnio - costoAnio) / precioAnio : null, formato: "pct" },
    { etiqueta: "Alimento por matriz al mes", valores: c.unit.alimentoPorMatriz, total: div(sumaB(c.subAlim), matrices * mesesCorridos), formato: "gs" },
  ];
  return (
    <>
      <SelectorAnio anio={anio} base="/finanzas/costos" />
      <TablaMensual titulo={`Costos de producción ${anio}`} filas={filas} mesCorte={corte}
        nota={`Sanidad imputada por ${d.params.imputacionSanidad === "USO" ? "uso (el mes en que se aplicó)" : "compra (como la planilla)"}. Se cambia en Parámetros.`} />
      <TablaMensual titulo="Producción, costo unitario y margen" filas={unit} mesCorte={corte}
        nota="«—» en costo por lechón = sin ventas ese mes: mientras la granja se arma, el número que sirve es el costo por matriz al mes. En la columna del año, el costo por lechón puede quedar distorsionado durante el armado." />
    </>
  );
}
