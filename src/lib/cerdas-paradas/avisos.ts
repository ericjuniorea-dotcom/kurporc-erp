// Fase 10 · Aviso diario de cerdas paradas. Una vez por día y organización, al primer uso del panel.
// Llega al propietario y a quien ve cerdas paradas; los guaraníes solo a quien tiene finanzas.cerdas_paradas.ver.
import "server-only";
import prisma from "@/lib/db/prisma";
import { gs, hoyUTC } from "@/lib/finanzas/calculos";
import { NOMBRE_CAUSA } from "./calculo";
import { resumenParadas } from "./datos";

const hechos = new Set<string>(); // org|día ya revisados en esta instancia

export async function avisarCerdasParadas(org: string): Promise<void> {
  const hoy = hoyUTC(), clave = `${org}|${hoy.toISOString().slice(0, 10)}`;
  if (hechos.has(clave)) return;
  hechos.add(clave);
  const ya = await prisma.notificacion.findFirst({ where: { organizacionId: org, tipo: "CERDAS_PARADAS", createdAt: { gte: hoy } }, select: { id: true } });
  if (ya) return;
  if (!(await prisma.sow.count({ where: { tenantId: org, isActive: true } }))) return;
  const r = await resumenParadas(org);
  if (!r.paradas.length) return;

  const miembros = await prisma.miembro.findMany({
    where: { organizacionId: org, estado: "ACTIVO" },
    select: { userId: true, esPropietario: true, rol: { select: { permisos: { where: { permisoClave: { in: ["finanzas.cerdas_paradas.ver", "gestacion.cerdas_paradas.ver"] } }, select: { permisoClave: true } } } } },
  });
  const vencidas = r.paradas.filter(p => p.alerta);
  const detalle = vencidas.slice(0, 5).map(p => `cerda ${p.codigo} (${NOMBRE_CAUSA[p.causa].toLowerCase()}, ${p.dias} d)`).join(", ");
  const datos = miembros.flatMap(m => {
    const claves = new Set(m.rol?.permisos.map(x => x.permisoClave) ?? []);
    const conMontos = m.esPropietario || claves.has("finanzas.cerdas_paradas.ver");
    if (!conMontos && !claves.has("gestacion.cerdas_paradas.ver")) return [];
    const n = r.paradas.length;
    return [{
      userId: m.userId, organizacionId: org, tipo: "CERDAS_PARADAS",
      titulo: conMontos ? `${n} cerda${n > 1 ? "s" : ""} parada${n > 1 ? "s" : ""} te ${n > 1 ? "están" : "está"} costando ${gs(r.perdidaDiariaHoyGs)} por día` : `${n} cerda${n > 1 ? "s" : ""} parada${n > 1 ? "s" : ""} hoy`,
      cuerpo: vencidas.length ? `Pasaron el plazo de aviso: ${detalle}${vencidas.length > 5 ? "…" : ""}.` : "Revisá la acción sugerida para cada una.",
      enlace: conMontos ? "/finanzas/cerdas-paradas" : "/gestacion/cerdas-paradas",
    }];
  });
  if (datos.length) await prisma.notificacion.createMany({ data: datos });
}
