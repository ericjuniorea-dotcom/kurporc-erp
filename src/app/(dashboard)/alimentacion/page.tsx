"use client";
// Sanidad y Nutrición → Nutrición. Todo es ingreso de datos: lo que se comió hoy en cada módulo (descuenta del
// inventario, con costo y quién lo cargó), el plan de alimentación (consumo teórico), el historial y el análisis.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconShield, IconWheat } from "@tabler/icons-react";
import { useSession, usePermisos } from "@/lib/auth/sesion-cliente";
import { CargaDiaNutricion } from "@/components/nutricion/carga-dia";
import { PlanAlimentacion } from "@/components/nutricion/plan-alimentacion";
import { Historial } from "@/components/alimentacion/historial";
import { CentralAnalisisAlimentacion } from "@/components/alimentacion/central-analisis";
import { TareasModuloPanel } from "@/components/shared/tareas-modulo-panel";

type Tab = "dia" | "plan" | "historial" | "analisis";
const TABS: { key: Tab; label: string }[] = [
  { key: "dia", label: "Carga del día" },
  { key: "plan", label: "Plan de alimentación" },
  { key: "historial", label: "Historial" },
  { key: "analisis", label: "Central de análisis" },
];

export default function NutricionPage() {
  const { data: session, status } = useSession();
  const { alguno } = usePermisos();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dia");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !alguno(["alimentacion.consumos.ver"])) router.push("/dashboard");
  }, [status, router, alguno]);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some(x => x.key === t)) setTab(t as Tab);
  }, []);

  if (status === "loading" || !session) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <header style={{ minHeight: 52, borderBottom: "0.5px solid var(--border-default)", display: "flex", alignItems: "center", padding: "8px 20px", gap: 12, flexWrap: "wrap", background: "var(--bg-base)" }}>
        <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--warning-subtle)", border: "0.5px solid var(--warning)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconWheat size={13} style={{ color: "var(--warning)" }} aria-hidden />
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Sanidad y Nutrición</span>
        <nav aria-label="Sanidad y Nutrición" style={{ display: "flex", gap: 2, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)", padding: 3, border: "0.5px solid var(--border-default)" }}>
          <Link href="/sanidad" style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, textDecoration: "none", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconShield size={12} aria-hidden /> Sanidad
          </Link>
          <span aria-current="page" style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, background: "var(--bg-surface)", color: "var(--text-primary)", fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconWheat size={12} aria-hidden /> Nutrición
          </span>
        </nav>
        <nav aria-label="Secciones de Nutrición" style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined}
              style={{ fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", background: "none",
                color: tab === t.key ? "var(--text-primary)" : "var(--text-muted)", fontWeight: tab === t.key ? 500 : 400,
                borderBottom: `2px solid ${tab === t.key ? "var(--warning)" : "transparent"}` }}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {tab === "dia" && <CargaDiaNutricion />}
        {tab === "plan" && <PlanAlimentacion puedeConfigurar={alguno(["alimentacion.etapas.configurar"])} />}
        {tab === "historial" && <Historial />}
        {tab === "analisis" && <CentralAnalisisAlimentacion />}
        {tab === "dia" && <TareasModuloPanel sector="granja" accentColor="var(--warning)" />}
      </div>
    </div>
  );
}
