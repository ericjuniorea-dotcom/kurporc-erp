"use client";
import { useState, useEffect, useMemo } from "react";
import {
  IconX, IconLoader2, IconSearch, IconHeartbeat, IconHeart,
  IconUser, IconFilter, IconSortAscending, IconSortDescending,
  IconAlertTriangle, IconCircleCheck, IconCalendarTime,
} from "@tabler/icons-react";
import { ModalAccionDisponible, type DisponibleSow } from "./modal-accion-disponible";

/* ─── Types ──────────────────────────────────────────────────────── */

interface PrenadaDetail {
  sowId: string; caravana: string; ubicacion: string;
  galpon: string; corral: string;
  diasGestacion: number; fechaPartoProyectada: string;
}

interface ServidaDetail {
  sowId: string; caravana: string; ubicacion: string;
  serviceDate: string; diasDesdeServicio: number;
  fechaConfirmacionCelo: string; fechaEcografia: string;
  diagnostico: string | null;
}

interface DisponibleDetail {
  sowId: string; caravana: string; ubicacion: string;
  galpon: string; estadoReproductivo: string;
  diasDesdeDestete: number | null; ultimaFechaDestete: string | null;
  fechaRecomendadaInseminacion: string | null;
  esPostDestete: boolean;
  currentParityCount: number;
  entryWeightKg: number | null;
  currentWeightKg: number | null;
}

/* ─── Shared helpers ─────────────────────────────────────────────── */

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PY", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "40px 0", color: "var(--text-muted)", fontSize: 12 }}>
      <IconLoader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
      Cargando…
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 12 }}>
      {msg}
    </div>
  );
}

/* ─── Modal shell ────────────────────────────────────────────────── */

