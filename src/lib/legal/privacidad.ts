// Tipos de solicitud del portal de privacidad (derechos de la Ley 7593/2025).
export const TIPOS_SOLICITUD = {
  ACCESO: "Saber qué datos tienen sobre mí y cómo los usan",
  RECTIFICACION: "Corregir datos que no puedo cambiar yo",
  OPOSICION: "Oponerme a un uso de mis datos",
  PORTABILIDAD: "Recibir mis datos para llevarlos a otro servicio",
  REVOCAR_CONSENTIMIENTO: "Retirar un consentimiento que di",
  IMPUGNAR_DECISION_AUTOMATIZADA: "Impugnar un resultado calculado automáticamente",
} as const;

export type TipoSolicitud = keyof typeof TIPOS_SOLICITUD;

export const ETIQUETA_SOLICITUD: Record<string, string> = {
  ...TIPOS_SOLICITUD,
  SUPRESION: "Baja de la cuenta",
};

export const ETIQUETA_ESTADO: Record<string, string> = {
  RECIBIDA: "Recibida", EN_CURSO: "En curso", RESPONDIDA: "Respondida",
  RECHAZADA_CON_MOTIVO: "Rechazada con motivo", CANCELADA: "Cancelada",
};
