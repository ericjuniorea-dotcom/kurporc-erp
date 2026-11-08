"use client";
// Matriz de permisos (Fase 7.2): todo el catálogo agrupado por área y recurso.
import { useMemo, useState } from "react";
import { IconAlertTriangle, IconLock, IconSearch } from "@tabler/icons-react";

export type PermisoUI = {
  clave: string; grupo: string; modulo: string; recurso: string; accion: string;
  descripcion: string; sensible: boolean; soloPropietario: boolean;
};

const NOMBRE_ACCION: Record<string, string> = {
  ver: "Ver", crear: "Cargar", editar: "Corregir", anular: "Anular", dar_baja: "Dar de baja", exportar: "Exportar",
  configurar: "Configurar", cerrar: "Cerrar", liberar: "Liberar", contar: "Contar", asignar: "Asignar", completar: "Completar",
  usar: "Usar", registrar_pago: "Pagar", aprobar: "Aprobar", registrar_cobro: "Cobrar", editar_cuentas: "Editar cuentas",
  declarar_saldo: "Declarar saldo", ver_numero: "Ver nº cuenta", marcar_pagado: "Marcar pagado", escribir_causa: "Escribir causa",
  editar_supuestos: "Supuestos", evaluar: "Evaluar", registrar: "Registrar", gestionar: "Gestionar", ejecutar: "Ejecutar",
  cancelar: "Cancelar", recibir: "Recibir", invitar: "Invitar", crear_gestionada: "Crear operario", suspender: "Suspender",
  quitar: "Quitar", transferir: "Transferir", archivar: "Archivar", pausar: "Pausar", confirmar: "Confirmar", rechazar: "Rechazar",
  despachar: "Despachar", responder: "Responder",
};

type Fila = { base: string; grupo: string; descripcion: string; permisos: PermisoUI[] };

export function filasDe(catalogo: PermisoUI[]): Fila[] {
  const mapa = new Map<string, Fila>();
  for (const p of catalogo) {
    const base = `${p.modulo}.${p.recurso}`;
    if (!mapa.has(base)) mapa.set(base, { base, grupo: p.grupo, descripcion: p.descripcion, permisos: [] });
    mapa.get(base)!.permisos.push(p);
  }
  return Array.from(mapa.values());
}

/** Resumen en lenguaje simple de lo que va a poder hacer la persona. */
export function resumenPermisos(sel: Set<string>, catalogo: PermisoUI[]): string {
  if (sel.size === 0) return "No va a poder ver ni cargar nada todavía.";
  const grupos = new Map<string, { ver: number; cargar: number }>();
  for (const p of catalogo) {
    if (!sel.has(p.clave)) continue;
    const g = grupos.get(p.grupo) ?? { ver: 0, cargar: 0 };
    if (p.accion === "ver") g.ver++; else g.cargar++;
    grupos.set(p.grupo, g);
  }
  const partes = Array.from(grupos.entries()).map(([g, v]) => `${v.cargar ? "ver y cargar" : "ver"} en ${g}`);
  const extras: string[] = [];
  if (!Array.from(sel).some(c => c.startsWith("finanzas."))) extras.push("no va a ver montos de finanzas");
  if (!sel.has("rrhh.sueldos.ver")) extras.push("no ve sueldos");
  if (!sel.has("rrhh.datos_personales.ver")) extras.push("no ve datos personales del personal");
  return `Va a poder ${partes.join(", ")}${extras.length ? `; ${extras.join(", ")}` : ""}.`;
}

