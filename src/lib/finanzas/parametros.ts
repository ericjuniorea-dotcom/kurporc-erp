// Parámetros financieros editables (hoja PARÁMETROS). Una sola definición para el formulario y la validación.
export type TipoParam = "gs" | "int" | "dec" | "pct" | "bool" | "sel";
export type DefParam = { clave: string; etiqueta: string; tipo: TipoParam; grupo: string; ayuda?: string; opciones?: Record<string, string>; opcional?: boolean };

export const PARAMETROS: DefParam[] = [
  { grupo: "Precios y ventas", clave: "precioReferenciaLechonGs", etiqueta: "Precio de referencia por lechón", tipo: "gs", ayuda: "Para el punto de equilibrio" },
  { grupo: "Precios y ventas", clave: "precioKgVivoGs", etiqueta: "Precio por kg vivo", tipo: "gs" },
  { grupo: "Precios y ventas", clave: "pesoVentaKg", etiqueta: "Peso de venta (kg)", tipo: "dec" },
  { grupo: "Precios y ventas", clave: "modoProyeccionVentas", etiqueta: "Ventas de la proyección de caja", tipo: "sel", opciones: { PARAMETRO: "Lechones por mes fijos (este parámetro)", CALENDARIO_BANDAS: "Por calendario: partos, destetes y lotes de engorde" } },
  { grupo: "Precios y ventas", clave: "lechonesAVenderMes", etiqueta: "Lechones a vender por mes", tipo: "int", ayuda: "Para la proyección de caja" },
  { grupo: "Precios y ventas", clave: "precioEsperadoLechonGs", etiqueta: "Precio esperado por lechón", tipo: "gs" },
  { grupo: "Precios y ventas", clave: "otrosIngresosMesGs", etiqueta: "Otros ingresos por mes", tipo: "gs" },
  { grupo: "Caja y metas", clave: "colchonMesesEgreso", etiqueta: "Colchón de caja (meses de egreso)", tipo: "dec" },
  { grupo: "Caja y metas", clave: "metaCoberturaDias", etiqueta: "Meta de cobertura de caja (días)", tipo: "int" },
  { grupo: "Caja y metas", clave: "alertaCoberturaDias", etiqueta: "Alerta de cobertura (días)", tipo: "int" },
  { grupo: "Caja y metas", clave: "metaDesvio", etiqueta: "Desvío de presupuesto aceptable", tipo: "pct" },
  { grupo: "Caja y metas", clave: "alertaDesvio", etiqueta: "Desvío que hay que explicar", tipo: "pct" },
  { grupo: "Caja y metas", clave: "limiteAprobacionPagoGs", etiqueta: "Pagos que necesitan aprobación (más de)", tipo: "gs", opcional: true, ayuda: "Vacío = ningún pago necesita aprobación" },
  { grupo: "Producción", clave: "matricesActivasManual", etiqueta: "Matrices activas (fijo)", tipo: "int", opcional: true, ayuda: "Vacío = las activas de Plantel" },
  { grupo: "Costos", clave: "imputacionSanidad", etiqueta: "La sanidad entra al costo", tipo: "sel", opciones: { USO: "Cuando se aplica (recomendado)", COMPRA: "Cuando se compra (como la planilla)" } },
  { grupo: "Costos", clave: "modoAmortizacion", etiqueta: "Amortización", tipo: "sel", opciones: { POR_ACTIVO: "Cada inversión desde el mes siguiente", PLANILLA: "Como la planilla (todo desde enero)" } },
  { grupo: "Costos", clave: "vidaObraAnios", etiqueta: "Vida útil de la obra (años)", tipo: "int" },
  { grupo: "Costos", clave: "vidaEquiposAnios", etiqueta: "Vida útil de los equipos (años)", tipo: "int" },
  { grupo: "Costos", clave: "amortizarMatrices", etiqueta: "Amortizar las matrices compradas", tipo: "bool" },
  { grupo: "Costos", clave: "vidaMatrizMeses", etiqueta: "Vida productiva de una matriz (meses)", tipo: "int" },
  { grupo: "Costos", clave: "valorDescarteMatrizGs", etiqueta: "Valor de descarte de una matriz", tipo: "gs" },
  { grupo: "Engorde", clave: "precioTransferenciaLechon", etiqueta: "Valor del lechón de recría propia que entra al engorde", tipo: "sel", opciones: { MERCADO: "Precio de referencia (muestra si el engorde solo gana plata)", COSTO: "Costo propio del lechón" } },
  { grupo: "Engorde", clave: "porcentajeEstructuraEngorde", etiqueta: "Parte de los gastos fijos que se carga al engorde", tipo: "pct", ayuda: "Mano de obra, estructura y amortización prorrateadas a los lotes" },
  { grupo: "Cerdas paradas", clave: "toleranciaServicioDias", etiqueta: "Tolerancia sobre el intervalo destete-servicio (días)", tipo: "int", ayuda: "El intervalo objetivo es el de Configuración → Gestación (días abiertos)" },
  { grupo: "Cerdas paradas", clave: "edadPrimerServicioDias", etiqueta: "Edad objetivo de la nulípara al primer servicio (días)", tipo: "int" },
  { grupo: "Cerdas paradas", clave: "adaptacionNuliparaDias", etiqueta: "Días de adaptación desde el ingreso", tipo: "int", ayuda: "La nulípara cuenta como parada desde la fecha más tardía entre edad objetivo e ingreso + adaptación" },
  { grupo: "Cerdas paradas", clave: "alertaVaciaSinDecisionDias", etiqueta: "Avisar si una vacía sigue sin servicio ni decisión después de (días)", tipo: "int" },
  { grupo: "Cerdas paradas", clave: "alertaDescarteSinSalirDias", etiqueta: "Avisar si una cerda marcada para descarte no salió después de (días)", tipo: "int" },
  { grupo: "Personal", clave: "tasaIpsPatronal", etiqueta: "IPS patronal", tipo: "pct", ayuda: "Verificá la vigente con tu contador" },
  { grupo: "Personal", clave: "provisionarAguinaldo", etiqueta: "Provisionar aguinaldo en el presupuesto", tipo: "bool" },
  { grupo: "Retorno de la inversión", clave: "tasaDescuentoVan", etiqueta: "Tasa de descuento (VAN)", tipo: "pct" },
  { grupo: "Retorno de la inversión", clave: "crecimientoFlujoAnual", etiqueta: "Crecimiento anual del flujo", tipo: "pct" },
];

