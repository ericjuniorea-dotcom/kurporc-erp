"use client";
// Caravana con ficha flotante: al pasar el cursor (o enfocar con el teclado) muestra el resumen de la cerda;
// al hacer clic abre su ficha completa. Se usa en todas las tablas de inconsistencias y listados.
import { useRef, useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";

type Tarjeta = {
  sow: { id: string; identCode: string; tattooCode: string | null; breed: string | null; birthDate: string | null; entryDate: string; isActive: boolean; plantelState: string | null; currentParityCount: number; plantelNotes: string | null };
  servicio: { codigo: string | null; serviceDate: string; pregnancyChecks: { result: string; checkDate: string }[] } | null;
  parto: { codigo: string | null; startDatetime: string; bornAlive: number; bornDead: number; weaning: { weaningDate: string; pigletsWeaned: number } | null } | null;
  baja: { discardDate: string; motivoPrincipal: string | null; tipoDescarte: string | null } | null;
  destetadosTotal: number;
};

const cache = new Map<string, Promise<Tarjeta | null>>();
const cargar = (id: string) => {
  if (!cache.has(id)) cache.set(id, fetch(`/api/plantel/animales/${id}/tarjeta`).then(r => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(id)!;
};
const f = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "—");
const dias = (s: string) => Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000);
const ESTADO: Record<string, string> = {
  QUARANTINE: "En cuarentena", REPLACEMENT_DEVELOPING: "Cachorra en desarrollo", REPLACEMENT_READY: "Cachorra lista para servir", MATED: "Servida",
  PREGNANT: "Gestante", FARROWING: "Pariendo", LACTATING: "En lactancia", EMPTY: "Vacía", CULLED: "Descartada", DEAD: "Muerta",
};

export function CaravanaFicha({ sowId, caravana }: { sowId: string; caravana: string }) {
  const [abierta, setAbierta] = useState(false);
  const [datos, setDatos] = useState<Tarjeta | null | undefined>(undefined);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ancla = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number }>({ left: 0 });
  // Posición fija: las tablas con desplazamiento horizontal recortarían una tarjeta absoluta
  const mostrar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      const r = ancla.current?.getBoundingClientRect();
      if (r) {
        const left = Math.max(8, Math.min(r.left, window.innerWidth - 296));
        setPos(window.innerHeight - r.bottom < 260 ? { bottom: window.innerHeight - r.top + 6, left } : { top: r.bottom + 6, left });
      }
      setAbierta(true); if (datos === undefined) cargar(sowId).then(setDatos);
    }, 150);
  };
  const ocultar = () => { if (temporizador.current) clearTimeout(temporizador.current); temporizador.current = setTimeout(() => setAbierta(false), 120); };
  const s = datos?.sow;

  return (
    <span style={{ position: "relative", display: "inline-block" }} onMouseEnter={mostrar} onMouseLeave={ocultar}>
      <a ref={ancla} href={`/plantel?cerda=${sowId}`} onFocus={mostrar} onBlur={ocultar} aria-describedby={abierta ? `ficha-${sowId}` : undefined}
        style={{ fontWeight: 600, color: "var(--accent-text, var(--accent))", textDecoration: "underline dotted", textUnderlineOffset: 3 }}>
        {caravana}
      </a>
      {abierta && (
        <span id={`ficha-${sowId}`} role="tooltip" onMouseEnter={mostrar} onMouseLeave={ocultar}
          style={{ position: "fixed", zIndex: 1000, ...pos, width: 280, display: "block", textAlign: "left", fontWeight: 400,
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-lg)", boxShadow: "0 8px 24px rgba(0,0,0,.14)", padding: 12, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {datos === undefined ? <span style={{ display: "flex", justifyContent: "center", padding: 8 }}><IconLoader2 size={16} className="animate-spin" aria-label="Cargando" /></span>
            : !s ? <span>No se pudo cargar la ficha.</span>
            : <>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <strong style={{ fontSize: 15, color: "var(--text-primary)" }}>Cerda {s.identCode}</strong>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 99,
                  background: !s.isActive ? "var(--danger-subtle)" : s.plantelState === "LACTATING" ? "var(--info-subtle)" : s.plantelState === "PREGNANT" ? "var(--success-subtle)" : s.plantelState === "EMPTY" ? "var(--warning-subtle)" : "var(--bg-subtle)",
                  color: !s.isActive ? "var(--danger-text)" : "var(--text-primary)" }}>{ESTADO[s.plantelState ?? ""] ?? "—"}</span>
              </span>
              <span style={{ display: "block", color: "var(--text-muted)" }}>{[s.breed, s.tattooCode ? `arete ${s.tattooCode}` : null, `${s.currentParityCount} parto${s.currentParityCount === 1 ? "" : "s"}`, s.birthDate ? `${Math.floor(dias(s.birthDate) / 30)} meses` : null].filter(Boolean).join(" · ")}</span>
              {datos.baja && <span style={{ display: "block", marginTop: 6, color: "var(--danger-text)", fontWeight: 600 }}>{datos.baja.tipoDescarte === "Muerte" ? "Murió" : "Descartada"} el {f(datos.baja.discardDate)}{datos.baja.motivoPrincipal ? ` · ${datos.baja.motivoPrincipal}` : ""}</span>}
              {datos.servicio && (
                <span style={{ display: "block", marginTop: 6 }}>
                  Último servicio: <strong style={{ color: "var(--text-primary)" }}>{datos.servicio.codigo ?? ""}</strong> el {f(datos.servicio.serviceDate)} ({dias(datos.servicio.serviceDate)} días)
                  {datos.servicio.pregnancyChecks[0] ? ` · diagnóstico ${datos.servicio.pregnancyChecks[0].result === "PREGNANT" ? "positivo" : "negativo"} el ${f(datos.servicio.pregnancyChecks[0].checkDate)}` : " · sin diagnóstico"}
                </span>
              )}
              {datos.parto && (
                <span style={{ display: "block" }}>
                  Último parto: <strong style={{ color: "var(--text-primary)" }}>{datos.parto.codigo ?? ""}</strong> el {f(datos.parto.startDatetime)} · {datos.parto.bornAlive} vivos{datos.parto.bornDead ? `, ${datos.parto.bornDead} muertos` : ""}
                  {datos.parto.weaning ? ` · destetó ${datos.parto.weaning.pigletsWeaned} el ${f(datos.parto.weaning.weaningDate)}` : ""}
                </span>
              )}
              <span style={{ display: "block" }}>Destetados en total: {datos.destetadosTotal} · ingreso {f(s.entryDate)}</span>
              {s.plantelNotes && <span style={{ display: "block", marginTop: 4, color: "var(--text-muted)", fontSize: 11.5 }}>{s.plantelNotes}</span>}
              <span style={{ display: "block", marginTop: 8, fontWeight: 600, color: "var(--accent-text, var(--accent))" }}>Clic para abrir la ficha completa →</span>
            </>}
        </span>
      )}
    </span>
  );
}