export function MatrizPermisos({ catalogo, seleccion, onChange, base, permitidos }: {
  catalogo: PermisoUI[];
  seleccion: Set<string>;
  onChange: (s: Set<string>) => void;
  base: Set<string>;                 // permisos del rol elegido (para resaltar diferencias)
  permitidos: Set<string> | null;    // null = propietario (puede dar todo); si no, solo lo que tiene
}) {
  const [busca, setBusca] = useState("");
  const filas = useMemo(() => filasDe(catalogo), [catalogo]);
  const q = busca.trim().toLowerCase();
  const visibles = filas.filter(f => !q || f.descripcion.toLowerCase().includes(q) || f.base.includes(q) || f.grupo.toLowerCase().includes(q));
  const grupos = Array.from(new Set(visibles.map(f => f.grupo)));

  const bloqueado = (p: PermisoUI) => p.soloPropietario || (permitidos !== null && !permitidos.has(p.clave));

  function alternar(p: PermisoUI, fila: Fila) {
    if (bloqueado(p)) return;
    const s = new Set(seleccion);
    const ver = fila.permisos.find(x => x.accion === "ver");
    if (s.has(p.clave)) {
      s.delete(p.clave);
      if (p.accion === "ver") fila.permisos.forEach(x => s.delete(x.clave)); // sin ver, nada de la fila
    } else {
      s.add(p.clave);
      if (ver && p.accion !== "ver" && !bloqueado(ver)) s.add(ver.clave);   // cualquier acción implica ver
    }
    onChange(s);
  }

  function rapido(fila: Fila, modo: "nada" | "ver" | "cargar" | "todo") {
    const s = new Set(seleccion);
    for (const p of fila.permisos) {
      if (bloqueado(p)) continue;
      const on = modo === "todo" || (modo === "ver" && p.accion === "ver") || (modo === "cargar" && (p.accion === "ver" || p.accion === "crear"));
      if (on) s.add(p.clave); else s.delete(p.clave);
    }
    onChange(s);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ position: "relative" }}>
        <IconSearch size={14} aria-hidden style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar permiso (ej. partos, sueldos, vacunas)"
          className="kp-input" style={{ paddingLeft: 30 }} aria-label="Buscar permiso" />
      </div>
      <div style={{ maxHeight: 380, overflowY: "auto", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)" }}>
        {grupos.map(g => (
          <div key={g}>
            <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg-elevated)", padding: "6px 10px", fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "0.5px solid var(--border-default)" }}>{g}</div>
            {visibles.filter(f => f.grupo === g).map(fila => {
              const sensible = fila.permisos.some(p => p.sensible);
              return (
                <div key={fila.base} style={{ padding: "8px 10px", borderBottom: "0.5px solid var(--border-default)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 12, color: "var(--text-primary)", display: "flex", gap: 5, alignItems: "flex-start" }}>
                      {sensible && <IconAlertTriangle size={13} aria-label="Sensible" style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />}
                      {fila.descripcion}
                    </span>
                    <span style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                      {(["nada", "ver", "cargar", "todo"] as const).map(m => (
                        <button key={m} type="button" onClick={() => rapido(fila, m)}
                          style={{ fontSize: 9.5, padding: "2px 5px", borderRadius: 4, border: "0.5px solid var(--border-default)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}>
                          {m === "nada" ? "Nada" : m === "ver" ? "Ver" : m === "cargar" ? "Ver+cargar" : "Todo"}
                        </button>
                      ))}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {fila.permisos.map(p => {
                      const on = seleccion.has(p.clave);
                      const distinto = on !== base.has(p.clave);
                      const bloq = bloqueado(p);
                      return (
                        <label key={p.clave} title={p.soloPropietario ? "Solo el Administrador General" : bloq ? "No podés dar un permiso que no tenés" : p.clave}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, padding: "3px 8px", borderRadius: 999,
                            cursor: bloq ? "not-allowed" : "pointer", opacity: bloq ? 0.5 : 1,
                            border: `0.5px solid ${distinto ? "var(--accent)" : "var(--border-default)"}`,
                            background: on ? "var(--accent-subtle)" : "transparent", color: on ? "var(--accent-text)" : "var(--text-secondary)",
                          }}>
                          <input type="checkbox" checked={on} disabled={bloq} onChange={() => alternar(p, fila)} style={{ accentColor: "var(--accent)", margin: 0 }} />
                          {p.soloPropietario && <IconLock size={10} aria-hidden />}
                          {NOMBRE_ACCION[p.accion] ?? p.accion}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {visibles.length === 0 && <div style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>Ningún permiso coincide con “{busca}”.</div>}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span><IconAlertTriangle size={11} aria-hidden style={{ color: "var(--warning)", verticalAlign: -1 }} /> ve plata, datos personales o anula registros</span>
        <span><IconLock size={11} aria-hidden style={{ verticalAlign: -1 }} /> solo el Administrador General</span>
        <span style={{ color: "var(--accent)" }}>borde rojo = distinto del rol</span>
      </div>
    </div>
  );
}
