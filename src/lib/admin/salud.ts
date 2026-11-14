// Fase 15.4 · Salud de cada organización (no tiendas). Se cachea 10 minutos (etiqueta admin-salud).
// «Carga de datos» = al menos una fila CREADA (createdAt, no la fecha del evento) en servicios, partos,
// destetes, aplicaciones sanitarias, movimientos o ventas.
import "server-only";
import { unstable_cache } from "next/cache";
import prisma from "@/lib/db/prisma";
import { hoyUTC } from "@/lib/finanzas/calculos";
import { calcularSalud, type Salud } from "./salud-calculo";

export { SALUD, calcularSalud, type Salud } from "./salud-calculo";

const DIA = 86_400_000;

export type SaludOrg = { estado: Salud; diasDesdeAlta: number; diasDesdeUltimoUso: number | null; primerosPasos: boolean; cargoUltimos7: boolean; ultimaCarga: string | null };

async function calcular(): Promise<Record<string, SaludOrg>> {
  const hoy = hoyUTC();
  const [orgs, uso, duenos, cargas] = await Promise.all([
    prisma.tenant.findMany({ where: { tipo: { not: "VENDEDOR" } }, select: { id: true, createdAt: true } }),
    prisma.actividadDiaria.groupBy({ by: ["organizacionId"], where: { organizacionId: { not: null } }, _max: { fecha: true } }),
    prisma.miembro.findMany({ where: { esPropietario: true }, select: { organizacionId: true, perfil: { select: { onboardingCompleto: true } } } }),
    prisma.$queryRaw<{ org: string; ultima: Date }[]>`
      select org, max(c) as ultima from (
        select "tenantId" as org, max("createdAt") as c from public.service_events group by 1
        union all select "tenantId", max("createdAt") from public.farrowing_events group by 1
        union all select "tenantId", max("createdAt") from public.weaning_events group by 1
        union all select "tenantId", max("createdAt") from public.aplicaciones_vacunas group by 1
        union all select organizacion_id, max(created_at) from public.movimiento group by 1
        union all select organizacion_id, max(created_at) from public.venta group by 1
      ) t group by org`,
  ]);
  const ultimoUso = new Map(uso.map(u => [u.organizacionId!, u._max.fecha]));
  const pasos = new Map<string, boolean>();
  for (const d of duenos) pasos.set(d.organizacionId, (pasos.get(d.organizacionId) ?? false) || d.perfil.onboardingCompleto);
  const ultimaCarga = new Map(cargas.map(c => [c.org, c.ultima]));
  const salida: Record<string, SaludOrg> = {};
  for (const o of orgs) {
    const u = ultimoUso.get(o.id) ?? null;
    const carga = ultimaCarga.get(o.id) ?? null;
    const entrada = {
      diasDesdeAlta: Math.floor((Date.now() - o.createdAt.getTime()) / DIA),
      diasDesdeUltimoUso: u ? Math.round((hoy.getTime() - u.getTime()) / DIA) : null,
      primerosPasos: pasos.get(o.id) ?? false,
      cargoUltimos7: !!carga && Date.now() - carga.getTime() < 7 * DIA,
      cargoAlgunaVez: !!carga,
    };
    salida[o.id] = { estado: calcularSalud(entrada), ...entrada, ultimaCarga: carga?.toISOString() ?? null };
  }
  return salida;
}

export const saludOrganizaciones = unstable_cache(calcular, ["admin-salud"], { revalidate: 600, tags: ["admin-salud"] });
