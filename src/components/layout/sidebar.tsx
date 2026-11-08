"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KurPorcLogo } from "@/components/ui/logo";
import { ThemeToggle } from "./theme-toggle";
import { signOut } from "@/lib/auth/sesion-cliente";
import type { Membresia } from "@/lib/auth/config";
import { SelectorOrganizacion } from "./selector-organizacion";
import {
  IconHeart, IconHeartPlus, IconBuildingWarehouse,
  IconWheat, IconTruck, IconUsers, IconCalculator,
  IconLayoutDashboard, IconBrandWhatsapp, IconShield,
  IconChartLine, IconLogout, IconDna, IconSettings, IconBuildingStore,
  IconClipboardCheck, IconMenu2, IconX, IconShieldLock, IconLock, IconUsersGroup,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    key:   "principal",
    label: "Principal",
    items: [
      { label: "Dashboard",    href: "/dashboard",   icon: IconLayoutDashboard, permiso: "*" },
    ],
  },
  {
    key:   "produccion",
    label: "Producción",
    items: [
      { label: "Plantel Reproductivo", href: "/plantel", icon: IconDna,              permiso: "plantel.animales.ver" },
      { label: "Gestación",   href: "/gestacion",   icon: IconHeart,              permiso: "gestacion.servicios.ver" },
      { label: "Maternidad",  href: "/maternidad",  icon: IconHeartPlus,          permiso: "maternidad.partos.ver" },
      { label: "Iniciación",   href: "/recria",      icon: IconBuildingWarehouse,  permiso: "destete.lotes.ver" },
      { label: "Engorde",     href: "/engorde",     icon: IconChartLine,          permiso: "engorde.lotes.ver" },
      { label: "Sanidad",     href: "/sanidad",     icon: IconShield,             permiso: "sanidad.aplicaciones.ver" },
      { label: "Tareas",      href: "/tareas",      icon: IconClipboardCheck,     permiso: "tareas.tareas.ver" },
    ],
  },
  {
    key:   "operaciones",
    label: "Operaciones",
    items: [
      { label: "Alimentación", href: "/alimentacion", icon: IconWheat,      permiso: "alimentacion.consumos.ver" },
      { label: "Logística",    href: "/logistica",    icon: IconTruck,      permiso: "stock.items.ver" },
    ],
  },
  {
    key:   "admin",
    label: "Administración",
    items: [
      { label: "RRHH",           href: "/rrhh",          icon: IconUsers,          permiso: "rrhh.funcionarios.ver" },
      { label: "Finanzas",       href: "/finanzas",    icon: IconCalculator,     permiso: "finanzas.tablero.ver" },
      { label: "WhatsApp Bot",   href: "/whatsapp",      icon: IconBrandWhatsapp,  permiso: "configuracion.integraciones.editar" },
      { label: "Mercado de Insumos", href: "/marketplace", icon: IconBuildingStore, permiso: "compras.pedidos.ver" },
      { label: "Equipo",         href: "/equipo",        icon: IconUsersGroup,     permiso: "equipo.miembros.ver" },
      { label: "Configuración",  href: "/configuracion", icon: IconSettings,       permiso: "configuracion.organizacion.ver" },
    ],
  },
];

interface SidebarProps {
  farmName:  string;
  /** Permisos efectivos en la organización activa (Fase 7). El menú solo muestra lo permitido. */
  permisos: string[];
  organizacionActiva: string;
  membresias: Membresia[];
}

export function Sidebar({ farmName, permisos, organizacionActiva, membresias }: SidebarProps) {
  const tiene = (p: string) => p === "*" || permisos.includes(p);
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Barra superior solo-mobile: hamburguesa + logo */}
      <header className="mobile-topbar">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setMobileOpen(true)}
          className="mobile-topbar-btn"
        >
          <IconMenu2 size={20} aria-hidden />
        </button>
        <KurPorcLogo size="sm" />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <ThemeToggle />
          <button
            type="button"
            aria-label="Cerrar sesión"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mobile-topbar-btn"
          >
            <IconLogout size={18} aria-hidden />
          </button>
        </div>
      </header>

      {/* Fondo oscuro al abrir el drawer en mobile */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn("sidebar", mobileOpen && "sidebar-open")}>
        {/* Logo (desktop) + botón cerrar (mobile) */}
        <div
          style={{
            padding: "12px 16px 10px",
            borderBottom: "0.5px solid var(--border-default)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <KurPorcLogo size="sm" />
            <div
              className="sidebar-farm"
              style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {membresias.length > 1
                ? <SelectorOrganizacion activa={organizacionActiva} membresias={membresias} />
                : farmName}
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="sidebar-close-btn"
          >
            <IconX size={18} aria-hidden />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 0", overflowY: "auto" }}>
          {NAV_GROUPS.map((group) => {
            const visible = group.items.filter((item) =>
              tiene(item.permiso)
            );
            if (!visible.length) return null;
            return (
              <div key={group.key} style={{ marginBottom: 4 }}>
                <div
                  className="sidebar-section-header"
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    padding: "8px 20px 4px",
                  }}
                >
                  {group.label}
                </div>
                {visible.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn("nav-item", isActive && "active")}
                    >
                      <item.icon
                        size={15}
                        className="nav-icon"
                        aria-hidden
                        style={{ flexShrink: 0, color: isActive ? "var(--accent)" : "var(--text-muted)" }}
                      />
                      <span style={{ fontSize: 13, color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer usuario + logout (desktop; en mobile el logout está en la barra superior) */}
        <div
          className="sidebar-footer-desktop"
          style={{
            borderTop: "0.5px solid var(--border-default)",
            padding: "8px 0",
            flexShrink: 0,
          }}
        >
          <Link href="/cuenta/seguridad" className={cn("nav-item", pathname === "/cuenta/seguridad" && "active")}>
            <IconShieldLock size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Seguridad de la cuenta</span>
          </Link>
          <Link href="/cuenta/privacidad" className={cn("nav-item", pathname === "/cuenta/privacidad" && "active")}>
            <IconLock size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Privacidad</span>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="nav-item"
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
          >
            <IconLogout size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} aria-hidden />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
