// Línea de tiempo de los ciclos de una cerda (ficha → "Ciclos"). Cálculo puro.
// Fila 0: desde la compra o el ingreso hasta el primer servicio. Cada parto abre un ciclo:
// servicio → gestación → parto → lactancia → destete → días vacía hasta el próximo servicio.
// Un servicio sin parto (repetición, vacía, aborto) es una fila propia que termina en rojo.

const DIA = 86_400_000;
const dias = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / DIA));

export type Servicio = { id: string; fecha: Date };
export type Parto = { id: string; servicioId: string | null; inicio: Date; duracionMin: number | null; vivos: number; muertos: number; momias: number; pesoMedio: number | null; destete: Destete | null; muertesLechones: number };
export type Destete = { fecha: Date; destetados: number; pesoMedio: number | null; recibidos: number; donados: number };
export type Fallo = { servicioId: string | null; fecha: Date; tipo: "REPETICION" | "ABORTO" | "VACIA" };

export type Entrada = {
  ingreso: Date; nacimiento: Date | null; compra: boolean; descarte: Date | null; hoy: Date;
  servicios: Servicio[]; partos: Parto[]; fallos: Fallo[];
  adopcionesRecibidas: { fecha: Date; cantidad: number }[]; adopcionesDonadas: { fecha: Date; cantidad: number }[];
  objetivo: { gestacion: number; lactancia: number; idsMax: number; edadPrimerServicio: number; adaptacion: number; tolerancia: number };
};

export type Nodo = { tipo: "COMPRA" | "INGRESO" | "SERVICIO" | "PARTO" | "DESTETE" | "FIN" | "HOY" | "REPETICION" | "ABORTO" | "VACIA" | "DESCARTE"; fecha: Date; arriba: string; centro: string; abajo: string[]; previsto?: boolean };
export type Tramo = { dias: number; etiqueta: string; abajo: string[]; perdida: boolean; previsto?: boolean };
export type Fila = { numero: number; nodos: Nodo[]; tramos: Tramo[] };

