"use client";
// Encabezado y menú de Finanzas (Fase 8): primero el grupo, debajo sus secciones.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCoin } from "@tabler/icons-react";
import { Topbar } from "@/components/layout/topbar";

export type SeccionFinanzas = { grupo: string; href: string; label: string };

const activaEn = (href: string, ruta: string) => (href === "/finanzas" ? ruta === "/finanzas" : ruta === href || ruta.startsWith(`${href}/`));

export function NavegacionFinanzas({ secciones }: { secciones: SeccionFinanzas[] }) {
  const ruta = usePathname();
  const grupos = Array.from(new Set(secciones.map(s => s.grupo)));
  const actual = secciones.find(s => activaEn(s.href, ruta))?.grupo ?? grupos[0];
  const enlace = (activa: boolean, chico = false): React.CSSProperties => ({
    padding: chico ? "7px 10px" : "9px 12px", fontSize: chico ? 12 : 12.5, whiteSpace: "nowrap", textDecoration: "none",
    color: activa ? "var(--text-primary)" : "var(--text-muted)", fontWeight: activa ? 500 : 400,
    borderBottom: `2px solid ${activa ? "var(--accent)" : "transparent"}`,
  });
  return (
    <>
      <Topbar title="Finanzas" icon={IconCoin} iconColor="var(--success)" />
      <nav aria-label="Grupos de Finanzas" style={{ display: "flex", gap: 2, padding: "0 20px", borderBottom: "0.5px solid var(--border-default)", overflowX: "auto", background: "var(--bg-surface)" }}>
        {grupos.map(g => {
          const primera = secciones.find(s => s.grupo === g)!;
          return <Link key={g} href={primera.href} aria-current={g === actual ? "true" : undefined} style={enlace(g === actual)}>{g}</Link>;
        })}
      </nav>
      <nav aria-label="Secciones de Finanzas" style={{ display: "flex", gap: 2, padding: "0 20px", borderBottom: "0.5px solid var(--border-default)", overflowX: "auto", background: "var(--bg-base)" }}>
        {secciones.filter(s => s.grupo === actual).map(s => {
          const activa = activaEn(s.href, ruta);
          return <Link key={s.href} href={s.href} aria-current={activa ? "page" : undefined} style={{ ...enlace(activa, true), borderBottomColor: activa ? "var(--text-primary)" : "transparent" }}>{s.label}</Link>;
        })}
      </nav>
    </>
  );
}
