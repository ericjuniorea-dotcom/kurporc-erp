// Categorías de las órdenes de trabajo (tareas). Una sola tabla para todas las pantallas que muestran tareas.
// Pura: se usa en componentes de cliente y en el servidor.

export const CATEGORIAS_TAREA = {
  ALIMENTACION: { etiqueta: "Alimentación",       color: "#C9A227" },
  VACUNACION:   { etiqueta: "Vacunación",         color: "#378ADD" },
  MEDICACION:   { etiqueta: "Medicación",         color: "#A31621" },
  MANEJO:       { etiqueta: "Manejo de animales", color: "#D4537E" },
  REPRODUCCION: { etiqueta: "Reproducción",       color: "#E07C2E" },
  INSTALACIONES:{ etiqueta: "Instalaciones",      color: "#1D9E75" },
  REVISION:     { etiqueta: "Revisión de datos",  color: "#7A7A7A" },
  OTRA:         { etiqueta: "Otras",              color: "#9A9A9A" },
} as const;

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
  if (["parto-esperado", "diagnostico-prenez", "repeticion-celo", "servicio", "celo"].includes(tipo)) return "REPRODUCCION";
  if (["manejo-sanitario", "destete", "pesaje", "cambio-fase", "descolmillado", "castracion", "corte-cola"].includes(tipo)) return "MANEJO";
  if (tipo.startsWith("limpieza") || tipo.startsWith("desinfeccion") || tipo === "control-temperatura") return "INSTALACIONES";
  if (tipo === "revision-datos") return "REVISION";
  if (/aliment|raci[oó]n|comedero/i.test(titulo)) return "ALIMENTACION";
  return "OTRA";
}

/** Quién tiene que hacerla (puesto); «Sin asignar» si no tiene responsable. */
export const operadorTarea = (t: { responsableNombre?: string | null }) => t.responsableNombre?.trim() || "Sin asignar";
