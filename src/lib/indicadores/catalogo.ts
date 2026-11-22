// Catálogo único de indicadores de KurPorc: nombre, cómo se calcula, para qué sirve y contra qué meta se mide.
// Todo indicador que se muestre en el programa se registra acá (ver .claude/skills/indicadores-kurporc):
// con esto se arma la nube de ayuda al pasar el mouse, la nota «Cómo se calcula» y el semáforo contra la meta.
// Se puede usar en el navegador y en el servidor (no consulta la base).

export type Sentido = "mayor" | "menor"; // mayor = más es mejor · menor = menos es mejor
export type GrupoIndicador = "Reproducción" | "Maternidad" | "Iniciación" | "Engorde" | "General" | "Inventario" | "Actividad";
export type MetaRef = { modulo: string; kpiKey: string; defecto: number };

export interface Indicador {
  nombre: string;
  grupo: GrupoIndicador;
  unidad: "%" | "kg" | "días" | "lechones" | "partos" | "animales" | "";
  decimales: number;
  sentido?: Sentido;
  meta?: MetaRef;
  /** Cómo se calcula, en palabras del productor */
  formula: string;
  /** Para qué sirve / qué hacer si se aleja de la meta */
  paraQue: string;
}

export const INDICADORES = {
  // ── Reproducción ─────────────────────────────────────────────
  tasa_parto: {
    nombre: "Tasa de parto", grupo: "Reproducción", unidad: "%", decimales: 0, sentido: "mayor",
    meta: { modulo: "GESTACION", kpiKey: "tasa_parto_pct", defecto: 88 },
    formula: "Cerdas que parieron ÷ cerdas servidas × 100. Se toman los servicios hechos hace más de 115 días, para que ya hayan tenido tiempo de parir.",
    paraQue: "Mide la fertilidad del plantel: cuántos servicios terminan en parto. Si baja, revisá detección de celo, momento de la inseminación, calidad del semen y estrés por calor.",
  },
  repeticion_celo: {
    nombre: "Repetición de celo", grupo: "Reproducción", unidad: "%", decimales: 0, sentido: "menor",
    meta: { modulo: "GESTACION", kpiKey: "repeticion_celo_pct_max", defecto: 10 },
    formula: "De los servicios del período que ya tienen 60 días: los que se volvieron a servir dentro de los 60 días sin parir ÷ total de esos servicios × 100. Las dosis de un mismo celo cuentan como un solo servicio. Regulares (18-24 días): la cerda no quedó preñada. Irregulares (25-60 días): quedó preñada y perdió los embriones.",
    paraQue: "Cuenta las cerdas que no quedaron preñadas y volvieron en celo. Cada repetición son unos 21 días de cerda que come sin producir. Regulares altas: revisá detección de celo, momento de la inseminación y calidad del semen. Irregulares altas: estrés por calor, enfermedad o vacunación.",
  },
  repeticion_tardia: {
    nombre: "Repetición tardía (+60 días)", grupo: "Reproducción", unidad: "%", decimales: 0, sentido: "menor",
    meta: { modulo: "GESTACION", kpiKey: "repeticion_tardia_pct_max", defecto: 5 },
    formula: "De los servicios del período que ya tienen 115 días: los que se volvieron a servir después de los 60 días sin parir ÷ total de esos servicios × 100. Sumada a la repetición de celo da el total de cerdas que volvieron a servicio sin parir.",
    paraQue: "Son cerdas que quedaron preñadas y la perdieron tarde (aborto no visto, pérdida de la gestación) o falsas preñadas. Si sube, revisá la vacunación (parvovirus, leptospirosis, PRRS), el calor y el diagnóstico de preñez a los 21-28 días.",
  },
  intervalo_destete_servicio: {
    nombre: "Intervalo destete-servicio", grupo: "Reproducción", unidad: "días", decimales: 1, sentido: "menor",
    meta: { modulo: "GESTACION", kpiKey: "dias_open_max", defecto: 5 },
    formula: "Promedio de días entre el destete de cada cerda y su primer servicio siguiente (servicios hechos en el período, hasta 60 días después del destete).",
    paraQue: "Cuanto más corto, más rápido vuelve la cerda a producir. Si sube, revisá la condición corporal al destete, la alimentación en lactancia y la detección de celo.",
  },
  partos_cerda_anio: {
    nombre: "Partos / cerda / año", grupo: "Reproducción", unidad: "partos", decimales: 2, sentido: "mayor",
    meta: { modulo: "GESTACION", kpiKey: "partos_cerda_anio", defecto: 2.4 },
    formula: "365 ÷ días del ciclo de la cerda. Ciclo = gestación real + días de lactancia + intervalo destete-servicio (promedios del período).",
    paraQue: "Resume qué tan rápido gira el ciclo de la cerda (gestación + lactancia + días improductivos). Baja cuando hay repeticiones, intervalos largos o lactancias largas.",
  },
  destetados_cerda_anio: {
    nombre: "Destetados / cerda / año", grupo: "Reproducción", unidad: "lechones", decimales: 1, sentido: "mayor",
    meta: { modulo: "GESTACION", kpiKey: "destetados_cerda_anio", defecto: 27 },
    formula: "Partos / cerda / año × destetados por camada.",
    paraQue: "Es el número que resume toda la productividad de la cerda y el que usan las mejores granjas del mundo para compararse.",
  },
  // ── Maternidad ───────────────────────────────────────────────
  nacidos_totales_parto: {
    nombre: "Nacidos totales / parto", grupo: "Maternidad", unidad: "lechones", decimales: 1, sentido: "mayor",
    meta: { modulo: "MATERNIDAD", kpiKey: "nacidos_totales_meta", defecto: 13 },
    formula: "(Nacidos vivos + nacidos muertos + momificados) ÷ partos del período.",
    paraQue: "Mide la prolificidad de la cerda (la genética y la ovulación). Si baja, revisá la alimentación antes del servicio, la edad del plantel y la genética.",
  },
  nacidos_vivos_parto: {
    nombre: "Nacidos vivos / parto", grupo: "Maternidad", unidad: "lechones", decimales: 1, sentido: "mayor",
    meta: { modulo: "MATERNIDAD", kpiKey: "nacidos_vivos_meta", defecto: 13.5 },
    formula: "Nacidos vivos ÷ partos del período.",
    paraQue: "Son los lechones con los que realmente arranca la camada. Si los totales están bien pero los vivos no, el problema está en el parto.",
  },
  muertos_al_nacer: {
    nombre: "Muertos al nacer", grupo: "Maternidad", unidad: "%", decimales: 1, sentido: "menor",
    meta: { modulo: "MATERNIDAD", kpiKey: "muertos_al_nacer_pct_max", defecto: 7 },
    formula: "(Nacidos muertos + momificados) ÷ nacidos totales × 100.",
    paraQue: "Muestra pérdidas en el parto y en la gestación. Si sube, revisá la atención del parto, partos largos, temperatura y enfermedades reproductivas.",
  },
  nacidos_muertos: {
    nombre: "Nacidos muertos", grupo: "Maternidad", unidad: "%", decimales: 1, sentido: "menor",
    meta: { modulo: "MATERNIDAD", kpiKey: "nacidos_muertos_pct_max", defecto: 5 },
    formula: "Lechones nacidos muertos (formados, que murieron en el parto o justo antes) ÷ nacidos totales × 100. No incluye los momificados.",
    paraQue: "Si sube, revisá primero la vacunación de las reproductoras (parvovirus, leptospirosis, erisipela; en Sanidad → Vacunación) y después partos largos, falta de atención en el parto, calor y cerdas viejas o muy gordas.",
  },
  momificados: {
    nombre: "Momificados", grupo: "Maternidad", unidad: "%", decimales: 1, sentido: "menor",
    meta: { modulo: "MATERNIDAD", kpiKey: "pct_momificados_max", defecto: 1 },
    formula: "Lechones momificados (murieron dentro de la madre durante la gestación) ÷ nacidos totales × 100.",
    paraQue: "Los momificados casi siempre son por enfermedad reproductiva: parvovirus sobre todo, también leptospirosis o PRRS. Si sube, revisá que todas las reproductoras y cachorras tengan sus vacunas al día antes del servicio.",
  },
  peso_al_nacer: {
    nombre: "Peso al nacer", grupo: "Maternidad", unidad: "kg", decimales: 2, sentido: "mayor",
    meta: { modulo: "MATERNIDAD", kpiKey: "peso_nacer_kg", defecto: 1.4 },
    formula: "Peso total de las camadas ÷ nacidos vivos (solo partos con peso cargado).",
    paraQue: "Un lechón liviano sobrevive menos y crece más lento. Depende de la alimentación de la cerda al final de la gestación.",
  },
  mortalidad_predestete: {
    nombre: "Mortalidad predestete", grupo: "Maternidad", unidad: "%", decimales: 1, sentido: "menor",
    meta: { modulo: "MATERNIDAD", kpiKey: "mortalidad_pct_max", defecto: 8 },
    formula: "De las camadas destetadas en el período: lechones muertos en lactancia ÷ lechones a cargo de la cerda (nacidos vivos + recibidos en adopción − donados) × 100.",
    paraQue: "Es donde más lechones se pierden en casi todas las granjas. Si sube, mirá las causas en Análisis de Maternidad (aplastados, débiles, diarreas) y la temperatura del nido.",
  },
  destetados_camada: {
    nombre: "Destetados / camada", grupo: "Maternidad", unidad: "lechones", decimales: 1, sentido: "mayor",
    meta: { modulo: "MATERNIDAD", kpiKey: "destetados_parto", defecto: 12 },
    formula: "Lechones destetados ÷ camadas destetadas en el período.",
    paraQue: "Junta lo que nació vivo y lo que sobrevivió la lactancia: es lo que la cerda entrega al siguiente módulo.",
  },
  peso_destete: {
    nombre: "Peso al destete", grupo: "Maternidad", unidad: "kg", decimales: 2, sentido: "mayor",
    meta: { modulo: "MATERNIDAD", kpiKey: "peso_destete_kg", defecto: 6.5 },
    formula: "Peso total destetado ÷ lechones destetados (solo destetes con peso cargado).",
    paraQue: "Un lechón pesado al destete arranca mejor en Iniciación y llega antes al peso de venta.",
  },
  dias_lactancia: {
    nombre: "Días de lactancia", grupo: "Maternidad", unidad: "días", decimales: 1, sentido: "menor",
    meta: { modulo: "MATERNIDAD", kpiKey: "dias_lactancia", defecto: 21 },
    formula: "Promedio de días entre el parto y el destete de las camadas destetadas en el período.",
    paraQue: "Lactancias largas desgastan a la cerda, atrasan el próximo servicio y bajan los partos por año.",
  },
  // ── Iniciación y Engorde ─────────────────────────────────────
  mortalidad_iniciacion: {
    nombre: "Mortalidad en Iniciación", grupo: "Iniciación", unidad: "%", decimales: 1, sentido: "menor",
    meta: { modulo: "RECRIA", kpiKey: "mortalidad_pct_max", defecto: 2 },
    formula: "Lechones muertos en Iniciación en el período ÷ lechones destetados que entraron a Iniciación en el período × 100.",
    paraQue: "Las primeras semanas después del destete son las más delicadas. Si sube, revisá temperatura, consumo de balanceado, agua y diarreas.",
  },
  mortalidad_engorde: {
    nombre: "Mortalidad en Engorde", grupo: "Engorde", unidad: "%", decimales: 1, sentido: "menor",
    meta: { modulo: "ENGORDE", kpiKey: "mortalidad_pct_max", defecto: 3 },
    formula: "Cerdos muertos en Engorde en el período ÷ cerdos que entraron a Engorde en el período × 100.",
    paraQue: "Cada cerdo que muere en Engorde es el que más alimento ya comió. Si sube, mirá las causas en Análisis de Engorde.",
  },
  // ── General ──────────────────────────────────────────────────
  mortalidad_total: {
    nombre: "Mortalidad total", grupo: "General", unidad: "%", decimales: 1, sentido: "menor",
    meta: { modulo: "GENERAL", kpiKey: "mortalidad_total_pct_max", defecto: 15 },
    formula: "De cada 100 lechones que nacen vivos, cuántos se pierden hasta la venta: 1 − (1 − mortalidad predestete) × (1 − mortalidad en Iniciación) × (1 − mortalidad en Engorde). Las fases sin dato no se cuentan.",
    paraQue: "Cuántos de los lechones que nacen vivos se pierden antes de la venta. Resume la salud de toda la granja.",
  },
  // ── Inventario (cuántos hay hoy) ─────────────────────────────
  madres_activas: {
    nombre: "Madres activas", grupo: "Inventario", unidad: "animales", decimales: 0,
    formula: "Cerdas activas del plantel hoy. Se abren en gestantes (preñadas y servidas), lactantes (con camada en Maternidad) y vacías (esperando servicio).",
    paraQue: "Es el tamaño de tu fábrica de lechones. Muchas vacías por mucho tiempo son días que se pagan sin producir.",
  },
  lechones_maternidad: {
    nombre: "Lechones en Maternidad", grupo: "Inventario", unidad: "lechones", decimales: 0,
    formula: "Lechones a cargo de las camadas abiertas: nacidos vivos + recibidos − donados − muertos.",
    paraQue: "Los lechones que todavía están con la madre y que vas a destetar en los próximos días.",
  },
  lechones_iniciacion: {
    nombre: "Lechones en Iniciación", grupo: "Inventario", unidad: "lechones", decimales: 0,
    formula: "Suma de los animales de los lotes de Iniciación abiertos.",
    paraQue: "Los lechones destetados que están creciendo hasta pasar a Engorde o a la venta.",
  },
  cerdos_engorde: {
    nombre: "Cerdos en Engorde", grupo: "Inventario", unidad: "animales", decimales: 0,
    formula: "Suma de los animales de los lotes de Engorde activos.",
    paraQue: "Los cerdos que se están terminando para la venta.",
  },
  total_lechones: {
    nombre: "Total de lechones y cerdos", grupo: "Inventario", unidad: "animales", decimales: 0,
    formula: "Lechones en Maternidad + lechones en Iniciación + cerdos en Engorde.",
    paraQue: "Todo lo que está creciendo en la granja hoy (sin contar las madres ni los machos).",
  },
  // ── Actividad ────────────────────────────────────────────────
  servicios_mes: {
    nombre: "Servicios del mes", grupo: "Actividad", unidad: "", decimales: 0,
    formula: "Servicios (inseminaciones o montas) registrados desde el 1 del mes hasta hoy.",
    paraQue: "Los servicios de hoy son los partos de dentro de 115 días: si se cortan, dentro de 4 meses faltan lechones.",
  },
  partos_mes: {
    nombre: "Partos del mes", grupo: "Actividad", unidad: "", decimales: 0,
    formula: "Partos registrados desde el 1 del mes hasta hoy.",
    paraQue: "Cuántas camadas nuevas entraron a Maternidad este mes.",
  },
  destetados_30d: {
    nombre: "Destetados (30 días)", grupo: "Actividad", unidad: "lechones", decimales: 0,
    formula: "Lechones destetados en los últimos 30 días.",
    paraQue: "Lo que la Maternidad entregó a Iniciación en el último mes.",
  },
  bajas_mes: {
    nombre: "Bajas de lechones del mes", grupo: "Actividad", unidad: "", decimales: 0,
    formula: "Lechones y cerdos muertos desde el 1 del mes en Maternidad, Iniciación y Engorde.",
    paraQue: "Para ver de un vistazo si este mes se está muriendo más de lo normal.",
  },
  gestacion_real: {
    nombre: "Gestación real", grupo: "Actividad", unidad: "días", decimales: 1,
    formula: "Promedio de días entre el servicio y el parto de los partos de los últimos 12 meses.",
    paraQue: "Lo normal es 114-116 días. Sirve para ajustar la fecha probable de parto y preparar las salas a tiempo.",
  },
  proximo_parto: {
    nombre: "Próximo parto", grupo: "Actividad", unidad: "", decimales: 0,
    formula: "Fecha del servicio + 114 días de la cerda preñada o servida más próxima a parir.",
    paraQue: "Para tener la sala de Maternidad lavada, desinfectada y lista antes de que llegue la cerda.",
  },
  proximo_destete: {
    nombre: "Próximo destete", grupo: "Actividad", unidad: "", decimales: 0,
    formula: "Fecha del parto + días de lactancia meta de la camada abierta más antigua.",
    paraQue: "Para preparar el lugar en Iniciación y organizar el servicio de las cerdas que salen.",
  },
} satisfies Record<string, Indicador>;

