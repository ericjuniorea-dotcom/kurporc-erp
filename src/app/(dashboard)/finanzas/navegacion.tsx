"use client";
// Encabezado y menú de secciones de Finanzas (Fase 8).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCoin } from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";

export type SeccionFinanzas = { href: string; label: string };

export function NavegacionFinanzas({ secciones }: { secciones: SeccionFinanzas[] }) {
  const ruta = usePathname();
  return (
    <>
      <Topbar title="Finanzas" icon={IconCoin} iconColor="var(--success)" />
      <nav aria-label="Secciones de Finanzas" style={{ display: "flex", gap: 2, padding: "0 20px", borderBottom: "0.5px solid var(--border-default)", overflowX: "auto", background: "var(--bg-surface)" }}>
        {secciones.map(s => {
          const activa = s.href === "/finanzas" ? ruta === "/finanzas" : ruta.startsWith(s.href);
          return (
            <Link key={s.href} href={s.href} aria-current={activa ? "page" : undefined}
              style={{ padding: "9px 12px", fontSize: 12.5, whiteSpace: "nowrap", textDecoration: "none",
                color: activa ? "var(--text-primary)" : "var(--text-muted)", fontWeight: activa ? 500 : 400,
                borderBottom: `2px solid ${activa ? "var(--accent)" : "transparent"}` }}>
              {s.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
