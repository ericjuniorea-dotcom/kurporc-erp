// Límites de intentos (Fase 2.3), sobre la tabla limite_intento y las
// funciones SQL consumir_intento / bloqueado_hasta / limpiar_intentos.

import prisma from "@/lib/db/prisma";

export const LIMITES = {
  ingresoFallido:   { maximo: 5,  ventana: "15 minutes" }, // por cuenta + IP; después la espera se duplica
  registro:         { maximo: 5,  ventana: "1 hour" },     // por IP (Fase 6)
  recuperarClave:   { maximo: 3,  ventana: "1 hour" },     // por correo (Fase 3)
  invitaciones:     { maximo: 30, ventana: "1 day" },      // por organización (Fase 7)
  cotizaciones:     { maximo: 20, ventana: "1 day" },      // por usuario (Fase 13)
  exportaciones:    { maximo: 10, ventana: "1 day" },      // por usuario
} as const;

export type TipoLimite = keyof typeof LIMITES;

/** Registra un intento. Devuelve false si la clave ya estaba bloqueada. */
export async function consumirIntento(tipo: TipoLimite, clave: string): Promise<boolean> {
  const { maximo, ventana } = LIMITES[tipo];
  const r = await prisma.$queryRaw<{ ok: boolean }[]>`
    select public.consumir_intento(${`${tipo}:${clave}`}, ${maximo}::int, ${ventana}::interval) as ok`;
  return r[0]?.ok ?? false;
}

/** Hasta cuándo está bloqueada la clave, o null. */
export async function bloqueadoHasta(tipo: TipoLimite, clave: string): Promise<Date | null> {
  const r = await prisma.$queryRaw<{ hasta: Date | null }[]>`
    select public.bloqueado_hasta(${`${tipo}:${clave}`}) as hasta`;
  return r[0]?.hasta ?? null;
}

export async function limpiarIntentos(tipo: TipoLimite, clave: string): Promise<void> {
  await prisma.$executeRaw`select public.limpiar_intentos(${`${tipo}:${clave}`})`;
}
