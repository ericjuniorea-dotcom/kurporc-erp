// Próximas vacunas de una cerda según el protocolo sanitario (ficha → Vacunas). Cálculo puro.
// 1) Agendadas: eventos de la agenda (pendientes o atrasados) con su fecha real.
// 2) Estimadas: las del próximo tramo del ciclo que todavía no están en la agenda, con fecha estimada
//    desde el destete previsto, el servicio estimado o el parto previsto.

const DIA = 86_400_000;
const mas = (d: Date, n: number) => new Date(d.getTime() + n * DIA);

export type ItemProtocolo = { id: string; dia: number; disparador: string; vacuna: string; descripcion: string | null };
export type EventoAgenda = { id: string; fecha: Date; estado: string; vacuna: string; descripcion: string | null; protocoloItemId: string | null };

export type Proxima = {
  fecha: Date | null;
  estimada: boolean;
  /** Cómo se calculó, ej. «7 días después del parto» o «día 70 del próximo servicio (estimado 28/11)». */
  base: string;
  vacunas: { eventoId: string | null; nombre: string; descripcion: string | null; estado: "pendiente" | "retrasado" | "estimada" | "al-servir" }[];
};

export type EntradaProximas = {
  hoy: Date;
  estado: string | null;
  activa: boolean;
  partoAbierto: Date | null;
  /** Último servicio sin parto todavía (gestando o a confirmar). */
  servicioEnCurso: Date | null;
  agenda: EventoAgenda[];
  items: ItemProtocolo[];
  param: { gestacion: number; lactancia: number; ids: number };
};

const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const cuando = (dia: number, que: string) => dia === 0 ? `el día del ${que}` : `${Math.abs(dia)} días ${dia > 0 ? "después" : "antes"} del ${que}`;

export function proximasCerda(e: EntradaProximas): Proxima[] {
  if (!e.activa) return [];
  const salida: Proxima[] = [];

  // 1) Agendadas (fecha real)
  const pendientes = e.agenda.filter(a => a.estado === "pendiente" || a.estado === "retrasado");
  for (const a of pendientes) {
    salida.push({
      fecha: a.fecha, estimada: false, base: "agenda del protocolo",
      vacunas: [{ eventoId: a.id, nombre: a.vacuna, descripcion: a.descripcion, estado: a.fecha.getTime() < e.hoy.getTime() || a.estado === "retrasado" ? "retrasado" : "pendiente" }],
    });
  }
  // Un ítem ya agendado (en cualquier estado) desde el inicio del tramo actual no se vuelve a estimar
  const desde = e.partoAbierto ?? e.servicioEnCurso ?? null;
  const agendado = new Set(e.agenda.filter(a => a.protocoloItemId && (!desde || a.fecha.getTime() >= desde.getTime())).map(a => a.protocoloItemId!));
  const estimar = (item: ItemProtocolo, fecha: Date | null, base: string) => {
    if (agendado.has(item.id)) return;
    salida.push({ fecha, estimada: true, base, vacunas: [{ eventoId: null, nombre: item.vacuna, descripcion: item.descripcion, estado: fecha ? "estimada" : "al-servir" }] });
  };
  const de = (d: string) => e.items.filter(i => i.disparador === d);

  if (e.partoAbierto) {
    // En lactancia: lo que falta del parto, el destete y el próximo ciclo
    const destete = mas(e.partoAbierto, e.param.lactancia);
    const servicio = mas(destete, e.param.ids);
    const parto = mas(servicio, e.param.gestacion);
    for (const i of de("parto")) estimar(i, mas(e.partoAbierto, i.dia), cuando(i.dia, "parto"));
    for (const i of de("destete")) estimar(i, mas(destete, i.dia), `${cuando(i.dia, "destete")} (previsto ${fmt(destete)})`);
    // Próximo ciclo: todavía no hay nada agendado para él (la agenda se arma al registrar el servicio y el parto)
    const proximo = (i: ItemProtocolo, fecha: Date, base: string) =>
      salida.push({ fecha, estimada: true, base, vacunas: [{ eventoId: null, nombre: i.vacuna, descripcion: i.descripcion, estado: "estimada" }] });
    for (const i of de("servicio")) proximo(i, mas(servicio, i.dia), `día ${i.dia} del próximo servicio (estimado ${fmt(servicio)})`);
    for (const i of de("parto")) proximo(i, mas(parto, i.dia), `${cuando(i.dia, "próximo parto")} (estimado ${fmt(parto)})`);
  } else if (e.servicioEnCurso) {
    // Servida o gestante: lo que falta de la gestación y el parto previsto
    const parto = mas(e.servicioEnCurso, e.param.gestacion);
    for (const i of de("servicio")) estimar(i, mas(e.servicioEnCurso, i.dia), `día ${i.dia} de gestación`);
    for (const i of de("parto")) estimar(i, mas(parto, i.dia), `${cuando(i.dia, "parto")} (previsto ${fmt(parto)})`);
  } else {
    // Vacía, lista para servicio o en cuarentena: se agendan al registrar el servicio
    for (const i of de("servicio")) estimar(i, null, `día ${i.dia} después del servicio (se agenda al registrarlo)`);
  }

  // Agrupar por fecha (las que se aplican juntas el mismo día) y ordenar: primero las fechadas
  const grupos = new Map<string, Proxima>();
  for (const p of salida) {
    const k = `${p.fecha ? p.fecha.toISOString().slice(0, 10) : "sin"}|${p.estimada}|${p.base}`;
    const g = grupos.get(k);
    if (g) g.vacunas.push(...p.vacunas); else grupos.set(k, { ...p, vacunas: [...p.vacunas] });
  }
  return Array.from(grupos.values()).sort((a, b) => (a.fecha?.getTime() ?? Infinity) - (b.fecha?.getTime() ?? Infinity));
}
