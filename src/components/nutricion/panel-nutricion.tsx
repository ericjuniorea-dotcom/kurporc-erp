"use client";
// Sanidad y Nutrición → cuadro «Nutrición»: carga del día (descuenta del inventario con costo y quién lo cargó),
// plan de alimentación (consumo teórico), historial y análisis.
import { useState } from "react";
import { usePermisos } from "@/lib/auth/sesion-cliente";
import { CargaDiaNutricion } from "@/components/nutricion/carga-dia";
import { TareasModuloPanel } from "@/components/shared/tareas-modulo-panel";
import dynamic from "next/dynamic";

// Se bajan recién cuando se abren (la pantalla inicial queda más liviana)
function Cargando() { return <div className="kp-esqueleto" style={{ height: 220, borderRadius: "var(--radius-lg)" }} aria-busy="true" aria-label="Cargando" />; }
const CentralAnalisisAlimentacion = dynamic(() => import("@/components/alimentacion/central-analisis").then(m => m.CentralAnalisisAlimentacion), { loading: () => <Cargando /> });
const PlanAlimentacion = dynamic(() => import("@/components/nutricion/plan-alimentacion").then(m => m.PlanAlimentacion), { loading: () => <Cargando /> });
const ConsumoPeriodo = dynamic(() => import("@/components/nutricion/consumo-periodo").then(m => m.ConsumoPeriodo), { loading: () => <Cargando /> });

type Tab = "dia" | "consumo" | "plan" | "analisis";
const TABS: { key: Tab; label: string }[] = [
  { key: "dia", label: "Carga del día" },
  { key: "consumo", label: "Consumo por período" },
  { key: "plan", label: "Plan de alimentación" },
  { key: "analisis", label: "Central de análisis" },
];

export function PanelNutricion() {
  const { alguno } = usePermisos();
  const [tab, setTab] = useState<Tab>("dia");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div role="tablist" aria-label="Secciones de Nutrición" style={{ display: "flex", gap: 2, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)", alignSelf: "flex-start", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
              background: tab === t.key ? "var(--bg-surface)" : "transparent",
              color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)", fontWeight: tab === t.key ? 500 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "dia" && <CargaDiaNutricion />}
      {tab === "plan" && <PlanAlimentacion puedeConfigurar={alguno(["alimentacion.etapas.configurar"])} />}
      {tab === "consumo" && <ConsumoPeriodo />}
      {tab === "analisis" && <CentralAnalisisAlimentacion />}
      {tab === "dia" && <TareasModuloPanel sector="granja" accentColor="var(--warning)" />}
    </div>
  );
}
