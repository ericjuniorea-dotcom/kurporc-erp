// Fase 15.4 · Semáforo de salud del cliente. Puro (sin base): lo prueba scripts/pruebas/salud.ts.

export type Salud = "NUEVO" | "ROJO" | "AMARILLO" | "VERDE";
export const SALUD: Record<Salud, { etiqueta: string; color: string; fondo: string; orden: number }> = {
  ROJO:     { etiqueta: "En riesgo",  color: "var(--danger-text)",  fondo: "#F7C1C1", orden: 0 },
  AMARILLO: { etiqueta: "A mirar",    color: "var(--warning-text)", fondo: "#FAC775", orden: 1 },
  NUEVO:    { etiqueta: "Nuevo",      color: "var(--text-secondary)", fondo: "#D3D1C7", orden: 2 },
  VERDE:    { etiqueta: "Bien",       color: "var(--success-text)", fondo: "#C0DD97", orden: 3 },
};

export type EntradaSalud = {
  diasDesdeAlta: number;
  /** null = nunca usó la plataforma */
  diasDesdeUltimoUso: number | null;
  primerosPasos: boolean;
  cargoUltimos7: boolean;
  cargoAlgunaVez: boolean;
};

/** Reglas en orden: nuevo → rojo → verde → amarillo. */
export function calcularSalud(e: EntradaSalud): Salud {
  if (e.diasDesdeAlta < 7) return "NUEVO";
  if (e.diasDesdeUltimoUso === null || e.diasDesdeUltimoUso >= 14) return "ROJO";
  if (!e.cargoAlgunaVez) return "ROJO";
  if (e.diasDesdeUltimoUso < 7 && e.cargoUltimos7 && e.primerosPasos) return "VERDE";
  return "AMARILLO";
}
