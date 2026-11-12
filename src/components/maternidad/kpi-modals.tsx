"use client";
import { useState, useEffect, useMemo } from "react";
import {
  IconX, IconLoader2, IconSearch, IconHeartPlus,
  IconFilter, IconSortAscending, IconSortDescending,
} from "@tabler/icons-react";

/* ─── Types ──────────────────────────────────────────────────────── */

interface HembraDetail {
  farrowingId:      string;
  sowId:            string;
  caravana:         string;
  ubicacion:        string;
  fechaIngreso:     string;
  diasEnMaternidad: number;
  fechaDestesteEst: string;
  estado:           string;
  lechonesVivos:    number;
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
  title, icon: Icon, iconColor, count, onClose, children,
}: {
  title: string; icon: React.ElementType;
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
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", padding: 4, borderRadius: "var(--radius-md)" }}>
            <IconX size={14} />
          </button>
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

function estadoColor(estado: string) {
  switch (estado) {
    case "Recién parida":      return "var(--info-text)";
    case "Lactando":           return "var(--success-text)";
    case "Pre-destete":        return "var(--warning-text)";
    case "Destete pendiente":  return "var(--danger-text)";
    default:                   return "var(--text-muted)";
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MODAL — Hembras en Maternidad
═══════════════════════════════════════════════════════════════════ */

export function HembrasMaternidadModal({ onClose }: { onClose: () => void }) {
  const [data,       setData]       = useState<HembraDetail[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [estadoFilt, setEstadoFilt] = useState("");
  const [sortKey,    setSortKey]    = useState<"dias" | "destete">("dias");
  const [sortAsc,    setSortAsc]    = useState(false);

  useEffect(() => {
    fetch("/api/maternidad/hembras-detail")
      .then(r => r.ok ? r.json() : [])
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const estados = useMemo(() =>
    Array.from(new Set(data.map(d => d.estado).filter(Boolean))).map(e => ({ value: e, label: e })),
    [data],
  );

  const filtered = useMemo(() => {
    let r = data;
    if (search)     r = r.filter(d => d.caravana.toLowerCase().includes(search.toLowerCase()));
    if (estadoFilt) r = r.filter(d => d.estado === estadoFilt);
    r = [...r].sort((a, b) => {
      const cmp = sortKey === "dias"
        ? a.diasEnMaternidad - b.diasEnMaternidad
        : a.fechaDestesteEst.localeCompare(b.fechaDestesteEst);
      return sortAsc ? cmp : -cmp;
    });
    return r;
  }, [data, search, estadoFilt, sortKey, sortAsc]);

  function toggleSort(key: "dias" | "destete") {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(false); }
  }

  return (
    <ModalShell title="Hembras en maternidad" icon={IconHeartPlus} iconColor="var(--accent)" count={filtered.length} onClose={onClose}>
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por caravana…">
        {estados.length > 0 && (
          <FilterSelect value={estadoFilt} onChange={setEstadoFilt} options={estados} placeholder="Todos los estados" />
        )}
        <SortButton label="Días en maternidad" active={sortKey === "dias"}    asc={sortAsc} onClick={() => toggleSort("dias")} />
        <SortButton label="Fecha destete"      active={sortKey === "destete"} asc={sortAsc} onClick={() => toggleSort("destete")} />
      </SearchBar>

      {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState msg="Sin hembras en maternidad" /> : (
        <div style={{ overflowX: "auto" }}>
          <table className="kp-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Caravana</th>
                <th>Ubicación</th>
                <th>Fecha de ingreso</th>
                <th>Días en maternidad</th>
                <th>Fecha prevista de destete</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.farrowingId}>
                  <td style={{ fontWeight: 600 }}><a href={`/plantel?cerda=${row.sowId}`} title="Ver la ficha de la cerda" style={{ color: "var(--accent-text, var(--accent))" }}>{row.caravana}</a></td>
                  <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.ubicacion}</td>
                  <td>{fmtDate(row.fechaIngreso)}</td>
                  <td style={{ fontWeight: 500 }}>{row.diasEnMaternidad}d</td>
                  <td>{fmtDate(row.fechaDestesteEst)}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 500, color: estadoColor(row.estado) }}>
                      {row.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}
