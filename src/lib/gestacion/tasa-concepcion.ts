import prisma from "@/lib/db/prisma";

// Ventana móvil y muestra mínima antes de evaluar la alerta — evita
// disparar con 1-2 diagnósticos sueltos que no son representativos.
export const VENTANA_DIAS_CONCEPCION = 30;
export const MIN_MUESTRA_CONCEPCION = 5;

const GRAVEDAD_TO_SEVERITY: Record<string, "INFO" | "WARNING" | "CRITICAL"> = {
  INFO: "INFO", WARNING: "WARNING", DANGER: "CRITICAL",
};

export interface TasaConcepcion {
  totalDiagnosticos: number;
  positivos: number;
  tasaPct: number;
}

/**
 * Tasa de concepción de la granja en la ventana móvil: % de diagnósticos de
 * preñez resueltos (positivo o negativo) que dieron positivo. Los "Dudoso"
 * (RECHECK) no se cuentan — todavía no están resueltos.
 */
export async function computeTasaConcepcion(
  tenantId: string,
  ventanaDias: number = VENTANA_DIAS_CONCEPCION,
): Promise<TasaConcepcion | null> {
  const desde = new Date();
  desde.setDate(desde.getDate() - ventanaDias);

  const checks = await prisma.pregnancyCheck.findMany({
    where: { tenantId, checkDate: { gte: desde }, result: { in: ["PREGNANT", "NOT_PREGNANT"] } },
    select: { result: true },
  });

  const totalDiagnosticos = checks.length;
  if (totalDiagnosticos === 0) return null;

  const positivos = checks.filter(c => c.result === "PREGNANT").length;
  return { totalDiagnosticos, positivos, tasaPct: Math.round((positivos / totalDiagnosticos) * 100) };
}

/**
 * Recalcula la tasa de concepción y, si cae por debajo del umbral
 * configurado en ConfigAlerta (evento "baja_concepcion"), crea una Alert —
 * mismo patrón que HEAT_REPEAT_DISCARD en create-service-event.ts. No
 * duplica: si ya hay una alerta de este tipo sin resolver, no crea otra.
 */
export async function evaluarAlertaConcepcion(tenantId: string): Promise<void> {
  const resultado = await computeTasaConcepcion(tenantId);
  if (!resultado || resultado.totalDiagnosticos < MIN_MUESTRA_CONCEPCION) return;

  const alertaConfig = await prisma.configAlerta.findUnique({
    where: { tenantId_modulo_eventoKey: { tenantId, modulo: "GESTACION", eventoKey: "baja_concepcion" } },
  });
  if (alertaConfig && !alertaConfig.activa) return;

  const umbral = alertaConfig?.umbral ? Number(alertaConfig.umbral) : 75;
  if (resultado.tasaPct >= umbral) return;

  const yaExiste = await prisma.alert.findFirst({
    where: { tenantId, alertType: "LOW_CONCEPTION_RATE", isResolved: false },
    select: { id: true },
  });
  if (yaExiste) return;

  await prisma.alert.create({
    data: {
      tenantId,
      alertType: "LOW_CONCEPTION_RATE",
      severity:  GRAVEDAD_TO_SEVERITY[alertaConfig?.gravedad ?? "WARNING"] ?? "WARNING",
      title:     "Baja tasa de concepción",
      body:      `La tasa de concepción de los últimos ${VENTANA_DIAS_CONCEPCION} días es ${resultado.tasaPct}% (${resultado.positivos}/${resultado.totalDiagnosticos} diagnósticos), por debajo del umbral configurado (${umbral}%).`,
      entityType: "SOW",
    },
  });
}
