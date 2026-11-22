// Maternidad · acciones que hay que hacer (hoy y en los próximos días): destetes avisados con anticipación,
// partos esperados, reproductoras por recibir. Lo usan el recuadro de Maternidad, la campanita y el Dashboard.
import "server-only";
import prisma from "@/lib/db/prisma";
import { getGestacionStates } from "@/lib/gestacion/sow-state";
import { SELECT_STOCK_CAMADA } from "@/lib/maternidad/camadas";
import { stockCamada } from "@/lib/auditoria/granja";

const DIA = 86_400_000;
const GESTACION = 114;

export type AccionMaternidad = {
  id: string; tipo: "destete" | "parto" | "recibir";
  nivel: "atrasado" | "hoy" | "pronto";
  titulo: string; detalle: string; fecha: string; enDias: number; sowId?: string; caravana?: string;
};

async function parametros(tenantId: string) {
  const metas = await prisma.configMeta.findMany({ where: { tenantId, kpiKey: { in: ["dias_lactancia", "dias_aviso_destete", "dias_aviso_parto"] } }, select: { kpiKey: true, valor: true } });
  const v = (k: string, d: number) => { const m = metas.find(x => x.kpiKey === k); return m ? Number(m.valor) : d; };
  return { lactancia: v("dias_lactancia", 21), avisoDestete: v("dias_aviso_destete", 2), avisoParto: v("dias_aviso_parto", 3) };
}

/** Días calendario (Paraguay) entre hoy y una fecha: 0 = hoy, negativo = atrasado. */
function diasDesdeHoy(d: Date) {
  const f = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion" }).format(x);
  return Math.round((new Date(`${f(d)}T00:00:00Z`).getTime() - new Date(`${f(new Date())}T00:00:00Z`).getTime()) / DIA);
}
const fechaTxt = (d: Date) => new Intl.DateTimeFormat("es-PY", { timeZone: "America/Asuncion", weekday: "short", day: "2-digit", month: "2-digit" }).format(d);
const cuando = (n: number) => n < 0 ? `atrasado ${-n} día${n === -1 ? "" : "s"}` : n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`;

export async function accionesMaternidad(tenantId: string): Promise<AccionMaternidad[]> {
  const [p, camadas, estados, porRecibir] = await Promise.all([
    parametros(tenantId),
    prisma.farrowingEvent.findMany({ where: { tenantId, weaning: null, sow: { isActive: true } },
      select: { id: true, startDatetime: true, sow: { select: { id: true, caravanaCode: true, identCode: true, plantelState: true } }, ...SELECT_STOCK_CAMADA } }),
    getGestacionStates(tenantId),
    prisma.transferenciaAnimal.count({ where: { tenantId, destino: "MATERNIDAD", estado: "EN_CAMINO" } }),
  ]);
  const acciones: AccionMaternidad[] = [];

  // Destetes: se avisan N días antes de cumplir los días de lactancia
  for (const c of camadas) {
    const lechones = stockCamada(c);
    if (lechones <= 0) continue;
    const destete = new Date(c.startDatetime.getTime() + p.lactancia * DIA);
    const n = diasDesdeHoy(destete);
    if (n > p.avisoDestete) continue;
    const caravana = c.sow.caravanaCode || c.sow.identCode;
    const edad = -diasDesdeHoy(c.startDatetime);
    acciones.push({ id: `destete-${c.id}`, tipo: "destete", nivel: n < 0 ? "atrasado" : n === 0 ? "hoy" : "pronto", fecha: destete.toISOString(), enDias: n,
      sowId: c.sow.id, caravana, titulo: `Destete de ${caravana} ${cuando(n)}`,
      detalle: `${lechones} lechones con ${edad} días · fecha ${fechaTxt(destete)}. ${n < 0 ? "Ya pasó la fecha: destetá cuanto antes." : "Prepará el lugar en Iniciación y la balanza para pesar la camada."}` });
  }

  // Partos esperados (114 días desde el servicio) en los próximos días
  const enMaternidad = new Set(camadas.map(c => c.sow.id));
  const sows = await prisma.sow.findMany({ where: { id: { in: estados.filter(s => s.estado !== "DISPONIBLE").map(s => s.sowId) } }, select: { id: true, caravanaCode: true, identCode: true, plantelState: true } });
  const sowPorId = new Map(sows.map(s => [s.id, s]));
  for (const s of estados) {
    if (s.estado === "DISPONIBLE" || enMaternidad.has(s.sowId)) continue;
    const parto = new Date(s.serviceDate.getTime() + GESTACION * DIA);
    const n = diasDesdeHoy(parto);
    if (n > p.avisoParto || n < -7) continue;
    const sw = sowPorId.get(s.sowId);
    const caravana = sw ? sw.caravanaCode || sw.identCode : s.sowId.slice(0, 6);
    const enSala = sw?.plantelState === "FARROWING";
    acciones.push({ id: `parto-${s.sowId}`, tipo: "parto", nivel: n < 0 ? "atrasado" : n === 0 ? "hoy" : "pronto", fecha: parto.toISOString(), enDias: n,
      sowId: s.sowId, caravana, titulo: `Parto probable de ${caravana} ${cuando(n)}`,
      detalle: `${enSala ? "Ya está en la sala de partos." : "Todavía no está en Maternidad: pedí el traslado."} Tené lista la jaula, la lámpara y los elementos para atender el parto.` });
  }

  if (porRecibir > 0) acciones.push({ id: "recibir", tipo: "recibir", nivel: "hoy", fecha: new Date().toISOString(), enDias: 0,
    titulo: `${porRecibir} reproductora${porRecibir === 1 ? "" : "s"} por recibir`, detalle: "Gestación ya las envió: aceptá la recepción en el recuadro Transferencias." });

  const orden = { atrasado: 0, hoy: 1, pronto: 2 };
  return acciones.sort((a, b) => orden[a.nivel] - orden[b.nivel] || a.enDias - b.enDias);
}
