// Datos de Paraguay usados en formularios.
export const DEPARTAMENTOS = [
  "Asunción", "Concepción", "San Pedro", "Cordillera", "Guairá", "Caaguazú", "Caazapá", "Itapúa", "Misiones",
  "Paraguarí", "Alto Paraná", "Central", "Ñeembucú", "Amambay", "Canindeyú", "Presidente Hayes", "Boquerón", "Alto Paraguay",
] as const;

export const SISTEMAS_PRODUCTIVOS = [
  { valor: "CICLO_COMPLETO", etiqueta: "Ciclo completo (cría, recría y engorde)" },
  { valor: "CRIA", etiqueta: "Cría (vendo lechones)" },
  { valor: "CRIA_RECRIA", etiqueta: "Cría y recría" },
  { valor: "ENGORDE", etiqueta: "Solo engorde" },
] as const;

export const CATEGORIAS_VENTA = [
  "Alimentación", "Sanidad", "Reproducción", "Genética y animales", "Equipos e instalaciones", "Servicios",
] as const;
