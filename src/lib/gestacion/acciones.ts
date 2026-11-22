// Gestación · manejo pendiente: pasar a Maternidad, control de celo de retorno (días 18-24), diagnóstico de preñez
// (días 21-35 sin diagnóstico) y servicio de reproductoras vacías. Aparece primero en Órdenes de trabajo («Manejo»).
import "server-only";
import prisma from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";
import type { AccionMaternidad } from "@/lib/maternidad/acciones";

const DIA = 86_400_000;
export type AccionManejo = Omit<AccionMaternidad, "tipo"> & { tipo: string; href?: string };

export async function accionesGestacion(tenantId: string): Promise<AccionManejo[]> {
  const [estados, traslados, meta] = await Promise.all([
    getGestacionStates(tenantId),
    prisma.transferenciaAnimal.findMany({ where: { tenantId, origen: "GESTACION", estado: "ORDEN" }, select: { id: true, sowId: true, motivo: true, fechaProgramada: true } }),
    prisma.configMeta.findFirst({ where: { tenantId, modulo: "GESTACION", kpiKey: "dias_open_max" }, select: { valor: true } }),
  ]);
  const diasVacia = meta ? Number(meta.valor) : 5;
  const ids = Array.from(new Set([...estados.map(s => s.sowId), ...traslados.map(t => t.sowId).filter((x): x is string => !!x)]));
  const sows = new Map((await prisma.sow.findMany({ where: { id: { in: ids } }, select: { id: true, caravanaCode: true, identCode: true } })).map(s => [s.id, s.caravanaCode || s.identCode]));
  const nombre = (id: string) => sows.get(id) ?? id.slice(0, 6);
  const hoy = Date.now();
  const acciones: AccionManejo[] = [];

  for (const t of traslados) {
    const n = t.fechaProgramada ? Math.round((t.fechaProgramada.getTime() - hoy) / DIA) : 0;
    acciones.push({ id: `traslado-${t.id}`, tipo: "traslado", nivel: n < 0 ? "atrasado" : n === 0 ? "hoy" : "pronto", fecha: (t.fechaProgramada ?? new Date()).toISOString(), enDias: n,
      sowId: t.sowId ?? undefined, caravana: t.sowId ? nombre(t.sowId) : undefined, href: "/gestacion",
      titulo: `Pasar ${t.sowId ? nombre(t.sowId) : "reproductora"} a Maternidad`, detalle: t.motivo });
  }

  for (const s of estados) {
    const d = s.diasDesdeServ;
    if (s.estado === "SERVIDA" && d >= 18 && d <= 24) {
      acciones.push({ id: `celo-${s.serviceEventId}`, tipo: "celo", nivel: "hoy", fecha: new Date().toISOString(), enDias: 0, sowId: s.sowId, caravana: nombre(s.sowId), href: "/gestacion",
        titulo: `Control de celo de retorno: ${nombre(s.sowId)} (día ${d})`, detalle: "Revisá con el macho si volvió en celo. Si repite, registrá la repetición y volvé a servirla." });
    }
    if (s.estado === "SERVIDA" && !s.checkResult && d >= 21 && d <= 35) {
      const n = 28 - d;
      acciones.push({ id: `diag-${s.serviceEventId}`, tipo: "diagnostico", nivel: d > 30 ? "atrasado" : d >= 28 ? "hoy" : "pronto", fecha: new Date(hoy + n * DIA).toISOString(), enDias: n,
        sowId: s.sowId, caravana: nombre(s.sowId), href: "/gestacion",
        titulo: `Diagnóstico de preñez: ${nombre(s.sowId)} (día ${d})`, detalle: "Ecografía entre los días 21 y 35 del servicio. Registralo en Ingreso de datos → Diagnóstico." });
    }
  }

  // Vacías: días desde su último destete sin un servicio posterior
  const disponibles = estados.filter(s => s.estado === "DISPONIBLE").map(s => s.sowId);
  if (disponibles.length) {
    const destetes = await prisma.weaningEvent.findMany({ where: { tenantId, farrowing: { sowId: { in: disponibles } } }, orderBy: { weaningDate: "desc" },
      select: { weaningDate: true, farrowing: { select: { sowId: true } } } });
    const ultimo = new Map<string, Date>();
    for (const w of destetes) if (!ultimo.has(w.farrowing.sowId)) ultimo.set(w.farrowing.sowId, w.weaningDate);
    for (const [sowId, f] of ultimo) {
      const d = Math.floor((hoy - f.getTime()) / DIA);
      if (d < Math.max(1, diasVacia - 1) || d > 60) continue;
      acciones.push({ id: `servir-${sowId}`, tipo: "servicio", nivel: d > diasVacia ? "atrasado" : "hoy", fecha: f.toISOString(), enDias: diasVacia - d, sowId, caravana: nombre(sowId), href: "/gestacion",
        titulo: `Servir ${nombre(sowId)}: ${d} días desde el destete`, detalle: `La meta es servirla dentro de los ${diasVacia} días. Revisá el celo y registrá el servicio.` });
    }
  }
  const orden = { atrasado: 0, hoy: 1, pronto: 2 };
  return acciones.sort((a, b) => orden[a.nivel] - orden[b.nivel] || a.enDias - b.enDias);
}
