"use client";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { IconSettings } from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";

interface Tab {
  key:   string;
  label: string;
}

interface TopbarProps {
  title:        string;
  icon?:        TablerIcon;
  iconColor?:   string;
  tabs?:        Tab[];
  activeTab?:   string;
  onTabChange?: (key: string) => void;
  actions?:     React.ReactNode;
  configHref?:  string;
}

export function Topbar({ title, icon: Icon, iconColor, tabs, activeTab, onTabChange, actions, configHref }: TopbarProps) {
  const { data: session } = useSession();
  const initial = (session?.user?.name ?? "U").charAt(0).toUpperCase();

  return (
    <header
      className="kp-topbar"
      style={{
        height: 52,
        borderBottom: "0.5px solid var(--border-default)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 12,
        flexShrink: 0,
        background: "var(--bg-base)",
      }}
    >
      {/* Título del módulo */}
      <span style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        {Icon && <Icon size={16} style={{ color: iconColor ?? "var(--accent)" }} aria-hidden />}
        {title}
      </span>

      {/* Tabs opcionales */}
      {tabs && tabs.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 2,
            background: "var(--bg-overlay)",
            borderRadius: "var(--radius-md)",
            padding: 3,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange?.(tab.key)}
              style={{
                fontSize: 12,
                padding: "5px 14px",
                borderRadius: 6,
                cursor: "pointer",
                border: "none",
                background: activeTab === tab.key ? "var(--bg-surface)" : "transparent",
                color: activeTab === tab.key ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: activeTab === tab.key ? 500 : 400,
                transition: "background 0.1s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Acciones */}
      {actions}

      {/* Config */}
      {configHref && (
        <Link
          href={configHref}
          title="Configuración del módulo"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: "var(--radius-md)",
            border: "0.5px solid var(--border-default)", background: "var(--bg-overlay)",
            color: "var(--text-muted)", textDecoration: "none", flexShrink: 0,
            transition: "color 0.12s, border-color 0.12s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-border)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-default)"; }}
        >
          <IconSettings size={14} aria-hidden />
        </Link>
      )}

      {/* Theme toggle (solo desktop — en mobile vive en la barra fija superior) */}
      <span className="topbar-theme-desktop">
        <ThemeToggle />
      </span>

      {/* Avatar usuario */}
      <div
        title={session?.user?.name ?? ""}
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--accent-subtle)",
          border: "0.5px solid var(--accent-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--accent-text)",
          cursor: "default",
          flexShrink: 0,
        }}
      >
        {initial}
      </div>
    </header>
  );
}
