// Fase 15 · Única tabla ruta → módulo. La usan el buzón, el latido de uso y el panel de plataforma.
// Puro: sin dependencias de servidor (se importa también desde componentes de cliente).

export const MODULOS = {
  TABLERO:       { etiqueta: "Tablero",              prefijos: ["/dashboard"] },
  PLANTEL:       { etiqueta: "Plantel reproductivo", prefijos: ["/plantel"] },
  GESTACION:     { etiqueta: "Gestación",            prefijos: ["/gestacion"] },
  MATERNIDAD:    { etiqueta: "Maternidad",           prefijos: ["/maternidad"] },
  INICIACION:    { etiqueta: "Iniciación",           prefijos: ["/recria"] },
  ENGORDE:       { etiqueta: "Engorde",              prefijos: ["/engorde"] },
  SANIDAD:       { etiqueta: "Sanidad y Nutrición",  prefijos: ["/sanidad"] },
  TAREAS:        { etiqueta: "Tareas",               prefijos: ["/tareas"] },
  ALIMENTACION:  { etiqueta: "Nutrición",            prefijos: ["/alimentacion"] },
  LOGISTICA:     { etiqueta: "Inventario",           prefijos: ["/inventario", "/logistica"] },
  RRHH:          { etiqueta: "RRHH",                 prefijos: ["/rrhh"] },
  FINANZAS:      { etiqueta: "Finanzas",             prefijos: ["/finanzas", "/financiero"] },
  WHATSAPP:      { etiqueta: "WhatsApp",             prefijos: ["/whatsapp"] },
  COMPRAS:       { etiqueta: "Compras",              prefijos: ["/compras"] },
  MERCADO:       { etiqueta: "Mercado",              prefijos: ["/mercado", "/marketplace", "/tienda"] },
  EQUIPO:        { etiqueta: "Equipo",               prefijos: ["/equipo"] },
  CONFIGURACION: { etiqueta: "Configuración",        prefijos: ["/configuracion"] },
  VENDEDOR:      { etiqueta: "Panel de tienda",      prefijos: ["/vendedor"] },
  CUENTA:        { etiqueta: "Mi cuenta",            prefijos: ["/cuenta"] },
  OTRO:          { etiqueta: "Otro",                 prefijos: [] as string[] },
} as const;

export type ModuloClave = keyof typeof MODULOS;
export const CLAVES_MODULO = Object.keys(MODULOS) as ModuloClave[];

export const esModulo = (x: unknown): x is ModuloClave => typeof x === "string" && x in MODULOS;
export const etiquetaModulo = (x: string | null | undefined) => (x && esModulo(x) ? MODULOS[x].etiqueta : "Sin módulo");

/** Módulo de una ruta: coincide el prefijo exacto o seguido de «/» (así «/plantelx» no es Plantel). */
export function moduloDeRuta(ruta: string | null | undefined): ModuloClave {
  const r = (ruta ?? "").split(/[?#]/)[0].toLowerCase();
  for (const clave of CLAVES_MODULO) {
    for (const p of MODULOS[clave].prefijos) if (r === p || r.startsWith(`${p}/`)) return clave;
  }
  return "OTRO";
}
