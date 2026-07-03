"use client";
import { useState, useEffect, useCallback } from "react";
import {
  IconX, IconLoader2, IconHeart, IconVaccine,
  IconHistory, IconShieldHalf, IconInfoCircle,
  IconUserOff, IconAlertTriangle,
} from "@tabler/icons-react";
import { EstadoBadgeSow } from "./estado-badge";
import { TabGeneral }      from "./ficha/tab-general";
import { TabReproductivo } from "./ficha/tab-reproductivo";
import { TabSanitario }    from "./ficha/tab-sanitario";
import { TabVacunas }      from "./ficha/tab-vacunas";
import { TabHistorial }    from "./ficha/tab-historial";

interface SowDetail {
  id: string;
  erpCode: string | null;
  caravanaCode: string | null;
  tattooCode: string | null;
  rfidChip: string | null;
  identCode: string;
  breed: string | null;
  geneticLine: string | null;
  birthDate: string | null;
  entryDate: string;
  entryWeightKg: string | null;
  sourceProvider: string | null;
  purchasePriceGs: string | null;
  damCodeOrigin: string | null;
  sireCodeOrigin: string | null;
  galponAssigned: string | null;
  corralAssigned: string | null;
  plantelState: string | null;
  plantelNotes: string | null;
  currentParityCount: number;
  isActive: boolean;
}

type TabKey = "general" | "reproductivo" | "sanitario" | "vacunas" | "historial";

const TABS: Array<{ key: TabKey; label: string; icon: typeof IconHeart }> = [
  { key: "general",      label: "General",      icon: IconInfoCircle   },
  { key: "reproductivo", label: "Reproductivo", icon: IconHeart        },
  { key: "sanitario",    label: "Sanitario",    icon: IconShieldHalf   },
  { key: "vacunas",      label: "Vacunas",      icon: IconVaccine      },
  { key: "historial",    label: "Historial",    icon: IconHistory      },
];

function calcAge(birthDate: string | null): string {
  if (!birthDate) return "—";
  const days = Math.floor((Date.now() - new Date(birthDate).getTime()) / 86400000);
  if (days < 60)  return `${days}d`;
  if (days < 730) return `${Math.floor(days / 30)}m`;
  return `${(days / 365).toFixed(1)}a`;
}

function Avatar({ label }: { label: string }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
      background: "var(--accent-subtle)",
      border: "1.5px solid var(--accent)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 700, color: "var(--accent)",
      letterSpacing: "-0.02em",
    }}>
      {label.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface Props {
  sowId:    string;
  canEdit:  boolean;
  onClose:  () => void;
}

export function FichaDrawer({ sowId, canEdit, onClose }: Props) {
  const [sow,     setSow]     = useState<SowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<TabKey>("general");
  const [showBaja,setShowBaja]= useState(false);
  const [bajaCause, setBajaCause] = useState("");
  const [bajaSaving, setBajaSaving] = useState(false);

  const loadSow = useCallback(() => {
    setLoading(true);
    fetch(`/api/plantel/animales/${sowId}`)
      .then(r => r.json())
      .then(setSow)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sowId]);

  useEffect(() => {
    setSow(null);
    setTab("general");
    loadSow();
  }, [sowId, loadSow]);

  async function handleBaja() {
    if (!bajaCause.trim()) return;
    setBajaSaving(true);
    try {
      const res = await fetch(`/api/plantel/hembras/${sowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register_discard", cause: bajaCause }),
      });
      if (res.ok) {
        setShowBaja(false);
        setBajaCause("");
        loadSow();
      }
    } finally {
      setBajaSaving(false);
    }
  }

  const displayName = sow
    ? sow.caravanaCode ?? sow.erpCode ?? sow.identCode
    : "…";

  const isDead = sow?.plantelState === "DEAD" || sow?.plantelState === "CULLED";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", background: "var(--bg-surface)",
      borderLeft: "0.5px solid var(--border-default)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "0.5px solid var(--border-default)",
        background: "var(--bg-surface)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Avatar */}
          <Avatar label={sow?.caravanaCode ?? sow?.identCode ?? "?"} />

          {/* Identity */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                {displayName}
              </span>
              {sow?.erpCode && (
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)" }}>
                  {sow.erpCode}
                </span>
              )}
              {sow && <EstadoBadgeSow state={sow.plantelState} />}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {sow?.geneticLine ?? sow?.breed ?? "Sin línea genética"} · {calcAge(sow?.birthDate ?? null)}
              {sow?.currentParityCount !== undefined && ` · Parto ${sow.currentParityCount}`}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            {canEdit && sow && !isDead && (
              <button
                className="btn"
                style={{ fontSize: 10, height: 28, color: "var(--warning-text)" }}
                title="Dar de baja"
                onClick={() => setShowBaja(true)}
              >
                <IconUserOff size={12} />
              </button>
            )}
            <button
              className="btn"
              style={{ width: 28, height: 28, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              onClick={onClose}
              title="Cerrar ficha"
            >
              <IconX size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{
        display: "flex", gap: 0, overflowX: "auto",
        borderBottom: "0.5px solid var(--border-default)",
        flexShrink: 0,
        scrollbarWidth: "none",
      }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "8px 12px", fontSize: 11, fontWeight: 500,
              border: "none", background: "none", cursor: "pointer", whiteSpace: "nowrap",
              color: tab === key ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: tab === key ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "color 0.12s",
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 8 }}>
            <IconLoader2 size={20} style={{ animation: "spin 1s linear infinite", color: "var(--text-muted)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Cargando ficha…</span>
          </div>
        ) : sow ? (
          <>
            {tab === "general"      && <TabGeneral sow={sow} canEdit={canEdit} onUpdated={loadSow} />}
            {tab === "reproductivo" && <TabReproductivo sowId={sow.id} />}
            {tab === "sanitario"    && <TabSanitario    sowId={sow.id} />}
            {tab === "vacunas"      && <TabVacunas      sowId={sow.id} />}
            {tab === "historial"    && <TabHistorial     sowId={sow.id} />}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 12 }}>
            No se pudo cargar la ficha
          </div>
        )}
      </div>

      {/* Baja modal */}
      {showBaja && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowBaja(false)}
        >
          <div
            style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border-default)", borderRadius: "var(--radius-xl)", width: 380 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "16px 20px", borderBottom: "0.5px solid var(--border-default)", display: "flex", alignItems: "center", gap: 8 }}>
              <IconAlertTriangle size={15} style={{ color: "var(--warning)" }} />
              <h2 style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                Dar de baja — {displayName}
              </h2>
            </div>
            <div style={{ padding: 20 }}>
              <label className="kp-label">Causa de baja *</label>
              <textarea
                className="kp-input"
                rows={3}
                value={bajaCause}
                onChange={e => setBajaCause(e.target.value)}
                placeholder="Describir la causa del descarte…"
                style={{ height: "auto", paddingTop: 8, resize: "vertical" }}
              />
            </div>
            <div style={{ padding: "12px 20px", borderTop: "0.5px solid var(--border-default)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowBaja(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleBaja} disabled={bajaSaving || !bajaCause.trim()}>
                {bajaSaving ? <><IconLoader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Confirmar baja"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
