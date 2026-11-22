// Categorías de las órdenes de trabajo (tareas). Una sola tabla para todas las pantallas que muestran tareas.
// Pura: se usa en componentes de cliente y en el servidor.

// El orden es el de pantalla: primero el Manejo (destetes, partos, servicios, diagnósticos, traslados), después Vacunación.
export const CATEGORIAS_TAREA = {
  MANEJO:       { etiqueta: "Manejo",             color: "#D4537E" },
  VACUNACION:   { etiqueta: "Vacunación",         color: "#378ADD" },
  MEDICACION:   { etiqueta: "Medicación",         color: "#A31621" },
  REVISION:     { etiqueta: "Revisión de datos",  color: "#7A7A7A" },
  ALIMENTACION: { etiqueta: "Alimentación",       color: "#C9A227" },
  INSTALACIONES:{ etiqueta: "Instalaciones",      color: "#1D9E75" },
  REPRODUCCION: { etiqueta: "Reproducción",       color: "#E07C2E" },
  OTRA:         { etiqueta: "Otras",              color: "#9A9A9A" },
} as const;

/** En las Órdenes de trabajo de cada módulo no se muestran (cargan la pantalla y tapan lo importante); siguen en Tareas. */
export const OCULTAS_EN_MODULO: CategoriaTarea[] = ["ALIMENTACION", "INSTALACIONES"];

export type CategoriaTarea = keyof typeof CATEGORIAS_TAREA;
export const ORDEN_CATEGORIAS = Object.keys(CATEGORIAS_TAREA) as CategoriaTarea[];

const MEDICACION = /desparasit|hierro|toltrazuril|baycox|antibi|tratamiento|medicaci|ivermectina|antiinflam|vitamina|multivitam/i;
const VACUNA = /vacun|rhiniseng|suiseng|porcilis|eryseng|circovirus|pcv2|mycoplasma|m\. ?hyo/i;

/** Categoría de una tarea según su tipo y, si hace falta, su título. */
export function categoriaTarea(t: { tipo: string; titulo?: string | null }): CategoriaTarea {
  const tipo = t.tipo ?? "";
  const titulo = t.titulo ?? "";
  if (tipo === "alimentacion") return "ALIMENTACION";
  if (tipo.startsWith("vacuna") || VACUNA.test(titulo)) return "VACUNACION";
  if (tipo === "tratamiento-curativo" || tipo === "hierro-fe" || MEDICACION.test(titulo)) return "MEDICACION";
  if (["parto-esperado", "diagnostico-prenez", "repeticion-celo", "servicio", "celo", "traslado", "diagnostico", "parto",
    "manejo-sanitario", "destete", "pesaje", "cambio-fase", "descolmillado", "castracion", "corte-cola"].includes(tipo)) return "MANEJO";
  if (tipo.startsWith("limpieza") || tipo.startsWith("desinfeccion") || tipo === "control-temperatura") return "INSTALACIONES";
  if (tipo === "revision-datos") return "REVISION";
  if (/aliment|raci[oó]n|comedero/i.test(titulo)) return "ALIMENTACION";
  return "OTRA";
}

/** Quién tiene que hacerla (puesto); «Sin asignar» si no tiene responsable. */
export const operadorTarea = (t: { responsableNombre?: string | null }) => t.responsableNombre?.trim() || "Sin asignar";
