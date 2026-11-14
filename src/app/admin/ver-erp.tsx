"use client";
// Fase 15.4 · Botón «Ver ERP» partido: el clic principal abre en solo lectura con el motivo vigente o
// «Mejora del producto»; la flecha permite elegir el motivo real (Soporte, Seguridad, Estadística u Otro).
import { useEffect, useRef, useState, useTransition } from "react";
import { IconChevronDown, IconEye, IconLoader2 } from "@tabler/icons-react";
import { abrirERPEnLectura } from "@/app/acciones/admin";

const OPCIONES = [
  { motivo: "SOPORTE", label: "Soporte" },
  { motivo: "SEGURIDAD", label: "Seguridad" },
  { motivo: "ESTADISTICA", label: "Estadística" },
  { motivo: "OTRO", label: "Otro…" },
] as const;

export function VerERP({ organizacionId, nombre, chico = false, opciones }: { organizacionId?: string; nombre?: string; chico?: boolean; opciones?: { id: string; nombre: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  const [org, setOrg] = useState(organizacionId ?? opciones?.[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const caja = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!caja.current?.contains(e.target as Node)) setAbierto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", esc); };
  }, [abierto]);
  if (!org) return null;

  const abrir = (motivo?: string) => {
    let detalle: string | undefined;
    if (motivo === "OTRO") {
      const d = window.prompt("Detallá el motivo (queda registrado y la organización lo ve):");
      if (!d || d.trim().length < 5) return;
      detalle = d.trim();
    }
    setError(null); setAbierto(false);
    iniciar(async () => {
      const r = await abrirERPEnLectura(org, motivo, detalle);
      if (r.ok) window.location.assign("/dashboard"); else setError(r.error);
    });
  };
  const alto = chico ? 26 : 30;
  return (
    <span ref={caja} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
      {opciones && opciones.length > 1 && (
        <select aria-label="Organización" className="kp-input" value={org} onChange={e => setOrg(e.target.value)} style={{ height: alto, fontSize: 12, width: "auto", maxWidth: 160 }}>
          {opciones.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
        </select>
      )}
      <span style={{ display: "inline-flex" }}>
        <button type="button" className="btn" disabled={pendiente} onClick={() => abrir()} title={`Abrir el ERP${nombre ? ` de ${nombre}` : ""} en solo lectura (motivo: Mejora del producto)`}
          style={{ height: alto, fontSize: 12, gap: 4, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
          {pendiente ? <IconLoader2 size={13} className="animate-spin" aria-hidden /> : <IconEye size={13} aria-hidden />} Ver ERP
        </button>
        <button type="button" className="btn" disabled={pendiente} aria-label="Elegir el motivo" aria-haspopup="menu" aria-expanded={abierto} onClick={() => setAbierto(v => !v)}
          style={{ height: alto, padding: "0 6px", borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "none" }}>
          <IconChevronDown size={13} aria-hidden />
        </button>
      </span>
      {abierto && (
        <span role="menu" style={{ position: "absolute", top: alto + 4, right: 0, zIndex: 20, minWidth: 170, background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: 4, display: "flex", flexDirection: "column", boxShadow: "0 6px 18px rgba(0,0,0,.12)" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 8px" }}>Abrir con motivo</span>
          {OPCIONES.map(o => (
            <button key={o.motivo} type="button" role="menuitem" onClick={() => abrir(o.motivo)}
              style={{ textAlign: "left", fontSize: 12.5, padding: "6px 8px", background: "none", border: "none", borderRadius: 6, cursor: "pointer", color: "var(--text-primary)" }}>
              {o.label}
            </button>
          ))}
        </span>
      )}
      {error && <span role="alert" style={{ fontSize: 12, color: "var(--danger-text)" }}>{error}</span>}
    </span>
  );
}