export type ClaveIndicador = keyof typeof INDICADORES;
export const indicador = (c: ClaveIndicador): Indicador => INDICADORES[c];

/** Metas que el programa sabe medir, con su valor por defecto (si la granja todavía no la cargó). */
export const METAS_CATALOGO: { modulo: string; kpiKey: string; label: string; defecto: number; clave?: ClaveIndicador }[] = [
  ...(Object.entries(INDICADORES) as [ClaveIndicador, Indicador][])
    .filter(([, i]) => i.meta)
    .map(([clave, i]) => ({ modulo: i.meta!.modulo, kpiKey: i.meta!.kpiKey, label: `${i.nombre}${i.unidad ? ` (${i.unidad})` : ""}${i.sentido === "menor" ? " · máximo" : " · mínimo"}`, defecto: i.meta!.defecto, clave })),
  // Parámetros de trabajo (no son indicadores)
  { modulo: "MATERNIDAD", kpiKey: "dias_aviso_destete", label: "Días antes del destete para avisar (Acciones para hoy y campanita)", defecto: 2 },
  { modulo: "MATERNIDAD", kpiKey: "dias_aviso_parto", label: "Días antes del parto probable para avisar", defecto: 3 },
  { modulo: "GESTACION", kpiKey: "dias_traslado_maternidad", label: "Días antes del parto para pasar la reproductora a Maternidad (orden de trabajo automática)", defecto: 5 },
];

