"use client";
// Encabezado y menú del panel de plataforma (Fase 11).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconShieldLock } from "@tabler/icons-react";

const SECCIONES = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/cuentas", label: "Cuentas" },
  { href: "/admin/organizaciones", label: "Organizaciones" },
  { href: "/admin/actividad", label: "Actividad" },
  { href: "/admin/administradores", label: "Administradores" },
];

export function NavegacionAdmin({ nombre, nivel }: { nombre: string; nivel: string }) {
  const ruta = usePathname();
  return (
    <header style={{ background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border-default)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--danger-subtle)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <IconShieldLock size={17} style={{ color: "var(--danger)" }} aria-hidden />
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Panel de plataforma</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{nombre} · Super Administrador {nivel}</div>
          </div>
        </div>
        <Link href="/dashboard" className="btn" style={{ height: 30, fontSize: 12 }}>Volver a mi granja</Link>
      </div>
      <nav aria-label="Secciones del panel" style={{ display: "flex", gap: 2, padding: "0 20px", overflowX: "auto" }}>
        {SECCIONES.map(s => {
          const activa = s.href === "/admin" ? ruta === "/admin" : ruta.startsWith(s.href);
          return (
            <Link key={s.href} href={s.href} aria-current={activa ? "page" : undefined}
              style={{ padding: "9px 12px", fontSize: 12.5, whiteSpace: "nowrap", textDecoration: "none",
                color: activa ? "var(--text-primary)" : "var(--text-muted)", fontWeight: activa ? 500 : 400,
                borderBottom: `2px solid ${activa ? "var(--danger)" : "transparent"}` }}>
              {s.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