function ModalShell({
  title, subtitle, icon: Icon, iconColor, count, onClose, children,
}: {
  title: string; subtitle?: string; icon: React.ElementType;
  iconColor: string; count?: number; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: "100%", maxWidth: 820, boxShadow: "0 12px 40px rgba(0,0,0,0.3)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "0.5px solid var(--border-default)", background: "var(--bg-elevated)", borderRadius: "var(--radius-xl) var(--radius-xl) 0 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon size={16} style={{ color: iconColor }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
            {count !== undefined && (
              <span style={{ fontSize: 11, fontWeight: 500, padding: "1px 7px", borderRadius: 10, background: iconColor + "1a", color: iconColor }}>
                {count}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {subtitle && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{subtitle}</span>}
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 4, borderRadius: "var(--radius-md)" }}>
              <IconX size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px 20px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Search + Filter bar ────────────────────────────────────────── */

function SearchBar({
  value, onChange, placeholder, children,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; children?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
      <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
        <IconSearch size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        <input
          className="kp-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ paddingLeft: 28, fontSize: 12, height: 32 }}
        />
      </div>
      {children}
    </div>
  );
}

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder: string;
}) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
      <IconFilter size={11} style={{ color: "var(--text-muted)" }} />
      <select
        className="kp-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ height: 32, fontSize: 11, paddingLeft: 6, appearance: "auto", minWidth: 140 }}
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SortButton({ label, active, asc, onClick }: { label: string; active: boolean; asc: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 4, fontSize: 11,
        padding: "0 8px", height: 32, borderRadius: "var(--radius-md)",
        border: `0.5px solid ${active ? "var(--accent)" : "var(--border-default)"}`,
        background: active ? "var(--accent-subtle)" : "var(--bg-overlay)",
        color: active ? "var(--accent-text)" : "var(--text-muted)",
        cursor: "pointer",
      }}
    >
      {active && asc
        ? <IconSortAscending size={12} />
        : <IconSortDescending size={12} />
      }
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL 1 — Cerdas Preñadas
═══════════════════════════════════════════════════════════════════ */

export function PrenadasModal({ onClose }: { onClose: () => void }) {
  const [data,       setData]       = useState<PrenadaDetail[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [galponFilt, setGalponFilt] = useState("");
  const [sortKey,    setSortKey]    = useState<"dias" | "fecha">("dias");
  const [sortAsc,    setSortAsc]    = useState(false);

  useEffect(() => {
    fetch("/api/gestacion/prenadas-detail")
      .then(r => r.ok ? r.json() : [])
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const galpones = useMemo(() =>
    Array.from(new Set(data.map(d => d.galpon).filter(Boolean))).map(g => ({ value: g, label: g })),
    [data],
  );

  const filtered = useMemo(() => {
    let r = data;
    if (search)     r = r.filter(d => d.caravana.toLowerCase().includes(search.toLowerCase()));
    if (galponFilt) r = r.filter(d => d.galpon === galponFilt);
    r = [...r].sort((a, b) => {
      const cmp = sortKey === "dias"
        ? a.diasGestacion - b.diasGestacion
        : a.fechaPartoProyectada.localeCompare(b.fechaPartoProyectada);
      return sortAsc ? cmp : -cmp;
    });
    return r;
  }, [data, search, galponFilt, sortKey, sortAsc]);

  function toggleSort(key: "dias" | "fecha") {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(false); }
  }

  const diasAlerta = (d: number) => d >= 100 ? "var(--warning-text)" : "var(--success-text)";

  return (
    <ModalShell title="Cerdas preñadas" icon={IconHeartbeat} iconColor="var(--info)" count={filtered.length} onClose={onClose}>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por caravana…">
        {galpones.length > 0 && (
          <FilterSelect value={galponFilt} onChange={setGalponFilt} options={galpones} placeholder="Todos los galpones" />
        )}
        <SortButton label="Días gestación" active={sortKey === "dias"} asc={sortAsc} onClick={() => toggleSort("dias")} />
        <SortButton label="Fecha parto"    active={sortKey === "fecha"} asc={sortAsc} onClick={() => toggleSort("fecha")} />
      </SearchBar>

      {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState msg="Sin cerdas preñadas con diagnóstico confirmado" /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="kp-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Caravana</th>
                <th>Ubicación</th>
                <th>Días gestación</th>
                <th>Fecha prevista de parto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const isAlerta = row.diasGestacion >= 100;
                return (
                  <tr key={row.sowId}>
                    <td style={{ fontWeight: 600 }}>{row.caravana}</td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.ubicacion}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: diasAlerta(row.diasGestacion) }}>
                        {row.diasGestacion}d
                      </span>
                    </td>
                    <td>{fmtDate(row.fechaPartoProyectada)}</td>
                    <td>
                      {isAlerta ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <IconAlertTriangle size={12} style={{ color: "var(--warning)" }} />
                          <span style={{ fontSize: 11, color: "var(--warning-text)" }}>Próxima al parto</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <IconCircleCheck size={12} style={{ color: "var(--success)" }} />
                          <span style={{ fontSize: 11, color: "var(--success-text)" }}>En gestación</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL 2 — Cerdas Servidas (pendientes de confirmación)
═══════════════════════════════════════════════════════════════════ */

export function ServidasModal({ onClose }: { onClose: () => void }) {
  const [data,       setData]       = useState<ServidaDetail[]>([]);
  const [diasCelo,   setDiasCelo]   = useState(21);
  const [diasEco,    setDiasEco]    = useState(28);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [galponFilt, setGalponFilt] = useState("");

  useEffect(() => {
    fetch("/api/gestacion/servidas-detail")
      .then(r => r.ok ? r.json() : { servidas: [], diasCelo: 21, diasEcografia: 28 })
      .then(d => {
        setData(d.servidas ?? []);
        setDiasCelo(d.diasCelo   ?? 21);
        setDiasEco(d.diasEcografia ?? 28);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const galpones = useMemo(() =>
    Array.from(new Set(data.map(d => {
      const parts = d.ubicacion.split(" – ");
      return parts[0] ?? "";
    }).filter(Boolean))).map(g => ({ value: g, label: g })),
    [data],
  );

  const filtered = useMemo(() => {
    let r = data;
    if (search)     r = r.filter(d => d.caravana.toLowerCase().includes(search.toLowerCase()));
    if (galponFilt) r = r.filter(d => d.ubicacion.startsWith(galponFilt));
    return r;
  }, [data, search, galponFilt]);

  function diagLabel(v: string | null) {
    if (v === "NOT_PREGNANT") return { label: "No preñada",   color: "var(--danger-text)"  };
    if (v === "RECHECK")      return { label: "Re-control",   color: "var(--warning-text)" };
    return                           { label: "Sin diagnóstico", color: "var(--text-muted)" };
  }

  const today = new Date().toISOString().slice(0, 10);
  function dateStatus(iso: string) {
    if (iso <= today) return { color: "var(--danger-text)",  label: "Vencida" };
    const diff = Math.ceil((new Date(iso).getTime() - new Date(today).getTime()) / 86400000);
    if (diff <= 3) return { color: "var(--warning-text)", label: `En ${diff}d` };
    return              { color: "var(--success-text)",   label: `En ${diff}d` };
  }

  return (
    <ModalShell
      title="Cerdas servidas — pendientes de confirmación"
      subtitle={`Celo: día ${diasCelo} · Ecografía: día ${diasEco}`}
      icon={IconHeart}
      iconColor="var(--success)"
      count={filtered.length}
      onClose={onClose}
    >
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por caravana…">
        {galpones.length > 0 && (
          <FilterSelect value={galponFilt} onChange={setGalponFilt} options={galpones} placeholder="Todos los galpones" />
        )}
      </SearchBar>

      {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState msg="Sin cerdas servidas pendientes de confirmación" /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="kp-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Caravana</th>
                <th>Ubicación</th>
                <th>Fecha servicio</th>
                <th>Días</th>
                <th>Conf. de celo (día {diasCelo})</th>
                <th>Ecografía (día {diasEco})</th>
                <th>Diagnóstico</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const celoStatus = dateStatus(row.fechaConfirmacionCelo);
                const ecoStatus  = dateStatus(row.fechaEcografia);
                const diag       = diagLabel(row.diagnostico);
                return (
                  <tr key={row.sowId}>
                    <td style={{ fontWeight: 600 }}>{row.caravana}</td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.ubicacion}</td>
                    <td style={{ fontSize: 11 }}>{fmtDate(row.serviceDate)}</td>
                    <td style={{ fontWeight: 500 }}>{row.diasDesdeServicio}d</td>
                    <td>
                      <div style={{ fontSize: 11 }}>
                        <div>{fmtDate(row.fechaConfirmacionCelo)}</div>
                        <div style={{ color: celoStatus.color, fontSize: 10 }}>{celoStatus.label}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 11 }}>
                        <div>{fmtDate(row.fechaEcografia)}</div>
                        <div style={{ color: ecoStatus.color, fontSize: 10 }}>{ecoStatus.label}</div>
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: diag.color }}>{diag.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-muted)", borderTop: "0.5px solid var(--border-default)", paddingTop: 8 }}>
        Los plazos de confirmación y ecografía se configuran en <strong>Configuración → Gestación → Procesos</strong>.
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL 3 — Cerdas Disponibles
═══════════════════════════════════════════════════════════════════ */

export function DisponiblesModal({ onClose }: { onClose: () => void }) {
  const [data,       setData]       = useState<DisponibleDetail[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [galponFilt, setGalponFilt] = useState("");
  const [tipoFilt,   setTipoFilt]   = useState<"" | "post_destete" | "otras">("") ;
  const [selected,   setSelected]   = useState<DisponibleDetail | null>(null);

  function load() {
    fetch("/api/gestacion/disponibles-detail")
      .then(r => r.ok ? r.json() : [])
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(load, []);

  const selectedSow: DisponibleSow | null = selected ? {
    id:                 selected.sowId,
    identCode:          selected.caravana,
    caravana:           selected.caravana,
    ubicacion:          selected.ubicacion,
    currentParityCount: selected.currentParityCount,
    entryWeightKg:      selected.entryWeightKg,
    currentWeightKg:    selected.currentWeightKg,
  } : null;

  const galpones = useMemo(() =>
    Array.from(new Set(data.map(d => d.galpon).filter(Boolean))).map(g => ({ value: g, label: g })),
    [data],
  );

  const filtered = useMemo(() => {
    let r = data;
    if (search)     r = r.filter(d => d.caravana.toLowerCase().includes(search.toLowerCase()));
    if (galponFilt) r = r.filter(d => d.galpon === galponFilt);
    if (tipoFilt === "post_destete") r = r.filter(d => d.esPostDestete);
    if (tipoFilt === "otras")        r = r.filter(d => !d.esPostDestete);
    return r;
  }, [data, search, galponFilt, tipoFilt]);

  const postDesteteCount = data.filter(d => d.esPostDestete).length;

  return (
    <ModalShell title="Cerdas disponibles para inseminación" icon={IconUser} iconColor="var(--accent)" count={filtered.length} onClose={onClose}>

      {selectedSow && (
        <ModalAccionDisponible
          sow={selectedSow}
          onClose={() => setSelected(null)}
          onSuccess={load}
        />
      )}

      {postDesteteCount > 0 && (
        <div style={{
          background: "var(--warning-subtle)", border: "0.5px solid var(--warning-border)",
          borderRadius: "var(--radius-md)", padding: "8px 12px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--warning-text)",
        }}>
          <IconCalendarTime size={13} />
          <strong>{postDesteteCount} cerdas post-destete</strong> listas para servicio (marcadas en naranja).
        </div>
      )}

      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por caravana…">
        {galpones.length > 0 && (
          <FilterSelect value={galponFilt} onChange={setGalponFilt} options={galpones} placeholder="Todos los galpones" />
        )}
        <FilterSelect
          value={tipoFilt}
          onChange={v => setTipoFilt(v as typeof tipoFilt)}
          options={[
            { value: "post_destete", label: "Post-destete" },
            { value: "otras",        label: "Otras disponibles" },
          ]}
          placeholder="Todas"
        />
      </SearchBar>

      {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState msg="Sin cerdas disponibles para inseminación" /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="kp-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Caravana</th>
                <th>Ubicación</th>
                <th>Estado reproductivo</th>
                <th>Días desde destete</th>
                <th>Fecha recomendada</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => {
                const isUrgent = row.esPostDestete && (row.diasDesdeDestete ?? 0) >= 5;
                const rowColor = row.esPostDestete ? "var(--warning-subtle)" : undefined;
                return (
                  <tr
                    key={row.sowId}
                    style={{ background: rowColor }}
                  >
                    <td style={{ fontWeight: 600, color: row.esPostDestete ? "var(--warning-text)" : undefined }}>
                      {row.caravana}
                      {isUrgent && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "var(--warning)", color: "white" }}>
                          URGENTE
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.ubicacion}</td>
                    <td style={{ fontSize: 11 }}>{row.estadoReproductivo}</td>
                    <td style={{ fontSize: 11 }}>
                      {row.diasDesdeDestete != null
                        ? <span style={{ fontWeight: 500, color: row.diasDesdeDestete >= 5 ? "var(--warning-text)" : "var(--text-primary)" }}>
                            {row.diasDesdeDestete}d
                          </span>
                        : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {row.fechaRecomendadaInseminacion
                        ? <span style={{ color: row.esPostDestete ? "var(--warning-text)" : "var(--text-muted)" }}>
                            {fmtDate(row.fechaRecomendadaInseminacion)}
                          </span>
                        : "—"}
                    </td>
                    <td>
                      <button
                        onClick={() => setSelected(row)}
                        style={{
                          fontSize: 11, padding: "4px 10px", borderRadius: "var(--radius-md)",
                          background: "var(--success-subtle)", color: "var(--success-text)",
                          border: "0.5px solid var(--success-border)",
                          display: "inline-flex", alignItems: "center", gap: 4,
                          whiteSpace: "nowrap", cursor: "pointer",
                        }}
                      >
                        Registrar servicio
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}
