"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { DisponiblesParaServicio } from "@/components/gestacion/disponibles-list";
import { LotesView }            from "@/components/gestacion/lotes-view";
import { CentralAnalisis }      from "@/components/gestacion/analisis";
import { ConfirmacionPrenez }   from "@/components/gestacion/confirmacion-prenez";
import { TareasModuloPanel }    from "@/components/shared/tareas-modulo-panel";
import { Topbar }               from "@/components/layout/topbar";
import {
  PrenadasModal, ServidasModal, DisponiblesModal,
} from "@/components/gestacion/kpi-modals";
import { FormAborto } from "@/components/gestacion/form-aborto";
import {
  IconHeart, IconHeartbeat, IconUser, IconLayoutGrid,
  IconAlertTriangle, IconAlertCircle, IconLoader2,
} from "@tabler/icons-react";

const ALLOWED      = [1, 2, 3, 4, 5, 11];
const CAN_REGISTER = [1, 2, 3, 4, 5, 11, 13];

type IngresoSubTab = "servicios" | "diagnostico" | "aborto";

interface GestKpis {
  preñadas:        number;
  servidas:        number;
  disponibles:     number;
  lactantes:       number;
  alertasServicio: number;
  porServir:       { id: string; identCode: string; diasDesdeDestete: number; urgente: boolean }[];
}

interface Inconsistencia {
  sowId:                string;
  caravana:             string;
  ubicacion:            string;
  diasGestacion:        number;
  fechaPartoProyectada: string;
  problema:             string;
}

