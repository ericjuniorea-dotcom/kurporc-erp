"use client";
import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth/sesion-cliente";
import { useRouter }              from "next/navigation";
import { IconWheat, IconWifi, IconWifiOff, IconSettings } from "@tabler/icons-react";
import Link                       from "next/link";
import { RegistroDia }            from "@/components/alimentacion/registro-dia";
import { Historial }              from "@/components/alimentacion/historial";
import { CentralAnalisisAlimentacion } from "@/components/alimentacion/central-analisis";
import { TareasModuloPanel }      from "@/components/shared/tareas-modulo-panel";

const ALLOWED = [1, 2, 3, 4, 5, 6, 10, 11, 12, 13];

function OfflineBadge() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOnline(navigator.onLine);
    const h = () => setOnline(navigator.onLine);
    window.addEventListener("online",  h);
    window.addEventListener("offline", h);
    return () => { window.removeEventListener("online", h); window.removeEventListener("offline", h); };
  }, []);
  return (
    <div style={{
      fontSize: 10, padding: "3px 9px", borderRadius: 999,
      background: online ? "var(--success-subtle)" : "var(--warning-subtle)",
      color:      online ? "var(--success-text)"   : "var(--warning-text)",
      border:     `0.5px solid ${online ? "var(--success-border)" : "var(--warning-border)"}`,
      display: "flex", alignItems: "center", gap: 5, fontWeight: 500,
    }}>
      {online ? <IconWifi size={11} /> : <IconWifiOff size={11} />}
      {online ? "En línea" : "Offline — guardando local"}
    </div>
  );
}

type TabKey = "vision" | "ingreso" | "analisis";

function AlimTopbar({ tab, setTab }: { tab: TabKey; setTab: (t: TabKey) => void }) {
  const MAIN_TABS: { key: TabKey; label: string }[] = [
    { key: "vision",   label: "Visión general"      },
    { key: "analisis", label: "Central de análisis" },
  ];

  return (
    <header style={{
      height: 52, borderBottom: "0.5px solid var(--border-default)",
      display: "flex", alignItems: "center", padding: "0 20px",
      gap: 12, flexShrink: 0, background: "var(--bg-base)",
    }}>
      {/* Icono + título */}
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: "var(--warning-subtle)", border: "0.5px solid var(--warning)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <IconWheat size={13} style={{ color: "var(--warning)" }} />
      </div>
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", whiteSpace: "nowrap" }}>
        Alimentación
      </span>

      {/* 2 pestañas */}
      <div style={{
        display: "flex", gap: 2, background: "var(--bg-overlay)", borderRadius: "var(--radius-md)",
        padding: 3, border: "0.5px solid var(--border-default)",
      }}>
        {MAIN_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer",
            background: tab === t.key ? "var(--bg-surface)" : "transparent",
            color:      tab === t.key ? "var(--text-primary)" : "var(--text-muted)",
            fontWeight: tab === t.key ? 500 : 400, transition: "background 0.1s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Botón rojo Ingreso de datos */}
      <button
        className="btn btn-primary"
        onClick={() => setTab(tab === "ingreso" ? "vision" : "ingreso")}
      >
        Ingreso de datos
      </button>

      <OfflineBadge />

      <Link
        href="/configuracion?modulo=ALIMENTACION&tab=Metas"
        title="Configuración del módulo"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: "var(--radius-md)",
          border: "0.5px solid var(--border-default)", background: "var(--bg-overlay)",
          color: "var(--text-muted)", textDecoration: "none", flexShrink: 0,
        }}
      >
        <IconSettings size={14} />
      </Link>
    </header>
  );
}

function VisionGeneralAlimentacion() {
  const [resumen, setResumen] = useState<{ totalKg: number; animalesAlimentados: number; pendientes: number } | null>(null);

  useEffect(() => {
    fetch("/api/alimentacion/dia")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || !Array.isArray(d.items)) return;
        const items = d.items as Array<{ kgEntregados: number | null; animalesCount: number }>;
        const totalKg             = items.reduce((s, i) => s + (i.kgEntregados ?? 0), 0);
        const animalesAlimentados = items.filter(i => i.kgEntregados !== null).reduce((s, i) => s + i.animalesCount, 0);
        const pendientes          = items.filter(i => i.kgEntregados === null).length;
        setResumen({ totalKg, animalesAlimentados, pendientes });
      })
      .catch(() => {});
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {resumen && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[
            { label: "Kg entregados hoy",       value: `${resumen.totalKg.toLocaleString("es-PY")} kg`, color: "var(--warning)" },
            { label: "Grupos alimentados hoy",   value: resumen.animalesAlimentados,                      color: "var(--success)" },
            { label: "Registros pendientes hoy", value: resumen.pendientes,                               color: resumen.pendientes > 0 ? "var(--accent)" : "var(--success)" },
          ].map(k => (
            <div key={k.label} style={{
              background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
              borderRadius: "var(--radius-lg)", padding: "12px 14px",
            }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}
      <TareasModuloPanel sector="granja" accentColor="var(--warning)" />
    </div>
  );
}

type IngresoSubTab = "dia" | "historial";

export default function AlimentacionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab,        setTab]        = useState<TabKey>("vision");
  const [ingresoTab, setIngresoTab] = useState<IngresoSubTab>("dia");

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/login"); return; }
    if (status === "authenticated" && !session.user.roles.some(r => ALLOWED.includes(r))) {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  if (status === "loading" || !session) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <AlimTopbar tab={tab} setTab={setTab} />

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {tab === "vision" && <VisionGeneralAlimentacion />}

        {tab === "ingreso" && (
          <>
            <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid var(--border-default)", marginBottom: 16 }}>
              {[
                { key: "dia",       label: "Registro del día" },
                { key: "historial", label: "Historial"        },
              ].map(st => (
                <button
                  key={st.key}
                  onClick={() => setIngresoTab(st.key as IngresoSubTab)}
                  style={{
                    padding: "7px 16px", fontSize: 12, background: "none", border: "none",
                    cursor: "pointer", whiteSpace: "nowrap",
                    fontWeight: ingresoTab === st.key ? 600 : 400,
                    color:      ingresoTab === st.key ? "var(--warning)"     : "var(--text-muted)",
                    borderBottom: ingresoTab === st.key ? "2px solid var(--warning)" : "2px solid transparent",
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
            {ingresoTab === "dia"       && <RegistroDia />}
            {ingresoTab === "historial" && <Historial />}
          </>
        )}

        {tab === "analisis" && <CentralAnalisisAlimentacion />}
      </div>
    </div>
  );
}