/** Convierte el texto del formulario al valor de la base. Lanza un mensaje legible si no es válido. */
export function convertirParametro(d: DefParam, texto: string): bigint | number | string | boolean | null {
  const crudo = texto.trim();
  // Enteros y montos: se ignoran los puntos de miles. Decimales: coma o punto como separador decimal.
  const t = d.tipo === "gs" || d.tipo === "int"
    ? crudo.replace(/[.,\s]/g, "")
    : crudo.includes(",") ? crudo.replace(/\./g, "").replace(",", ".") : crudo;
  if (d.tipo === "bool") return texto === "true";
  if (d.tipo === "sel") { if (!d.opciones || !(texto in d.opciones)) throw new Error(`${d.etiqueta}: opción inválida`); return texto; }
  if (t === "") { if (d.opcional) return null; throw new Error(`${d.etiqueta}: falta el valor`); }
  if (d.tipo === "gs") { if (!/^\d{1,15}$/.test(t)) throw new Error(`${d.etiqueta}: tiene que ser un monto en guaraníes`); return BigInt(t); }
  if (d.tipo === "int") { if (!/^\d{1,7}$/.test(t)) throw new Error(`${d.etiqueta}: tiene que ser un número entero`); return Number(t); }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${d.etiqueta}: número inválido`);
  if (d.tipo === "pct") { if (n > 100) throw new Error(`${d.etiqueta}: entre 0 y 100 %`); return n / 100; }
  return n;
}

/** Valor de la base → texto para el formulario. */
export function textoParametro(d: DefParam, v: unknown): string {
  if (v === null || v === undefined) return "";
  if (d.tipo === "bool") return v ? "true" : "false";
  if (d.tipo === "pct") return String(Math.round(Number(v) * 10000) / 100).replace(".", ",");
  if (d.tipo === "dec") return String(Number(v)).replace(".", ",");
  return String(v);
}
