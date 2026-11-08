"use client";
export const dynamic = "force-dynamic";
import React, { useState, useEffect, useCallback } from "react";
import { useSession, usePermisos } from "@/lib/auth/sesion-cliente";
import {
  IconUsers, IconUser, IconHeart, IconHeartbeat,
  IconBabyCarriage, IconMars, IconShieldCheck,
  IconLoader2, IconSettings, IconArchive, IconX,
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
  total:               number;
  activeSows:          number;
  hembrasEnMaternidad: number;
  preñadas:            number;
  servidas:            number;
  disponibles:         number;
  activeBoars:         number;
  cuarentena:          number;
  semenDoses:          number;
}

interface HembraMaternidad {
  farrowingId:       string;
  sowId:             string;
  caravana:          string;
  ubicacion:         string;
  fechaIngreso:      string;
  diasEnMaternidad:  number;
  fechaDestesteEst:  string;
  estado:            string;
  lechonesVivos:     number;
}

export default function PlantelPage() {
  const { data: session, status } = useSession();
  const { alguno } = usePermisos();
  const [tab, setTab]               = useState<Tab>("Hembras");
  const [stats, setStats]           = useState<Stats | null>(null);
  const [selectedSowId, setSelectedSowId] = useState<string | null>(null);
  const [showMatModal, setShowMatModal]   = useState(false);
  const [matData, setMatData]             = useState<HembraMaternidad[] | null>(null);
  const [matLoading, setMatLoading]       = useState(false);

  const openMatModal = useCallback(async () => {
    setShowMatModal(true);
    if (matData) return;
    setMatLoading(true);
    const res  = await fetch("/api/maternidad/hembras-detail");
    const data = res.ok ? await res.json() : [];
    setMatData(data);
    setMatLoading(false);
  }, [matData]);

  const canEdit = alguno(["plantel.animales.editar"]);

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

  // Orden: Stock General | Hembras en Maternidad | Preñadas | Servidas | Disponibles | Reproductores | Cuarentena
  const STAT_CARDS: { label: string; sub: string; value: number | undefined; icon: React.ElementType; color: string; onClick?: () => void }[] = [
    {
      label: "Stock General",
      sub:   "maternidad + preñadas + servidas + disponibles + reproductores + cuarentena",
      value: stats?.total,
      icon:  IconUsers,
      color: "var(--text-primary)",
    },
    {
      label:   "Hembras en Maternidad",
      sub:     "partos activos sin destete",
      value:   stats?.hembrasEnMaternidad,
      icon:    IconBabyCarriage,
      color:   "var(--warning-text)",
      onClick: openMatModal,
    },
    {
      label: "Preñadas",
      sub:   "gestación confirmada",
      value: stats?.preñadas,
      icon:  IconHeartbeat,
      color: "var(--info-text)",
    },
    {
      label: "Servidas",
      sub:   "pendientes de diagnóstico",
      value: stats?.servidas,
      icon:  IconHeart,
      color: "var(--success-text)",
    },
    {
      label: "Disponibles",
      sub:   "listas para inseminación",
      value: stats?.disponibles,
      icon:  IconUser,
      color: "var(--text-secondary)",
    },
    {
      label: "Reproductores",
      sub:   "activos + descanso",
      value: stats?.activeBoars,
      icon:  IconMars,
      color: "var(--accent)",
    },
    {
      label: "Cuarentena",
      sub:   "hembras en cuarentena",
      value: stats?.cuarentena,
      icon:  IconShieldCheck,
      color: "var(--warning-text)",
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, marginBottom: 20 }}>
              {STAT_CARDS.map(({ label, sub, value, icon: Icon, color, onClick }) => (
                <div
                  key={label}
                  className="panel"
                  onClick={onClick}
                  style={{
                    display: "flex", flexDirection: "column", gap: 4, padding: "12px 14px",
                    cursor: onClick ? "pointer" : "default",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)"; }}
                  onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLElement).style.background = ""; }}
                >
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

      {/* Modal — Hembras en Maternidad */}
      {showMatModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.45)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShowMatModal(false)}
        >
          <div
            style={{
              background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
              border: "0.5px solid var(--border-default)", width: "min(820px, 95vw)",
              maxHeight: "80vh", display: "flex", flexDirection: "column",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: "0.5px solid var(--border-default)", flexShrink: 0,
            }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                  Hembras en Maternidad
                </h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}>
                  Partos activos sin destete registrado
                </p>
              </div>
              <button
                onClick={() => setShowMatModal(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-muted)", padding: 4, display: "flex",
                }}
              >
                <IconX size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: "auto", flex: 1 }}>
              {matLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: "var(--text-muted)" }}>
                  <IconLoader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ marginLeft: 8, fontSize: 13 }}>Cargando...</span>
                </div>
              ) : !matData || matData.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: "var(--text-muted)", fontSize: 13 }}>
                  No hay hembras en maternidad
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "0.5px solid var(--border-default)" }}>
                      {["Caravana", "Ubicación", "Fecha ingreso", "Días en mat.", "Destete estimado", "Estado"].map(h => (
                        <th key={h} style={{
                          padding: "10px 16px", textAlign: "left", fontSize: 11,
                          color: "var(--text-muted)", fontWeight: 500,
                          textTransform: "uppercase", letterSpacing: "0.05em",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matData.map((h, i) => (
                      <tr key={h.farrowingId} style={{
                        borderBottom: i < matData.length - 1 ? "0.5px solid var(--border-subtle)" : "none",
                      }}>
                        <td style={{ padding: "10px 16px", fontWeight: 500, color: "var(--text-primary)" }}>{h.caravana}</td>
                        <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{h.ubicacion}</td>
                        <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{h.fechaIngreso}</td>
                        <td style={{ padding: "10px 16px", color: "var(--text-primary)", fontWeight: 500 }}>{h.diasEnMaternidad}d</td>
                        <td style={{ padding: "10px 16px", color: "var(--text-secondary)" }}>{h.fechaDestesteEst}</td>
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{
                            fontSize: 11, padding: "2px 8px", borderRadius: "var(--radius-sm)",
                            background: h.estado === "Destete pendiente" ? "var(--warning-bg)" : "var(--success-bg)",
                            color:      h.estado === "Destete pendiente" ? "var(--warning-text)" : "var(--success-text)",
                            fontWeight: 500,
                          }}>
                            {h.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