export type Estado = "EN_META" | "ATENCION" | "FUERA" | "SIN_DATO";

/**
 * Semáforo contra la meta. Distancia = valor ÷ meta − 1 (si menos es mejor: meta ÷ valor − 1).
 * EN META si se cumple; ATENCIÓN si está a menos del 10% de la meta; FUERA si está más lejos.
 */
export function evaluar(valor: number | null, meta: number | null, sentido: Sentido = "mayor"): { estado: Estado; distancia: number | null } {
  if (valor == null || meta == null || !Number.isFinite(valor)) return { estado: "SIN_DATO", distancia: null };
  const cumple = sentido === "mayor" ? valor >= meta : valor <= meta;
  let distancia: number | null;
  if (sentido === "mayor") distancia = meta ? valor / meta - 1 : null;
  else distancia = valor ? meta / valor - 1 : null;
  if (cumple) return { estado: "EN_META", distancia: distancia ?? 0 };
  return { estado: distancia != null && distancia >= -0.1 ? "ATENCION" : "FUERA", distancia };
}

/** ¿Lo reciente (3 meses) está mejor o peor que el año? Cambios de menos del 3% se consideran estables. */
export function tendencia(reciente: number | null, anual: number | null, sentido: Sentido = "mayor"): "mejora" | "empeora" | "estable" | null {
  if (reciente == null || anual == null) return null;
  const base = Math.abs(anual) || 1;
  const cambio = (reciente - anual) / base;
  if (Math.abs(cambio) < 0.03) return "estable";
  return (cambio > 0) === (sentido === "mayor") ? "mejora" : "empeora";
}

export function formatear(v: number | null | undefined, i: Pick<Indicador, "unidad" | "decimales">): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const n = v.toLocaleString("es-PY", { minimumFractionDigits: i.decimales, maximumFractionDigits: i.decimales });
  return i.unidad === "%" ? `${n}%` : i.unidad === "kg" ? `${n} kg` : i.unidad === "días" ? `${n} d` : n;
}
