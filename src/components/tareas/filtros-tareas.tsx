"use client";
// Filtros comunes de las órdenes de trabajo: categoría (con cantidades), operador y orden.
import { CATEGORIAS_TAREA, ORDEN_CATEGORIAS, categoriaTarea, operadorTarea, type CategoriaTarea } from "@/lib/tareas/categorias";

type T = { tipo: string; titulo: string; responsableNombre: string | null; fechaVencimiento: string; prioridad: string };
export type OrdenTareas = "categoria" | "fecha" | "operador";

const PRIORIDAD: Record<string, number> = { urgente: 0, hoy: 1, programada: 2 };

export function filtrarTareas<X extends T>(xs: X[], f: { categoria: CategoriaTarea | ""; operador: string }): X[] {
  return xs.filter(t => (!f.categoria || categoriaTarea(t) === f.categoria) && (!f.operador || operadorTarea(t) === f.operador));
}

/** Grupos para mostrar: por categoría (en el orden fijo), por operador (A→Z) o uno solo por fecha. */
export function agruparTareas<X extends T>(xs: X[], orden: OrdenTareas): { clave: string; etiqueta: string; color: string; tareas: X[] }[] {
  const porFecha = (a: X, b: X) => (PRIORIDAD[a.prioridad] ?? 3) - (PRIORIDAD[b.prioridad] ?? 3) || a.fechaVencimiento.localeCompare(b.fechaVencimiento);
  if (orden === "fecha") return [{ clave: "todas", etiqueta: "", color: "", tareas: [...xs].sort(porFecha) }];
  if (orden === "operador") {
    const m = new Map<string, X[]>();
    for (const t of xs) { const k = operadorTarea(t); m.set(k, [...(m.get(k) ?? []), t]); }
    return Array.from(m.entries()).sort(([a], [b]) => (a === "Sin asignar" ? 1 : b === "Sin asignar" ? -1 : a.localeCompare(b)))
      .map(([k, ts]) => ({ clave: k, etiqueta: k, color: "var(--text-muted)", tareas: ts.sort(porFecha) }));
  }
  return ORDEN_CATEGORIAS.map(c => ({ clave: c, etiqueta: CATEGORIAS_TAREA[c].etiqueta, color: CATEGORIAS_TAREA[c].color, tareas: xs.filter(t => categoriaTarea(t) === c).sort(porFecha) }))
    .filter(g => g.tareas.length > 0);
}

export function FiltrosTareas({ tareas, categoria, setCategoria, operador, setOperador, orden, setOrden, compacto = false }: {
  tareas: T[];
  categoria: CategoriaTarea | ""; setCategoria: (c: CategoriaTarea | "") => void;
  operador: string; setOperador: (o: string) => void;
  orden?: OrdenTareas; setOrden?: (o: OrdenTareas) => void;
  compacto?: boolean;
}) {
  const conteo = new Map<CategoriaTarea, number>();
  for (const t of tareas) { const c = categoriaTarea(t); conteo.set(c, (conteo.get(c) ?? 0) + 1); }
  const operadores = Array.from(new Set(tareas.map(operadorTarea))).sort((a, b) => (a === "Sin asignar" ? 1 : b === "Sin asignar" ? -1 : a.localeCompare(b)));
  const alto = compacto ? 24 : 28, letra = compacto ? 10.5 : 11.5;
  const chip = (on: boolean): React.CSSProperties => ({
    height: alto, padding: "0 9px", fontSize: letra, borderRadius: 99, cursor: "pointer", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 5,
    border: `0.5px solid ${on ? "var(--text-primary)" : "var(--border-default)"}`, background: on ? "var(--bg-surface)" : "transparent",
    color: on ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: on ? 500 : 400,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div role="group" aria-label="Categoría" style={{ display: "flex", gap: 4, flexWrap: compacto ? "nowrap" : "wrap", overflowX: compacto ? "auto" : undefined }}>
        <button type="button" style={chip(!categoria)} onClick={() => setCategoria("")}>Todas ({tareas.length})</button>
        {ORDEN_CATEGORIAS.filter(c => conteo.has(c)).map(c => (
          <button key={c} type="button" style={chip(categoria === c)} aria-pressed={categoria === c} onClick={() => setCategoria(categoria === c ? "" : c)}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: CATEGORIAS_TAREA[c].color }} />
            {CATEGORIAS_TAREA[c].etiqueta} ({conteo.get(c)})
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select aria-label="Operador" value={operador} onChange={e => setOperador(e.target.value)} className="kp-input" style={{ height: alto + 2, fontSize: letra, width: "auto", maxWidth: 230 }}>
          <option value="">Todos los operadores</option>
          {operadores.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {orden && setOrden && (
          <select aria-label="Ordenar" value={orden} onChange={e => setOrden(e.target.value as OrdenTareas)} className="kp-input" style={{ height: alto + 2, fontSize: letra, width: "auto" }}>
            <option value="categoria">Agrupar por categoría</option>
            <option value="operador">Agrupar por operador</option>
            <option value="fecha">Ordenar por fecha</option>
          </select>
        )}
      </div>
    </div>
  );
}
