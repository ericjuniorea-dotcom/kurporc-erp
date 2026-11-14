// Fase 15.2 · Consultas del buzón que comparten el panel, la hoja de ruta y el Inicio del panel.
import "server-only";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

export const TIPOS_BUZON = { PROBLEMA: "Algo no funciona", CONSULTA: "Tengo una duda", SUGERENCIA: "Una idea para mejorar", FUNCION_NUEVA: "Quiero una función nueva" } as const;
export const ESTADOS_BUZON = { NUEVA: "Nueva", EN_REVISION: "En revisión", EN_DESARROLLO: "En desarrollo", HECHA: "Hecha", DESCARTADA: "Descartada" } as const;
export const PRIORIDADES = { ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" } as const;
export type TipoBuzon = keyof typeof TIPOS_BUZON;
export type EstadoBuzon = keyof typeof ESTADOS_BUZON;

/**
 * Cuántas organizaciones distintas piden cada mensaje: autores del grupo (el mensaje y los agrupados en él)
 * más quienes votaron. Una persona sin organización cuenta por sí misma.
 */
export async function demanda(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const filas = await prisma.$queryRaw<{ id: string; n: bigint }[]>`
    select s.id::text as id, count(distinct q.quien) as n
    from public.sugerencia s
    join lateral (
      select coalesce(g.organizacion_id, g.usuario_id) as quien
        from public.sugerencia g where g.id = s.id or g.agrupada_en = s.id
      union all
      select coalesce(v.organizacion_id, v.usuario_id)
        from public.sugerencia_voto v
        join public.sugerencia g on g.id = v.sugerencia_id
       where g.id = s.id or g.agrupada_en = s.id
    ) q on true
    where s.id in (${Prisma.join(ids.map(i => Prisma.sql`${i}::uuid`))})
    group by s.id`;
  return new Map(filas.map(f => [f.id, Number(f.n)]));
}

/** Funciones (no agrupadas, abiertas) ordenadas por organizaciones que las piden. */
export async function funcionesMasPedidas(minimo = 1, limite = 10) {
  const abiertas = await prisma.sugerencia.findMany({
    where: { tipo: "FUNCION_NUEVA", agrupadaEn: null, estado: { notIn: ["HECHA", "DESCARTADA"] } },
    select: { id: true, titulo: true, tituloPublico: true, estado: true, modulo: true },
  });
  const n = await demanda(abiertas.map(a => a.id));
  return abiertas.map(a => ({ ...a, pedidas: n.get(a.id) ?? 1 }))
    .filter(a => a.pedidas >= minimo)
    .sort((a, b) => b.pedidas - a.pedidas)
    .slice(0, limite);
}