interface Distribucion { rango: string; cantidad: number; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type ModalType = "prenadas" | "servidas" | "disponibles" | null;

function VisionGeneralGestacion({ onOpenLotes }: { onOpenLotes: () => void }) {
  const [kpis,            setKpis]            = useState<GestKpis | null>(null);
  const [inconsistencias, setInconsistencias] = useState<Inconsistencia[]>([]);
  const [distribucion,    setDistribucion]    = useState<Distribucion[]>([]);
  const [loadingKpis,     setLoadingKpis]     = useState(true);
  const [loadingVision,   setLoadingVision]   = useState(true);
  const [panelTab,        setPanelTab]        = useState<"inconsistencias" | "tareas">("inconsistencias");
  const [modal,           setModal]           = useState<ModalType>(null);

  useEffect(() => {
    fetch("/api/gestacion/kpis")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setKpis(d); })
      .catch(() => {})
      .finally(() => setLoadingKpis(false));

    fetch("/api/gestacion/vision-general")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setInconsistencias(d.inconsistencias ?? []);
          setDistribucion(d.distribucion ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingVision(false));
  }, []);

  // disponibles ya incluye todas las cerdas que no son preñadas, servidas ni lactantes
  const disponiblesTotal = kpis?.disponibles ?? 0;
  const hasUrgentes      = (kpis?.alertasServicio ?? 0) > 0;

  const kpiCards = [
    {
      key:    "prenadas" as ModalType,
      label:  "Preñadas",
      value:  kpis?.preñadas ?? 0,
      icon:   IconHeartbeat,
      color:  "var(--info)",
      subtle: "var(--info-subtle)",
    },
    {
      key:    "servidas" as ModalType,
      label:  "Servidas",
      sub:    "pendientes de confirmación",
      value:  kpis?.servidas ?? 0,
      icon:   IconHeart,
      color:  "var(--success)",
      subtle: "var(--success-subtle)",
    },
    {
      key:    "disponibles" as ModalType,
      label:  "Disponibles",
      sub:    hasUrgentes ? `${kpis!.alertasServicio} urgentes (≥5d post-destete)` : "listas para inseminación",
      value:  disponiblesTotal,
      icon:   IconUser,
      color:  hasUrgentes ? "var(--warning)" : "var(--text-secondary)",
      subtle: hasUrgentes ? "var(--warning-subtle)" : "var(--bg-surface)",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Modales ───────────────────────────────────────────────── */}
      {modal === "prenadas"    && <PrenadasModal    onClose={() => setModal(null)} />}
      {modal === "servidas"    && <ServidasModal    onClose={() => setModal(null)} />}
      {modal === "disponibles" && <DisponiblesModal onClose={() => setModal(null)} />}

      {/* ── KPI cards (clickables) + acceso a Lotes ───────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {kpiCards.map(c => (
          <button
            key={c.label}
            onClick={() => setModal(c.key)}
            style={{
              background: c.subtle, border: "0.5px solid var(--border-default)",
              borderRadius: "var(--radius-lg)", padding: "14px 16px",
              display: "flex", alignItems: "center", gap: 12,
              cursor: "pointer", textAlign: "left",
              transition: "filter 0.1s",
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.96)")}
            onMouseLeave={e => (e.currentTarget.style.filter = "none")}
          >
            <c.icon size={22} style={{ color: c.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: c.color, lineHeight: 1 }}>
                {loadingKpis ? "—" : c.value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)", marginTop: 3 }}>
                {c.label}
              </div>
              {c.sub && (
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{c.sub}</div>
              )}
            </div>
          </button>
        ))}

        <button
          onClick={onOpenLotes}
          style={{
            background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
            borderRadius: "var(--radius-lg)", padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 12,
            cursor: "pointer", textAlign: "left",
            transition: "filter 0.1s",
          }}
          onMouseEnter={e => (e.currentTarget.style.filter = "brightness(0.96)")}
          onMouseLeave={e => (e.currentTarget.style.filter = "none")}
        >
          <IconLayoutGrid size={22} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              Lotes
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
              Ver seguimiento por lote
            </div>
          </div>
        </button>
      </div>

      {/* ── Distribución de gestantes (CENTRAL) ───────────────────── */}
      <div style={{
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", padding: "18px 20px",
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: "var(--text-secondary)",
          textTransform: "uppercase", letterSpacing: "0.1em",
          textAlign: "center", marginBottom: 18,
        }}>
          Distribución de gestantes por día de gestación
        </div>

        {loadingVision ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "40px 0", color: "var(--text-muted)", fontSize: 12 }}>
            <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            Cargando…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={distribucion} margin={{ top: 4, right: 12, left: -10, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis
                dataKey="rango"
                tick={{ fontSize: 12, fill: "var(--text-muted)" }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                axisLine={false} tickLine={false} width={28}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-elevated)",
                  border: "0.5px solid var(--border-default)",
                  borderRadius: 8, fontSize: 11,
                }}
                labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                itemStyle={{ color: "var(--text-secondary)" }}
                formatter={(v: number) => [v, "Cerdas"]}
                cursor={{ fill: "var(--bg-overlay)" }}
              />
              <Bar dataKey="cantidad" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={100} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
          Día de gestación
        </div>
      </div>

      {/* ── Panel inferior: Inconsistencias | Tareas ──────────────── */}
      <div style={{
        background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
      }}>
        <div style={{ display: "flex", borderBottom: "0.5px solid var(--border-default)", background: "var(--bg-elevated)" }}>
          {(["inconsistencias", "tareas"] as const).map(key => {
            const label = key === "inconsistencias"
              ? `Inconsistencias${inconsistencias.length ? ` (${inconsistencias.length})` : ""}`
              : "Listado de tareas";
            const activeColor = key === "inconsistencias" ? "var(--danger)" : "var(--accent)";
            const activeText  = key === "inconsistencias" ? "var(--danger-text)" : "var(--text-primary)";
            return (
              <button
                key={key}
                onClick={() => setPanelTab(key)}
                style={{
                  padding: "10px 18px", fontSize: 12, fontWeight: 500,
                  background: "none", border: "none", cursor: "pointer",
                  color:        panelTab === key ? activeText  : "var(--text-muted)",
                  borderBottom: panelTab === key ? `2px solid ${activeColor}` : "2px solid transparent",
                  transition: "color 0.12s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: 16 }}>
          {panelTab === "inconsistencias" && (
            loadingVision ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "24px 0", color: "var(--text-muted)", fontSize: 12 }}>
                <IconLoader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                Cargando…
              </div>
            ) : inconsistencias.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--success-text)", fontSize: 12 }}>
                Sin inconsistencias en datos de gestación ✓
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10 }}>
                  Inconsistencias en los datos de Gestación
                </div>
                <table className="kp-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Caravana</th>
                      <th>Ubicación</th>
                      <th>Días gestación</th>
                      <th>Previsión de parto</th>
                      <th>Problema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inconsistencias.map(inc => {
                      const isDanger = inc.diasGestacion >= 120;
                      const color    = isDanger ? "var(--danger-text)" : "var(--warning-text)";
                      return (
                        <tr key={inc.sowId}>
                          <td style={{ fontWeight: 500 }}>{inc.caravana}</td>
                          <td>{inc.ubicacion}</td>
                          <td style={{ fontWeight: 600, color }}>{inc.diasGestacion}d</td>
                          <td>{fmtDate(inc.fechaPartoProyectada)}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              {isDanger
                                ? <IconAlertTriangle size={12} style={{ color: "var(--danger)",  flexShrink: 0 }} />
                                : <IconAlertCircle   size={12} style={{ color: "var(--warning)", flexShrink: 0 }} />}
                              <span style={{ fontSize: 11, color }}>{inc.problema}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )
          )}

          {panelTab === "tareas" && (
            <TareasModuloPanel sector="gestacion" accentColor="var(--success)" />
          )}
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const INGRESO_SUBTABS: { key: IngresoSubTab; label: string }[] = [
  { key: "servicios",   label: "Registrar servicio"    },
  { key: "diagnostico", label: "Diagnóstico de preñez" },
  { key: "aborto",      label: "Aborto"                },
];

export default function GestacionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab,        setTab]        = useState("vision");
  const [ingresoTab, setIngresoTab] = useState<IngresoSubTab>("servicios");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !session.user.roles.some(r => ALLOWED.includes(r))) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading" || !session) return null;
  const canRegister = session.user.roles.some(r => CAN_REGISTER.includes(r));

  return (
    <>
      <Topbar
        title="Gestación"
        icon={IconHeart}
        iconColor="var(--success)"
        tabs={[
          { key: "vision",   label: "Visión general"      },
          { key: "analisis", label: "Central de análisis" },
        ]}
        activeTab={tab === "ingreso" ? "" : tab}
        onTabChange={setTab}
        actions={
          canRegister ? (
            <button
              className="btn btn-primary"
              onClick={() => setTab(tab === "ingreso" ? "vision" : "ingreso")}
            >
              Ingreso de datos
            </button>
          ) : undefined
        }
        configHref="/configuracion?modulo=GESTACION&tab=Metas"
      />

      <div style={{ padding: "16px 20px" }}>
        {tab === "vision" && <VisionGeneralGestacion onOpenLotes={() => setTab("lotes")} />}
        {tab === "lotes"  && <LotesView onBack={() => setTab("vision")} />}

        {tab === "ingreso" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--border-default)", alignItems: "center" }}>
              {INGRESO_SUBTABS.map(st => (
                <button
                  key={st.key}
                  onClick={() => setIngresoTab(st.key)}
                  style={{
                    padding: "7px 16px", fontSize: 12, background: "none", border: "none",
                    cursor: "pointer", whiteSpace: "nowrap",
                    fontWeight: ingresoTab === st.key ? 600 : 400,
                    color:      ingresoTab === st.key ? "var(--success)"      : "var(--text-muted)",
                    borderBottom: ingresoTab === st.key ? "2px solid var(--success)" : "2px solid transparent",
                  }}
                >
                  {st.label}
                </button>
              ))}
              <div style={{ flex: 1 }} />
            </div>

            {ingresoTab === "servicios" && (
              <DisponiblesParaServicio />
            )}
            {ingresoTab === "diagnostico" && (
              <ConfirmacionPrenez />
            )}
            {ingresoTab === "aborto" && (
              <FormAborto />
            )}
          </div>
        )}

        {tab === "analisis" && <CentralAnalisis tenantId={session.user.tenantId} />}
      </div>
    </>
  );
}
