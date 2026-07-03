"use client";
export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  IconUsers, IconUser, IconHeart, IconHeartbeat,
  IconDroplet, IconMars, IconFlask,
  IconLoader2, IconSettings, IconArchive,
} from "@tabler/icons-react";
import Link from "next/link";
import { HembrasTab }     from "@/components/plantel/hembras-tab";
import { VerracosTab }    from "@/components/plantel/verracos-tab";
import { SemenTab }       from "@/components/plantel/semen-tab";
import { FichaDrawer }    from "@/components/plantel/ficha-drawer";
import { DescartadosTab } from "@/components/plantel/descartados-tab";

const TABS = ["Hembras", "Reproductores", "Semen Externo", "Descartados"] as const;
type Tab = typeof TABS[number];

interface Stats {
  total:       number;
  activeSows:  number;
  disponibles: number;
  servidas:    number;
  preñadas:    number;
  lactantes:   number;
  activeBoars: number;
  semenDoses:  number;
}

export default function PlantelPage() {
  const { data: session, status } = useSession();
  const [tab, setTab]               = useState<Tab>("Hembras");
  const [stats, setStats]           = useState<Stats | null>(null);
  const [selectedSowId, setSelectedSowId] = useState<string | null>(null);

  const canEdit = session?.user.roles.some((r) => [1, 2].includes(r)) ?? false;

  useEffect(() => {
    fetch("/api/plantel/stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setStats(d));
  }, [tab]);

  useEffect(() => {
    if (tab !== "Hembras") setSelectedSowId(null);
  }, [tab]);

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "var(--text-muted)" }}>
        <IconLoader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Stock general = disponibles + servidas + preñadas + lactantes + reproductores
  const STAT_CARDS = [
    {
      label: "Stock general",
      sub:   "disponibles + servidas + preñadas + lactantes + reproductores",
      value: stats?.total,
      icon:  IconUsers,
      color: "var(--text-primary)",
    },
    {
      label: "Disponibles",
      sub:   "listas para inseminación",
      value: stats?.disponibles,
      icon:  IconUser,
      color: "var(--text-secondary)",
    },
    {
      label: "Servidas",
      sub:   "pendientes de diagnóstico",
      value: stats?.servidas,
      icon:  IconHeart,
      color: "var(--success-text)",
    },
    {
      label: "Preñadas",
      sub:   "gestación confirmada",
      value: stats?.preñadas,
      icon:  IconHeartbeat,
      color: "var(--info-text)",
    },
    {
      label: "Lactantes",
      sub:   "paridas + lactando",
      value: stats?.lactantes,
      icon:  IconDroplet,
      color: "var(--warning-text)",
    },
    {
      label: "Reproductores",
      sub:   "activos + descanso",
      value: stats?.activeBoars,
      icon:  IconMars,
      color: "var(--accent)",
    },
  ];

  const hasFicha      = tab === "Hembras" && !!selectedSowId;
  const isDescartados = tab === "Descartados";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Top section */}
      <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
        {/* Header + Stats */}
        {!hasFicha && !isDescartados && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                  Plantel Reproductivo
                </h1>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                  Registro central de hembras, reproductores y material genético
                </p>
              </div>
              <Link
                href="/configuracion?modulo=PLANTEL&tab=Procesos"
                title="Configuración del módulo"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 30, height: 30, borderRadius: "var(--radius-md)",
                  border: "0.5px solid var(--border-default)", background: "var(--bg-overlay)",
                  color: "var(--text-muted)", textDecoration: "none", flexShrink: 0,
                }}
              >
                <IconSettings size={14} aria-hidden />
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
              {STAT_CARDS.map(({ label, sub, value, icon: Icon, color }) => (
                <div key={label} className="panel" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Icon size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden />
                    <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1.2 }}>
                      {label}
                    </span>
                  </div>
                  <span style={{ fontSize: 24, fontWeight: 500, color: stats ? color : "var(--text-muted)", lineHeight: 1 }}>
                    {stats ? (value ?? 0) : "—"}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{sub}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Tab navigation */}
        <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--border-default)" }}>
          {TABS.map(t => {
            const isDiscard = t === "Descartados";
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: 500,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: tab === t
                    ? (isDiscard ? "var(--warning-text)" : "var(--text-primary)")
                    : "var(--text-muted)",
                  borderBottom: tab === t
                    ? `2px solid ${isDiscard ? "var(--warning)" : "var(--accent)"}`
                    : "2px solid transparent",
                  transition: "color 0.12s",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {isDiscard && <IconArchive size={12} aria-hidden />}
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content — split when ficha open */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        <div style={{
          flex: hasFicha ? "0 0 460px" : "1 1 auto",
          overflowY: "auto",
          padding: "16px 24px",
        }}>
          {tab === "Hembras" && (
            <HembrasTab
              selectedSowId={selectedSowId}
              onSelectSow={setSelectedSowId}
            />
          )}
          {tab === "Reproductores" && <VerracosTab />}
          {tab === "Semen Externo"  && <SemenTab />}
          {tab === "Descartados"    && <DescartadosTab />}
        </div>

        {hasFicha && selectedSowId && (
          <div style={{ flex: "1 1 0", overflow: "hidden", minWidth: 380 }}>
            <FichaDrawer
              sowId={selectedSowId}
              canEdit={canEdit}
              onClose={() => setSelectedSowId(null)}
            />
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
