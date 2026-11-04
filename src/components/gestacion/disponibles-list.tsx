"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  IconSearch, IconChevronRight, IconLoader2, IconDroplet,
  IconCalendarTime, IconLayoutGrid, IconX,
} from "@tabler/icons-react";
import { ModalAccionDisponible, type DisponibleSow } from "./modal-accion-disponible";
import { ModalCrearLote } from "./modal-crear-lote";

type BadgeEstado = "ABORTO" | "REPITIO_CELO" | "SALE_MATERNIDAD" | "PRIMERIZA" | null;

interface DisponibleDetail {
  sowId:                        string;
  caravana:                     string;
  ubicacion:                    string;
  galpon:                       string;
  estadoReproductivo:           string;
  diasDesdeDestete:             number | null;
  fechaRecomendadaInseminacion: string | null;
  esPostDestete:                boolean;
  currentParityCount:           number;
  esPrimeriza:                  boolean;
  ultimoCeloFecha:              string | null;
  fechaPrioridad:               string | null;
  ultimoServicioFecha:          string | null;
  totalPartos:                  number;
  badgeEstado:                  BadgeEstado;
  entryWeightKg:                number | null;
  currentWeightKg:              number | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function prioridadInfo(row: DisponibleDetail): { label: string; color: string } {
  if (!row.fechaPrioridad) {
    return { label: "Sin celo registrado", color: "var(--text-muted)" };
  }
  const today = new Date().toISOString().slice(0, 10);
  const diff = Math.round(
    (new Date(row.fechaPrioridad).getTime() - new Date(today).getTime()) / 86400000,
  );
  if (diff <= 0) return { label: diff === 0 ? "Lista hoy" : `Vencida hace ${-diff}d`, color: "var(--danger-text)" };
  if (diff <= 3)  return { label: `En ${diff}d`, color: "var(--warning-text)" };
  return { label: `En ${diff}d`, color: "var(--success-text)" };
}

const BADGE_INFO: Record<Exclude<BadgeEstado, null>, { label: string; color: string; bg: string }> = {
  ABORTO:          { label: "ABORTO",             color: "var(--danger-text)",  bg: "var(--danger-subtle)" },
  REPITIO_CELO:    { label: "REPITIÓ CELO",       color: "var(--warning-text)", bg: "var(--warning-subtle)" },
  SALE_MATERNIDAD: { label: "SALE DE MATERNIDAD", color: "var(--warning-text)", bg: "var(--warning-subtle)" },
  PRIMERIZA:       { label: "PRIMERIZA",          color: "var(--info-text)",    bg: "var(--info-subtle)" },
};

export function DisponiblesParaServicio() {
  const [data,     setData]     = useState<DisponibleDetail[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<DisponibleDetail | null>(null);
  const [checked,  setChecked]  = useState<Set<string>>(new Set());
  const [showLoteModal, setShowLoteModal] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/gestacion/disponibles-detail")
      .then(r => r.ok ? r.json() : [])
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return data;
    return data.filter(d => d.caravana.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  const selectedSow: DisponibleSow | null = selected ? {
    id:                 selected.sowId,
    identCode:          selected.caravana,
    caravana:           selected.caravana,
    ubicacion:          selected.ubicacion,
    currentParityCount: selected.currentParityCount,
    entryWeightKg:      selected.entryWeightKg,
    currentWeightKg:    selected.currentWeightKg,
  } : null;

  function toggleChecked(sowId: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(sowId)) next.delete(sowId);
      else next.add(sowId);
      return next;
    });
  }

  function afterLote() {
    load();
    setChecked(new Set());
  }

  const loteSows: DisponibleSow[] = useMemo(() =>
    data.filter(d => checked.has(d.sowId)).map(d => ({
      id:                 d.sowId,
      identCode:          d.caravana,
      caravana:           d.caravana,
      ubicacion:          d.ubicacion,
      currentParityCount: d.totalPartos,
      entryWeightKg:      d.entryWeightKg,
      currentWeightKg:    d.currentWeightKg,
    })),
    [data, checked],
  );

  return (
    <div>
      {selectedSow && (
        <ModalAccionDisponible
          sow={selectedSow}
          onClose={() => setSelected(null)}
          onSuccess={load}
        />
      )}

      {showLoteModal && (
        <ModalCrearLote
          sows={loteSows}
          onClose={() => { setShowLoteModal(false); afterLote(); }}
          onProgress={load}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 320 }}>
          <IconSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input
            className="kp-input"
            placeholder="Buscar por caravana…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 28, fontSize: 12, height: 32 }}
          />
        </div>

        {checked.size > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginLeft: "auto",
            padding: "6px 12px", borderRadius: "var(--radius-md)",
            background: "var(--accent-subtle)", border: "0.5px solid var(--accent-border)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
              {checked.size} seleccionada{checked.size > 1 ? "s" : ""}
            </span>
            <button
              className="btn btn-primary"
              style={{ fontSize: 11, height: 26 }}
              onClick={() => setShowLoteModal(true)}
            >
              <IconLayoutGrid size={12} /> Crear lote
            </button>
            <button
              onClick={() => setChecked(new Set())}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 2 }}
              title="Limpiar selección"
            >
              <IconX size={13} />
            </button>
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
            <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            No hay hembras disponibles para servicio en este momento.
          </div>
        ) : (
          <div>
            {filtered.map((row, i) => {
              const prio = prioridadInfo(row);
              const isChecked = checked.has(row.sowId);
              return (
                <div
                  key={row.sowId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(row)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setSelected(row); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px", background: isChecked ? "var(--accent-subtle)" : "none",
                    borderTop: i > 0 ? "0.5px solid var(--border-default)" : "none",
                    cursor: "pointer", textAlign: "left",
                  }}
                  onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = "var(--bg-overlay)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isChecked ? "var(--accent-subtle)" : "none"; }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleChecked(row.sowId)}
                    style={{ width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{row.caravana}</span>
                      {row.badgeEstado && (
                        <span style={{
                          fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 3,
                          background: BADGE_INFO[row.badgeEstado].bg, color: BADGE_INFO[row.badgeEstado].color,
                        }}>
                          {BADGE_INFO[row.badgeEstado].label}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {row.ubicacion} · {row.estadoReproductivo}
                      {row.esPrimeriza && row.ultimoCeloFecha && ` · Último celo: ${fmtDate(row.ultimoCeloFecha)}`}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      Último servicio: {row.ultimoServicioFecha ? fmtDate(row.ultimoServicioFecha) : "Sin servicios previos"}
                      {" · "}{row.totalPartos} parto{row.totalPartos === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: prio.color }}>
                        {!row.fechaPrioridad && <IconDroplet size={11} />}
                        {row.fechaPrioridad && <IconCalendarTime size={11} />}
                        {prio.label}
                      </div>
                    </div>
                    <IconChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
