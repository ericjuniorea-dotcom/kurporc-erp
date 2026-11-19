// Transferencias de animales: nombres, estados y qué permiso deja enviar/recibir en cada módulo.
// Se usa en el navegador y en el servidor.

export const MODULOS_TRANSFERENCIA = {
  COMPRA: { etiqueta: "Compra (Finanzas)", href: "/finanzas/compra-animales" },
  GESTACION: { etiqueta: "Gestación", href: "/gestacion" },
  MATERNIDAD: { etiqueta: "Maternidad", href: "/maternidad" },
  INICIACION: { etiqueta: "Iniciación", href: "/recria" },
  ENGORDE: { etiqueta: "Engorde", href: "/engorde" },
  PLANTEL: { etiqueta: "Plantel reproductivo", href: "/plantel" },
  CUARENTENA: { etiqueta: "Cuarentena (Plantel)", href: "/plantel" },
} as const;
export type ModuloTransferencia = keyof typeof MODULOS_TRANSFERENCIA;

export const CATEGORIAS = {
  LECHONES: { etiqueta: "Lechones", unidad: "lechones" },
  REPRODUCTORAS: { etiqueta: "Reproductoras", unidad: "reproductoras" },
  REPRODUCTORES: { etiqueta: "Reproductores (machos)", unidad: "reproductores" },
} as const;
export type CategoriaAnimal = keyof typeof CATEGORIAS;

export const ESTADOS = {
  ORDEN: "Para enviar",
  EN_CAMINO: "Por recibir",
  RECIBIDA: "Recibida",
  RECHAZADA: "Rechazada",
  ANULADA: "Anulada",
} as const;
export type EstadoTransferencia = keyof typeof ESTADOS;

/** Destinos posibles de una compra según lo que se compró. */
export const DESTINOS_COMPRA: Record<CategoriaAnimal, ModuloTransferencia[]> = {
  LECHONES: ["INICIACION", "ENGORDE"],
  REPRODUCTORAS: ["GESTACION", "CUARENTENA"],
  REPRODUCTORES: ["PLANTEL", "CUARENTENA"],
};

/** Cualquiera con uno de estos permisos puede enviar o recibir en ese módulo. */
export const PERMISOS_MODULO: Record<Exclude<ModuloTransferencia, "COMPRA">, string[]> = {
  GESTACION: ["gestacion.servicios.crear", "gestacion.diagnosticos.crear", "plantel.animales.crear", "plantel.animales.editar"],
  MATERNIDAD: ["maternidad.partos.crear", "maternidad.destetes.crear", "maternidad.lechones.crear"],
  INICIACION: ["destete.lotes.crear", "destete.lotes.editar", "destete.eventos.crear"],
  ENGORDE: ["engorde.lotes.crear", "engorde.lotes.editar", "engorde.eventos.crear"],
  PLANTEL: ["plantel.animales.crear", "plantel.animales.editar"],
  CUARENTENA: ["plantel.animales.crear", "plantel.animales.editar"],
};

/** Qué destinos se muestran en la pantalla de cada módulo. */
export const DESTINOS_DE_PANTALLA: Record<"GESTACION" | "MATERNIDAD" | "INICIACION" | "ENGORDE" | "PLANTEL", ModuloTransferencia[]> = {
  GESTACION: ["GESTACION"],
  MATERNIDAD: ["MATERNIDAD"],
  INICIACION: ["INICIACION"],
  ENGORDE: ["ENGORDE"],
  PLANTEL: ["PLANTEL", "CUARENTENA"],
};

export type AnimalComprado = { caravana: string; sexo?: "H" | "M" | ""; pesoKg?: number | null; genetica?: string; nacimiento?: string };
