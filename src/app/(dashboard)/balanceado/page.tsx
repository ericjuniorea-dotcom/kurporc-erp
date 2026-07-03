"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import {
  IconFlask, IconPackage, IconAlertTriangle, IconTrendingUp, IconShoppingCart,
} from "@tabler/icons-react";

const ALLOWED = [1, 2, 4, 5, 6];

interface LowStockMaterial { id: string; name: string; currentStockKg: number; minStockKg: number; }
interface Stats { formulaCount: number; pendingVersions: number; materials: number; lowStockMaterials: LowStockMaterial[]; }

export default function BalanceadoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated" && !session.user.roles.some((r) => ALLOWED.includes(r))) {
      router.push("/dashboard");
      return;
    }
    if (status === "authenticated") {
      fetch("/api/balanceado-stats")
        .then((r) => r.json())
        .then(setStats)
        .catch(() => setStats({ formulaCount: 0, pendingVersions: 0, materials: 0, lowStockMaterials: [] }));
    }
  }, [session, status, router]);

  if (status === "loading" || !session) return null;

  const statCards = stats ? [
    { title: "Fórmulas activas",    value: stats.formulaCount,                icon: IconFlask,         href: "/balanceado/formulas",         color: "var(--danger)" },
    { title: "Versiones pendient.", value: stats.pendingVersions,             icon: IconAlertTriangle, href: "/balanceado/formulas",         color: stats.pendingVersions > 0 ? "var(--warning)" : "var(--success)", badge: stats.pendingVersions > 0 ? `${stats.pendingVersions} para aprobar` : undefined },
    { title: "Materias primas",     value: stats.materials,                   icon: IconPackage,       href: "/balanceado/materias-primas",  color: "var(--info)" },
    { title: "Stock bajo",          value: stats.lowStockMaterials.length,    icon: IconShoppingCart,  href: "/balanceado/materias-primas",  color: stats.lowStockMaterials.length > 0 ? "var(--danger)" : "var(--success)" },
  ] : [];

  const quickLinks = [
    { href: "/balanceado/formulas",        icon: IconFlask,      iconColor: "var(--danger)",  title: "Fórmulas de alimento",  desc: "Editor con validación nutricional y control de aprobación del Vet Jefe." },
    { href: "/balanceado/materias-primas", icon: IconPackage,    iconColor: "var(--info)",    title: "Materias primas",       desc: "Registro de lotes con análisis nutricional y extracción IA desde PDF." },
    { href: "/balanceado/produccion",      icon: IconTrendingUp, iconColor: "var(--success)", title: "Órdenes de producción", desc: "Control de lotes producidos, consumo de materias primas y stock terminado." },
  ];

  return (
    <>
      <Topbar title="Balanceado" icon={IconFlask} iconColor="var(--danger)" />

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
          {statCards.map((s) => (
            <Link key={s.title} href={s.href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)", padding: "14px 14px 12px",
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 26, fontWeight: 500, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    {s.badge && (
                      <span className="badge badge-warn" style={{ marginTop: 6 }}>{s.badge}</span>
                    )}
                  </div>
                  <s.icon size={16} style={{ color: s.color, marginTop: 2 }} aria-hidden />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Low stock alert */}
        {stats && stats.lowStockMaterials.length > 0 && (
          <div style={{
            background: "var(--danger-subtle)", border: "0.5px solid var(--danger-border)",
            borderRadius: "var(--radius-lg)", overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 12px", borderBottom: "0.5px solid var(--danger-border)",
            }}>
              <IconAlertTriangle size={13} style={{ color: "var(--danger)" }} aria-hidden />
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--danger-text)" }}>
                Stock bajo en materias primas
              </span>
            </div>
            <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              {stats.lowStockMaterials.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--danger-text)" }}>{m.name}</span>
                  <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--danger-text)" }}>
                    {m.currentStockKg.toFixed(0)} kg / mín {m.minStockKg.toFixed(0)} kg
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {quickLinks.map((l) => (
            <Link key={l.href} href={l.href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  background: "var(--bg-surface)", border: "0.5px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)", padding: "16px 14px",
                  cursor: "pointer", height: "100%", transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
              >
                <l.icon size={22} style={{ color: l.iconColor, marginBottom: 10 }} aria-hidden />
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>{l.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{l.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
