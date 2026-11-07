"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth/sesion-cliente";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { IconChartLine } from "@tabler/icons-react";

import { KpiStrip }      from "@/components/engorde/KpiStrip";
import { LotesGrid }     from "@/components/engorde/LotesGrid";
import { AlertasPanel }  from "@/components/engorde/AlertasPanel";
import { GdpBarChart }   from "@/components/engorde/GdpBarChart";
import type { LoteCardData } from "@/components/engorde/LoteCard";

import { TabLotes }          from "@/components/engorde/datos/TabLotes";
import { TabMuertes }        from "@/components/engorde/datos/TabMuertes";
import { TabPesajes }        from "@/components/engorde/datos/TabPesajes";
import { TabVentas }         from "@/components/engorde/datos/TabVentas";
import { TabTransferencias } from "@/components/engorde/datos/TabTransferencias";
import { TabOtrasSalidas }   from "@/components/engorde/datos/TabOtrasSalidas";
import { CentralAnalisisEngorde } from "@/components/engorde/analisis/CentralAnalisis";
import { TareasModuloPanel }      from "@/components/shared/tareas-modulo-panel";

const ALLOWED = [1, 2, 3, 4, 5];

const DATA_SUBTABS = [
  { key: "lotes",         label: "Lotes"         },
  { key: "muertes",       label: "Muertes"       },
  { key: "transferencias",label: "Transferencias"},
  { key: "ventas",        label: "Ventas"        },
  { key: "otras",         label: "Otras salidas" },
  { key: "pesajes",       label: "Pesajes"       },
] as const;

type DataSubTab = typeof DATA_SUBTABS[number]["key"];

interface KpiData {
  kpis: {
    lotesAbiertos: number; stockTotal: number;
    hospitalCount: number; descartadosCount: number;
    mortalidadPct: number; gdpPromedio: number | null;
  };
  alertas: { tipo: "danger" | "warning" | "info" | "ok"; mensaje: string }[];
  gdpPorLote: { batchCode: string; sitio: string | null; gdp: number | null; status: "ok" | "warn" | "bad" | null }[];
}

export default function EngordePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tab, setTab]         = useState("general");
  const [dataTab, setDataTab] = useState<DataSubTab>("lotes");

  const [kpiData, setKpiData]         = useState<KpiData | null>(null);
  const [lotes, setLotes]             = useState<LoteCardData[]>([]);
  const [loadingKpi, setLoadingKpi]   = useState(true);
  const [loadingLotes, setLoadingLotes] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !session.user.roles.some(r => ALLOWED.includes(r))) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  const loadKpis = useCallback(async () => {
    setLoadingKpi(true);
    const r = await fetch("/api/engorde/kpis");
    if (r.ok) setKpiData(await r.json());
    setLoadingKpi(false);
  }, []);

  const loadLotes = useCallback(async () => {
    setLoadingLotes(true);
    const r = await fetch("/api/engorde/lotes?estado=activo");
    if (r.ok) setLotes(await r.json());
    setLoadingLotes(false);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadKpis();
    loadLotes();
  }, [status, loadKpis, loadLotes]);

  if (status === "loading" || !session) return null;

  return (
    <>
      <Topbar
        title="Engorde"
        icon={IconChartLine}
        iconColor="var(--engorde-accent)"
        tabs={[
          { key: "general",  label: "Visión general"      },
          { key: "analisis", label: "Central de análisis" },
        ]}
        activeTab={tab === "datos" ? "" : tab}
        onTabChange={setTab}
        actions={
          <button
            className="btn btn-primary"
            onClick={() => { setTab(tab === "datos" ? "general" : "datos"); setDataTab("lotes"); }}
          >
            Ingreso de datos
          </button>
        }
        configHref="/configuracion?modulo=ENGORDE&tab=Metas"
      />

      {/* ── VISIÓN GENERAL ─────────────────────────────────────────── */}
      {tab === "general" && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <KpiStrip
            lotesAbiertos={kpiData?.kpis.lotesAbiertos ?? 0}
            stockTotal={kpiData?.kpis.stockTotal ?? 0}
            hospitalCount={kpiData?.kpis.hospitalCount ?? 0}
            descartadosCount={kpiData?.kpis.descartadosCount ?? 0}
            mortalidadPct={kpiData?.kpis.mortalidadPct ?? 0}
            gdpPromedio={kpiData?.kpis.gdpPromedio ?? null}
            loading={loadingKpi}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>
            <LotesGrid lotes={lotes} loading={loadingLotes} />

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)", padding: "12px 14px",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Alertas
                </div>
                <AlertasPanel alertas={kpiData?.alertas ?? []} loading={loadingKpi} />
              </div>

              <div
                style={{
                  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)", padding: "12px 14px",
                }}
              >
                <GdpBarChart data={kpiData?.gdpPorLote ?? []} />
              </div>

              <TareasModuloPanel sector="engorde" accentColor="var(--engorde-accent)" />
            </div>
          </div>
        </div>
      )}

      {/* ── INGRESO DE DATOS ───────────────────────────────────────── */}
      {tab === "datos" && (
        <div style={{ padding: "16px 20px" }}>
          <div
            style={{
              display: "flex", gap: 0,
              borderBottom: "0.5px solid var(--border-default)",
              marginBottom: 20, overflowX: "auto",
            }}
          >
            {DATA_SUBTABS.map(st => (
              <button
                key={st.key}
                onClick={() => setDataTab(st.key)}
                style={{
                  padding: "7px 14px", fontSize: 12,
                  fontWeight: dataTab === st.key ? 600 : 400,
                  color: dataTab === st.key ? "var(--engorde-accent)" : "var(--text-muted)",
                  background: "none", border: "none",
                  borderBottom: dataTab === st.key
                    ? "2px solid var(--engorde-accent)"
                    : "2px solid transparent",
                  cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.12s",
                }}
              >
                {st.label}
              </button>
            ))}
          </div>

          {dataTab === "lotes"          && <TabLotes />}
          {dataTab === "muertes"        && <TabMuertes />}
          {dataTab === "transferencias" && <TabTransferencias />}
          {dataTab === "ventas"         && <TabVentas />}
          {dataTab === "otras"          && <TabOtrasSalidas />}
          {dataTab === "pesajes"        && <TabPesajes />}
        </div>
      )}

      {/* ── CENTRAL DE ANÁLISIS ────────────────────────────────────── */}
      {tab === "analisis" && <CentralAnalisisEngorde />}
    </>
  );
}