const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
const hm = (min: number | null) => (min === null ? null : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`);
const kg = (v: number | null) => (v === null ? null : `${v.toLocaleString("es-PY", { maximumFractionDigits: 2 })} kg`);

/** Agrupa servicios del mismo celo (dentro de 4 días): el círculo muestra cuántas montas o inseminaciones hubo. */
function celos(servicios: Servicio[]) {
  const orden = [...servicios].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const grupos: { fecha: Date; ids: string[] }[] = [];
  for (const s of orden) {
    const g = grupos[grupos.length - 1];
    if (g && s.fecha.getTime() - g.fecha.getTime() <= 4 * DIA) g.ids.push(s.id);
    else grupos.push({ fecha: s.fecha, ids: [s.id] });
  }
  return grupos;
}

export function ciclosCerda(e: Entrada): Fila[] {
  const filas: Fila[] = [];
  const grupos = celos(e.servicios);
  const fin = e.descarte ?? e.hoy;
  const finNodo = (fecha: Date, siguiente: boolean): Nodo => e.descarte && !siguiente
    ? { tipo: "DESCARTE", fecha, arriba: "Descarte", centro: "", abajo: [fmt(fecha)] }
    : siguiente ? { tipo: "FIN", fecha, arriba: "Fin del ciclo", centro: "", abajo: [fmt(fecha)] } : { tipo: "HOY", fecha, arriba: "Hoy", centro: "", abajo: [fmt(fecha)] };

  // ── Fila 0: compra o ingreso hasta el primer servicio ──
  const primero = grupos[0]?.fecha ?? null;
  const hasta0 = primero ?? fin;
  // Objetivo de la nulípara: la más tardía entre la edad objetivo y el ingreso + adaptación (Fase 10)
  const objetivo0 = new Date(Math.max(e.nacimiento ? e.nacimiento.getTime() + e.objetivo.edadPrimerServicio * DIA : 0, e.ingreso.getTime() + e.objetivo.adaptacion * DIA));
  filas.push({
    numero: 0,
    nodos: [{ tipo: e.compra ? "COMPRA" : "INGRESO", fecha: e.ingreso, arriba: `${e.compra ? "Compra" : "Ingreso"}\n${fmt(e.ingreso)}`, centro: "", abajo: [] }, finNodo(hasta0, !!primero)],
    tramos: [{ dias: dias(e.ingreso, hasta0), etiqueta: primero ? "Hasta el primer servicio" : "Sin servicio", abajo: [], perdida: hasta0.getTime() > objetivo0.getTime() + e.objetivo.tolerancia * DIA }],
  });

  // ── Un ciclo por celo con servicio ──
  let paridad = 0;
  grupos.forEach((g, i) => {
    const siguiente = grupos[i + 1]?.fecha ?? null;
    const parto = e.partos.find(p => p.servicioId && g.ids.includes(p.servicioId))
      ?? e.partos.find(p => p.inicio.getTime() > g.fecha.getTime() && (!siguiente || p.inicio.getTime() < siguiente.getTime()) && dias(g.fecha, p.inicio) <= 130);
    const fallo = e.fallos.find(f => (f.servicioId && g.ids.includes(f.servicioId)) || (f.fecha.getTime() > g.fecha.getTime() && (!siguiente || f.fecha.getTime() <= siguiente.getTime())));
    const nServ: Nodo = { tipo: "SERVICIO", fecha: g.fecha, arriba: `Servicio\n${fmt(g.fecha)}`, centro: String(g.ids.length), abajo: [] };
    if (parto) {
      paridad++;
      const nodos: Nodo[] = [nServ], tramos: Tramo[] = [];
      tramos.push({ dias: dias(g.fecha, parto.inicio), etiqueta: "Gestación", abajo: [], perdida: false });
      nodos.push({ tipo: "PARTO", fecha: parto.inicio, arriba: `Parto\n${fmt(parto.inicio)}`, centro: `${parto.vivos}/${parto.muertos + parto.momias}`, abajo: [kg(parto.pesoMedio), hm(parto.duracionMin)].filter((x): x is string => !!x) });
      const desde = parto.inicio, hastaLact = parto.destete?.fecha ?? null;
      const recibidos = e.adopcionesRecibidas.filter(a => a.fecha >= desde && (!hastaLact || a.fecha <= hastaLact)).reduce((s, a) => s + a.cantidad, 0) + (parto.destete?.recibidos ?? 0);
      const donados = e.adopcionesDonadas.filter(a => a.fecha >= desde && (!hastaLact || a.fecha <= hastaLact)).reduce((s, a) => s + a.cantidad, 0) + (parto.destete?.donados ?? 0);
      const detalle = [`Recibidos: ${recibidos}`, `Donados: ${donados}`, `Muertes: ${parto.muertesLechones}`];
      if (parto.destete) {
        tramos.push({ dias: dias(parto.inicio, parto.destete.fecha), etiqueta: "Lactancia", abajo: detalle, perdida: false });
        nodos.push({ tipo: "DESTETE", fecha: parto.destete.fecha, arriba: `Destete\n${fmt(parto.destete.fecha)}`, centro: String(parto.destete.destetados), abajo: [kg(parto.destete.pesoMedio)].filter((x): x is string => !!x) });
        const hasta = siguiente ?? fin;
        const d = dias(parto.destete.fecha, hasta);
        tramos.push({ dias: d, etiqueta: siguiente ? "Días vacía (IDS)" : e.descarte ? "Hasta el descarte" : "Vacía", abajo: [], perdida: d > e.objetivo.idsMax });
        nodos.push(finNodo(hasta, !!siguiente));
      } else {
        // En lactancia: destete previsto (punteado)
        const previsto = new Date(parto.inicio.getTime() + e.objetivo.lactancia * DIA);
        tramos.push({ dias: dias(parto.inicio, previsto), etiqueta: "Lactancia", abajo: detalle, perdida: false, previsto: true });
        nodos.push({ tipo: "DESTETE", fecha: previsto, arriba: `Destete previsto\n${fmt(previsto)}`, centro: String(Math.max(0, parto.vivos + recibidos - donados - parto.muertesLechones)), abajo: [], previsto: true });
      }
      filas.push({ numero: paridad, nodos, tramos });
      return;
    }
    // Sin parto
    const finFallo = fallo?.fecha ?? siguiente ?? null;
    if (fallo || siguiente) {
      const tipo: Nodo["tipo"] = fallo?.tipo === "ABORTO" ? "ABORTO" : fallo?.tipo === "VACIA" ? "VACIA" : "REPETICION";
      const nombre = tipo === "ABORTO" ? "Aborto" : tipo === "VACIA" ? "Vacía (diagnóstico)" : "Repitió celo";
      const fFin = finFallo!;
      const nodos: Nodo[] = [nServ, { tipo, fecha: fFin, arriba: `${nombre}\n${fmt(fFin)}`, centro: "", abajo: [] }];
      const tramos: Tramo[] = [{ dias: dias(g.fecha, fFin), etiqueta: "Servicio sin parto", abajo: [], perdida: true }];
      if (siguiente && fFin.getTime() < siguiente.getTime()) {
        const d = dias(fFin, siguiente);
        tramos.push({ dias: d, etiqueta: "Hasta el nuevo servicio", abajo: [], perdida: true });
        nodos.push(finNodo(siguiente, true));
      } else if (!siguiente) {
        tramos.push({ dias: dias(fFin, fin), etiqueta: e.descarte ? "Hasta el descarte" : "Vacía", abajo: [], perdida: true });
        nodos.push(finNodo(fin, false));
      }
      filas.push({ numero: paridad, nodos, tramos });
      return;
    }
    // Último servicio, todavía gestando: parto previsto (punteado)
    const previsto = new Date(g.fecha.getTime() + e.objetivo.gestacion * DIA);
    filas.push({
      numero: paridad + 1,
      nodos: [nServ, { tipo: "PARTO", fecha: previsto, arriba: `Parto previsto\n${fmt(previsto)}`, centro: "", abajo: [`faltan ${dias(e.hoy, previsto)} días`], previsto: true }],
      tramos: [{ dias: dias(g.fecha, previsto), etiqueta: `Gestación (lleva ${dias(g.fecha, e.hoy)})`, abajo: [], perdida: false, previsto: true }],
    });
  });
  return filas.reverse(); // el ciclo más nuevo arriba
}
